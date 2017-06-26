const pull = require('pull-stream')
const spawn = require('pull-spawn-process')
const Flume = require('flumedb')
const Index = require('flumeview-level')
const Reduce = require('flumeview-reduce')
const sort = require('pull-sort')
const many = require('pull-many')
const defer = require('pull-defer')
//const mapLast = require('pull-map-last')

const transformRecords = require('./transform')

const OffsetLog = require('flumelog-offset')
const codec = require('flumecodec')

function parseId(id) {
  if (id[0]==='@') {
    let [_,name,version] = id.split('@')
    return [`@${name}`, version]
  } else {
    return id.split('@')
  }
}

const db = Flume(OffsetLog("flume-data/flume-npm.db", codec.json))
  .use('numRecords', Reduce(1, (acc) => (acc || 0) + 1 ))
  .use('version', Index(3, (e) => {
    // npm-ssb@0100ab (sorts correctly)
    if (!e._id) return []
    let [name, version] = parseId(e._id)
    if (!name || !version) return []
    return [`${name}@${Buffer.from(version.split('.')).toString('hex')}`]
  }))
  .use('deps', Index(8, function (e) {
    // pull-stream:npm-ssb@1.1.0:~2.4.x
    let deps = e.dependencies||{};
    return Object.keys(deps).map((d)=>d+':'+e._id+':'+deps[d]) 
  }))
  .use('devDeps', Index(8, function (e) {
    // tape:npm-ssb@1.1.0:~2.4.x
    let deps = e.devDependencies||{};
    return Object.keys(deps).map((d)=>d+':'+e._id+':'+deps[d])
  }))
  .use('id', Index(2, function (e) {
    // npm-ssb@1.0.0
    if (!e._id) return []
    return [e._id]
  }))
  .use('author', Index(5, function (e) {
    // janblsche:npm-ssb
    if (!e._id) return []
    let [name,version] = parseId(e._id)
    return [getName(e).replace(/[^a-zA-Z]/g, '').toLowerCase()+":"+name]
  }))
  .use('user', Index(7, function (e) {
    // regular:npm-ssb
    if (!e._id) return []
    let [name,version] = parseId(e._id)
    return [getUser(e)+":"+name]
  }))
  .use('require', Index(11, function (e) {
    // npm-ssb@1.1.0:pull-stream
    let deps = Object.keys( e.dependencies || {}).concat(
      Object.keys( e.devDependencies || {})
    )
    return deps.map( (d)=>`${e._id}:${d}` )
  }))

function getName(e) {
  if (typeof e.author === 'string') return e.author
  return (e.author || {}).name || ""
}

function getUser(e) {
  return ( (e._npmUser && e._npmUser.name) || (e.maintainers && e.maintainers[0] && e.maintainers[0].name)) || ""
}

function byPackageName(name) {
  return db.id.read({
    'gt': name + '@',
    'lt': name + '@~'  
  })
}

function authoredBy(realName) {
  return db.author.read({
      'gt': realName + ':',
      'lt': realName + ':~'  
  })
}

function publishedByUser(user) {
  return db.user.read({
    'gt': user + ':',
    'lt': user + ':~'
  })
}

function dependingOn(name) {
  // tape:npm-ssb@1.1.0:~2.4.x
  return db.deps.read({
    'gt': name + ':',
    'lt': name + ':~'
  })
}

/*
function last() {
  let last
  return pull(
    mapLast( (e)=>{
      last = e
      return null
    }, ()=>last ),
    pull.filter()
  )
}
*/

function dependencies() {
  return pull(
    pull.map(
      (e)=> Object.keys( e.value.dependencies || {}).concat(
        Object.keys( e.value.devDependencies || {})
      )
    ),
    pull.flatten(),
    pull.unique()
  )
}

// --
function name() {
  return pull.map( (e)=> parseId((((e.value || {})._id) || "n/a@"))[0] )
}

function details() {
  function keys(dependencies) {
    return Object.keys(dependencies||{}).join(' ')
  }
  return pull.map((e)=> `${e.value._id} ${e.value.author.name} d: ${keys(e.value.dependencies)} D: ${keys(e.value.devDependencies)}`)
}

function logAndCount() {
  let count = 0
  return pull.drain( (e)=>{
    count ++
    console.log(`- ${count} ${e}`)
  }, (err)=>{
    console.log('END', err)
  })
}

function whatDoTheyUse() {
  return pull( 
    pull.map(
      (e)=> Object.keys( e.value.dependencies || {}).concat(
        Object.keys( e.value.devDependencies || {})
      ).map( (n) => {
        return {name:n, seq:e.seq}
      })
    ),
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
        byPackageName(e.name),
        pull.map( (e) => getUser(e.value) ),
        pull.filter(),
        pull.unique(),
        pull.collect( (err, accounts) => {
          e.accounts = accounts
          cb(null, e)
        })
      )
    }),
    pull.map( (e)=> `${e.count}x ${e.name} by ${e.accounts} from: ${e.firstSeen} - ${e.lastSeen}`)
  )
}

function appendLogStream(inputfile) {
  let i = 0
  setInterval( ()=>{
    db.numRecords.get( (err, records) => {
      //process.stderr.write(`\rSyncing ... (${records} records in log. Hit Ctrl-C to exit.) ${'⠁⠃⠇⠃'[i = (i+1) % 4]}`)
    })
  }, 1000)

  db.numRecords.get( (err, records) => {
    console.log(`Replicating records since #${records}`)
    pull(
      spawn('tail', `-q -F +${records} ${inputfile}`.split(' ')),
      //pull.map( (b)=>b.toString() ),
      //pull.through(console.log),
      transformRecords(),
      pull.asyncMap(db.append),
      pull.onEnd( (err)=>{
        if (err) console.error(err.message)
        console.log('sync aborted.')
      })
    )
  })
}

appendLogStream(__dirname + '/hypercore/data')

function goodModules() {
  pull(
    //publishedByUser('regular'),
    many([
      //publishedByUser('raynos'),
      //publishedByUser('rvagg'),
      publishedByUser('maxogden'),
      publishedByUser('mafintosh'),
      publishedByUser('substack'),
      authoredBy('dominictarr')
    ]),
    whatDoTheyUse(),
    pull.take(50),
    //details(),
    logAndCount()
  )
}

//goodModules()

function dependenciesOf(name) {
  //console.log('DEPS OF', name)
  // npm-ssb@1.1.0:pull-stream
  // npm-ssb@1.1.0:pull-sort
  let ret = defer.source()
  pull(
    db.version.read({
      'gt': `${name}@`,
      'lt': `${name}@~`,
      reverse: true
    }),
    pull.take(1),
    pull.collect( (err, updates)=>{
      if (err) return ret.resolve(pull.error(err))
      if (!updates.length) {
        console.log('NO PUBLISH FOUND FOR', name)
        //return ret.resolve(pull.error(new Error(`No updates fround for ${name}`)))
        return ret.resolve(pull.empty())
      }
      let latest = updates[0].value._id
      //console.log(`latest version of ${name} is ${latest}`)
      ret.resolve(
        pull(
          db.require.read({
            'gt': `${latest}:`,
            'lt': `${latest}:~`
          }),
          pull.map( (e)=>e.key.split(':')[1] )
        )
      )
    })
  )
  return ret
  /*
  return pull(
    byPackageName(name),
    sort( (a,b)=> b.seq - a.seq),
    pull.take(1),
    //pull.through( (e)=>{ console.log(e.value._id) }),
    dependencies()
  )
  */
}

function transitiveDependenciesOf(name) {
  //console.log(`outer ${name}`)

  let seen = []
  function isNew(name) {
    if (seen.indexOf(name) === -1) {
      seen.push(name);
      return true
    }
    return false
  }

  function _transitiveDependenciesOf(name) {
    if (!isNew(name)) return pull.empty()
    return pull(
      dependenciesOf(name),
      //pull.through(console.log),
      pull.asyncMap( (name, cb)=>{
        pull(
          _transitiveDependenciesOf(name),
          pull.collect( (err, deps) => {
            if (err) return cb(err)
            cb(null, [name].concat(deps) )
          })
        )
      }),
      pull.flatten()
    )
  }
  
  return pull(
    _transitiveDependenciesOf(name),
    pull.unique()
  )
}

function scuttleverse() {
  pull(
    transitiveDependenciesOf(process.argv[2]),
    sort( (a,b)=>a.localeCompare(b) ),
    logAndCount()
  )  
}

scuttleverse()

