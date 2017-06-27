const fs = require('fs')
const pull = require('pull-stream')
var zerr = require('zerr')
var MissingArgError = zerr('BadArg', '"%" is required')
var BadTypeError = zerr('BadArg', '"%" must be a valid %')
var mdm = require('mdmanifest')
const muxrpc = require('muxrpc')
const tcp = require('pull-net/server')

var mdmanifest = fs.readFileSync(`${__dirname}/manifest.md`, 'utf8')
var manifest = mdm.manifest(mdmanifest)

const api = {
  usage: (command, cb)=>{
    cb(null, mdm.usage(mdmanifest, command))
  },
  whatDoTheyUse: function(authors, opts) {
    console.log(authors, opts)
    return pull.values('hello', 'world')
  }
}

const tcp_server = tcp( (client) => {
  const rpc_server = muxrpc(null, manifest)(api)
  const rpc_stream = rpc_server.createStream(console.log.bind(console, 'stream is closed'))
  pull(rpc_stream, client, rpc_stream)
})
tcp_server.listen(8099, '127.0.0.1')
