var pull = require('pull-stream')
var Flume = require('flumedb')
//var FlumeQuery = require('flumeview-query')
var Index = require('flumeview-level')

var OffsetLog = require('flumelog-offset')
var codec = require('flumecodec')


const db = Flume(OffsetLog("flume-npm.db", codec.json))
  .use('deps', Index(8, function (e) {
    return Object.keys(e.dependencies||{}).map((d)=>d+':'+e._id) 
  })).use('id', Index(1, function (e) {
    return [e._id];
  })).use('author', Index(3, function (e) {
    return [(e.author.name||"").replace(/[^a-zA-Z]/g, '').toLowerCase()+":"+e._id];
  }))

pull(
    db.author.read({
        'gte': 'dominictarr',
        'lt':  'dominictarrz'
    }),
    pull.map((e)=> `${e.key} ${e.value._id} ${e.value.author.name} ${Object.keys(e.value.dependencies||{}).join(' ')}`),
    pull.log()
)
