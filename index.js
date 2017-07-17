const path = require('path')
const pull = require('pull-stream')
const mkdirp = require('mkdirp')
const cat = require('pull-cat')
const Flume = require('flumedb')
const sort = require('pull-sort')
const many = require('pull-many')
const defer = require('pull-defer')
const debug = require('debug')('npm-mining')
const semver = require('semver')
const TarballSize = require('./tarball-size')
const braille = require('braille-encode').encode

const dbRoot = process.argv[3] || path.join(process.env.HOME, '.npmq.db')
console.log('db location: %s', path.resolve(dbRoot))
mkdirp(dbRoot)

const codec = require('flumecodec')
const flumelog = require('flumelog-offset')(path.join(dbRoot,'flume'), {
  codec: codec.json,
  offsetCodec: 48
})
const db = require('flumedb')(flumelog)

const u = require('./util')

const Q = require('./queries')(db)
const changesStream = require('pull-npm-registry')
const tarballSize = TarballSize(dbRoot, Q)

// -- import

function appendLogStream() {
  let i = 0
  setInterval( ()=>{
    db.numRecords.get( (err, records) => {
      i++
      let shift = [0,1,2,3,2,1]
      let bit1 = 1 << shift[i % 6]
      let bit2 = 1 << (5 + shift[(i+3) % 6])
      let spinner = braille(Buffer.from([bit1|bit2]))
      process.stderr.write(`\r${spinner} Syncing ... (${records} records in log. Hit Ctrl-C to exit.)`)
    })
  }, 200)

  db.lastSequence.get( (err, seq) => {
    if (err) throw err
    seq = seq || 0
    console.log('last seq in db', seq)
    pull(
      changesStream(seq),
      pull.asyncMap( (doc, cb)=>{
        // do we know about this revision already?
        let arrId = u.toArrayId(doc.id)
        //console.log(arrId)
        db.version.get(arrId, (err, value)=>{
          if (!err && value) {
            //console.log(`already know about ${arrId}`)
            return cb(null, null) // already known
          }
          return cb(null, doc)
        })
      }),
      pull.filter(),
      pull.asyncMap( (doc, cb)=>{
        db.append(doc, cb)
      }),
      pull.onEnd( (err)=>{
        console.error(err)
      })
    )
  })
}

appendLogStream()

// -- throughs

function value() {
  return pull.map( (e)=>e.value )
}

function name() {
  return pull.map( (e)=> u.parseId((((e.value || {}).id) || "n/a@"))[0] )
}

function details() {
  function keys(dependencies) {
    return Object.keys(dependencies||{}).join(' ')
  }
  return pull.map((e)=> `${e.id} ${e.author && e.author.name} d: ${keys(e.dependencies)} D: ${keys(e.devDependencies)}`)
}

function resolveSemverRange(opts) {
  return pull(
    pull.asyncMap( ({name, range}, cb)=>{
      // is it a tag?
      db.tags.get(`${name}@${range}`, (err, qr)=>{
        if (!err && qr) return cb(err, [qr])
        pull(
          Q.byName(name, {reverse: true}),
          value(),
          //pull.through( (e)=>debug(e.id) ),
          pull.filter( (e)=>{
            [name, version] = u.parseId(e.id)
            return semver.satisfies(version, range)
          }),
          pull.collect( (err, resolved)=>{
            if (err) return cb(err)
            if (!resolved.length) {
              let msg = `Unable to resolve ${name}@${range}`
              if (opts.ignoreUnresolvable) {
                return cb(null, [{error: msg}])
              }
              return cb(new Error(msg))
            }
            cb(null, resolved)
          })
        )
      })
    })
  )
}

// --

function logAndCount() {
  let count = 0
  return pull.drain( (e)=>{
    count ++
    console.log(`- ${count} ${e}`)
  }, (err)=>{
    console.log('END', err)
  })
}

function whatDoTheyUse(opts) {
  opts = opts || {}
  return pull( 
    pull.map( (e)=>{
      let deps = Object.keys( e.value.dependencies || {})
      if (opts.dev)
        deps = deps.concat( Object.keys( e.value.devDependencies || {}))
      return deps.map( (n) => {
        return {name:n, seq:e.seq}
      })
    }),
    pull.flatten(),
    pull.map( (()=>{ 
      let stats = {}
      return (e)=>{
        let s = stats[e.name]
        if (!s) return stats[e.name] = { 
          name: e.name,
          firstSeen: e.seq,
          lastSeen: e.seq,
          count: 1
        }
        s.firstSeen = Math.min(s.firstSeen, e.seq)
        s.lastSeen = Math.max(s.lastSeen, e.seq)
        s.count++
        return s
      }
    })()),
    pull.unique( (e)=> e.name ),
    sort( (a, b)=> b.count - a.count ),
    pull.asyncMap( (e, cb)=>{
      let account
      pull(
        Q.byName(e.name),
        pull.map( (e) => u.getUser(e.value) ),
        pull.filter(),
        pull.unique(),
        pull.collect( (err, accounts) => {
          e.accounts = accounts
          cb(null, e)
        })
      )
    })
    //, pull.map( (e)=> `${e.count}x ${e.name} by ${e.accounts} from: ${e.firstSeen} - ${e.lastSeen}`)
  )
}

function goodModules() {
  pull(
    // byPublisher('regular'),
    many([
      //publishedByUser('raynos'),
      //publishedByUser('rvagg'),
      Q.byPublisher('maxogden'),
      Q.byPublisher('mafintosh'),
      Q.byPublisher('substack'),
      Q.byAuthor('dominictarr')
    ]),
    whatDoTheyUse(),
    pull.take(25),
    //details(),
    logAndCount()
  )
}

//goodModules()
//return

function transitiveDependenciesOf(opts) {
  //console.log(`outer ${name}`)

  let seen = []
  function isNew(id) {
    if (seen.indexOf(id) === -1) {
      seen.push(id);
      return true
    }
    return false
  }

  function _transitiveDependenciesOf(id, level, opts) {
    if (!id || !isNew(id)) return pull.empty()
    // turn off dev dependencies for the next level
    let nextOpts = Object.assign({}, opts, {dev: false})
    return pull(
      Q.byDependant(id, opts),
      value(),
      resolveSemverRange(opts),
      pull.map( (candidates)=>candidates[0]),
      pull.through( (e)=>{
        e.requiredBy = id
        e.distance = level
      }),
      pull.map( (e)=> many([
        pull.once(e),
        _transitiveDependenciesOf(e.id, level+1, nextOpts)
      ])),
      pull.flatten()
    )
  }
  
  return pull(
    pull.map( (e)=> _transitiveDependenciesOf(e.id, 1, opts) ),
    pull.flatten(),
    pull.unique( (e)=>e.id)
  )
}

function scuttleverse() {
  pull(
    pull.values(process.argv.slice(2)),
    pull.map( (name)=> Q.latestVersion(name) ),
    pull.flatten(),
    value(),
    transitiveDependenciesOf(),
    //sort( (a,b)=>a.localeCompare(b) ),
    //details(),
    pull.map( (e)=>`${e.id} (required by ${e.requiredBy})` ),
    logAndCount()
  )  
}

function get(name_or_id) {
  return pull(
    name_or_id ? pull.values([name_or_id]) : pull.through(),
    pull.map( (name_or_id)=>{
      if (name_or_id.indexOf('@') !== -1) {
        return Q.byId(name_or_id) 
      } else {
        return Q.latestVersion(name_or_id)
      }
    }),
    pull.flatten()
  )
}

function dependencies(opts) {
  opts = opts || {}
  
  let deps = pull(
    pull.map( (e)=> Q.byDependant(e.id, opts) ),
    pull.flatten(),
    value()
  )
  if (!opts.resolve) return deps
  return pull(
    deps,
    resolveSemverRange(opts),
    pull.map( (candidates)=>candidates[0])
  )
}

//showDependencies('pull-stream')

//scuttleverse()
module.exports = {
  size: function(names_or_ids, opts) {
    opts = opts || {}
    
    function source() {
      return pull(
        pull.values(names_or_ids),
        get(),
        value()
      )
    }

    function transitive() {
      return pull(
        transitiveDependenciesOf(
          Object.assign({}, {
            ignoreUnresolvable: true
          }, opts)
        )
      )
    } 

    function size() {
      return pull(
        pull.unique( (e)=>e.id),
        tarballSize(),
        (()=> {
          let running_total = 0
          return pull.through( (e)=>{
            running_total += e.size || 0
            e.running_total = running_total
          })
        })()
      )
    }
    if (opts.transitive) {
      return pull(
        many([
          source(),
          pull(
            source(),
            transitive()
          )
        ]),
        size()
      )
    } else {
      return pull(
        source(),
        size()
      )
    }

  },
  versions: function(name) {
    return Q.byName(name)
  },
  tags: function(name) {
    return Q.tagsByName(name) 
  },
  deps: function(name_or_id, opts) {
    opts = opts || {}
    return pull(
      get(name_or_id),
      value(),
      opts.transitive ? transitiveDependenciesOf(opts) : dependencies(opts)
    )
  },
  whois: function(name, opts) {
    opts = opts || {}
    minConfidence = 'minConfidence' in opts ? opts.minConfidence : 0.2
    const counters = {}
    const totals = {author:0, user:0}

    function reducer(propName) {
      return pull.through( (e)=>{
        const key = `${e.user}\t${e.author}`
        const count = counters[key] || (counters[key] = {author:0,user:0})
        count[propName] = e.count
        totals[propName] += e.count
      })
    }

    return pull( 
      cat([
        many([
          pull(Q.authorByUser(name), reducer('user')),
          pull(Q.userByAuthor(name), reducer('author'))
        ]),
        pull(
          pull.once('whatever'), pull.asyncMap( (_, cb)=> pull(
            pull.keys(counters),
            pull.map( (k)=>{
              const [user, author] = k.split('\t')
              const propIsUser = counters[k].user / totals.user
              const propIsAuthor = counters[k].author / totals.author
              return [{
                author: author,
                confidence: propIsUser
              }, {
                user: user,
                confidence: propIsAuthor
              }]
            }),
            pull.flatten(),
            pull.filter( (e)=> e.confidence > minConfidence),
            sort( (a, b)=> b.confidence - a.confidence),
            pull.collect(cb)
          )),
          pull.flatten()
        )
      ]),
      pull.filter( (e)=> e.confidence || opts.raw )
    )
  },
  findRepo: Q.byRepo,
  whatDoTheyUse: function(authors, opts) {
    opts = opts || {}
    let limit = opts.limit || 40
    return pull(
      many( authors.map( Q.byPublisher ) ),
      whatDoTheyUse(opts),
      pull.take(limit)
    )
  }
}
