var pull = require('pull-stream')
const spawn = require('pull-spawn-process')
var Flume = require('flumedb')
//var FlumeQuery = require('flumeview-query')
var Index = require('flumeview-level')
var Reduce = require('flumeview-reduce')
const sort = require('pull-sort')
const many = require('pull-many')

const transformRecords = require('./transform')

var OffsetLog = require('flumelog-offset')
var codec = require('flumecodec')

const db = Flume(OffsetLog("flume-data/flume-npm.db", codec.json))
  .use('numRecords', Reduce(1, (acc, item) => (acc || 0) + 1 ))
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
    let [name,version] = e._id.split('@')
    return [getName(e).replace(/[^a-zA-Z]/g, '').toLowerCase()+":"+name]
  }))
  .use('user', Index(7, function (e) {
    // regular:npm-ssb
    if (!e._id) return []
    let [name,version] = e._id.split('@')
    return [getUser(e)+":"+name]
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

function name() {
    return pull.map( (e)=> (((e.value || {})._id) || "n/a@").split('@')[0] )
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
    if (err) console.log(err)
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
    sort( (a, b)=> b.count - a.count ),
    pull.unique( (e)=> e.name ),
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
      process.stderr.write(`\rSyncing ... (${records} records in log. Hit Ctrl-C to exit.) ${'⠁⠃⠇⠃'[i = (i+1) % 4]}`)
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
      publishedByUser('raynos'),
      publishedByUser('rvagg'),
      publishedByUser('substack'),
      authoredBy('dominictarr')
    ]),
    whatDoTheyUse(),
    pull.take(30),
    //details(),
    logAndCount()
  )
}

goodModules()
