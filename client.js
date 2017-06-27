const fs = require('fs')
const pull = require('pull-stream')
const tcp = require('pull-net/client');
const muxrpc = require('muxrpc')
const mdm = require('mdmanifest')

const mdmanifest = fs.readFileSync(`${__dirname}/manifest.md`, 'utf8')
const manifest = mdm.manifest(mdmanifest)
console.log(manifest)

const rpc_client = muxrpc(manifest, null) ()
const tcp_stream = tcp(8099, '127.0.0.1')
const rpc_stream = rpc_client.createStream(console.log.bind(console, 'stream is closed'))

pull(
  tcp_stream,
  rpc_stream,
  tcp_stream
)

rpc_client.usage( 'whatDoTheyUse', (err, text)=>{
  console.log(text)
})
