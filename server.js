const fs = require('fs')
const pull = require('pull-stream')
const zerr = require('zerr')
const mdm = require('mdmanifest')
const muxrpc = require('muxrpc')
const tcp = require('pull-net/server')

const commands = require('.')

const MissingArgError = zerr('BadArg', '"%" is required')
const BadTypeError = zerr('BadArg', '"%" must be a valid %')

const mdmanifest = fs.readFileSync(`${__dirname}/manifest.md`, 'utf8')
const manifest = mdm.manifest(mdmanifest)

const api = {
  usage: function (command, cb) {
    if (typeof command === 'function') {
      cb = command
      command = null
    }
    cb(null, mdm.usage(mdmanifest, command))
  },
  whois: function(name, opts) {
    if (!name) return pull.error(MissingArgError('name'))
    return commands.whois(name, opts)
  },
  size: function(id) {
    if (!id) return pull.error(MissingArgError('id'))
    return commands.size(id)
  },
  deps: function(name_or_id, opts) {
    if (!name_or_id) return pull.error(MissingArgError('name_or_id'))
    return commands.deps(name_or_id, opts)
  },
  repo: function(name, opts) {
    if (!name) return pull.error(MissingArgError('repo name'))
    return commands.findRepo(name, opts)
  },
  whatDoTheyUse: function() {
    const authors = Array.from(arguments).filter( (e)=>typeof e === 'string') 
    let opts
    //jshint -W030
    typeof (opts = Array.from(arguments).pop()) === 'object' || (opts = {})
    if (!authors.length) return pull.error(MissingArgError('authors'))
    return commands.whatDoTheyUse(authors, opts)
  }
}

const tcp_server = tcp( (client) => {
  const rpc_server = muxrpc(null, manifest)(api)
  const rpc_stream = rpc_server.createStream(/*console.log.bind(console, 'stream is closed')*/)
  pull(rpc_stream, client, rpc_stream)
})
tcp_server.listen(8099, '127.0.0.1')

/// -- httpd
const http = require('http');
const ecstatic = require('ecstatic')
const ws = require('pull-ws/server')

const http_server = http.createServer(
   ecstatic({ root: __dirname + '/public' })
).listen(8080)
console.log('httpd Listening on :8080')
ws({
  server: http_server,
}, (client) => {
  const rpc_server = muxrpc(null, manifest)(api)
  const rpc_stream = rpc_server.createStream(/*console.log.bind(console, 'stream is closed')*/)
  pull(
    rpc_stream,
    //pull.through( (d)=> console.log(`to ws ${d}`) ),
    client,
    //pull.through( (d)=> console.log(`from ws ${d}`) ),
    rpc_stream
  )
})
