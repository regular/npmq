var Flume = require('flumedb')
var FlumeQuery = require('flumeview-query')

var OffsetLog = require('flumelog-offset')
var codec = require('flumecodec')

var pull = require('pull-stream')
var ndjson = require('pull-ndjson')
var stdio = require('pull-stdio')

const db = Flume(OffsetLog("flume-data/flume-npm.db", codec.json))

var n=1
setInterval( ()=>{
    console.log(n)
}, 3000)
var optionalProps = [
    'gitHead',
    '_npmUser',
    'license',
    '_npmVersion',
    'dependencies',
    'devDependencies',
    'maintainers',
    'contributors']
pull(
    stdio.stdin(),
    ndjson.parse(),
    pull.map( (m)=>{
        var r = {
            _id: m._id,
            author: m.author || {name: ""},
        }
        if (m.dist && m.dist.tarball) r.tarball = m.dist.tarball
        if (m.dist && m.dist.integrity) r.integrity = m.dist.integrity
        if (m.repository && m.repository.url) r.repo = m.repository.url
        var sha = m._shasum || (m.dist || {}).shasum
        if (sha) r.sha = sha
        optionalProps.forEach( (n)=>{
            if (m[n]) r[n] = m[n]
        })
        return r
    }),
    pull.through( (m)=>{
        n++
        //console.log(`${n++} ${m._id} ${m.author.name}`)
    }),
    //pull.through(console.log),
    pull.asyncMap(db.append),
    pull.drain( (seq)=>{
        //console.log(seq)
    }, (err)=>{
        console.error('err', err)
    })
)

