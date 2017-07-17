#!/bin/sh
':' //; exec "$(command -v node || command -v nodejs)" "$0" "$@"
// http://unix.stackexchange.com/questions/65235/universal-node-js-shebang

const fs = require('fs')
const pull = require('pull-stream')
const tcp = require('pull-net/client');
const muxrpc = require('muxrpc')
const muxrpcli = require('muxrpcli')
const mdm = require('mdmanifest')

const mdmanifest = fs.readFileSync(`${__dirname}/manifest.md`, 'utf8')
const manifest = mdm.manifest(mdmanifest)

const rpc_client = muxrpc(manifest, null) ()
const tcp_stream = tcp(8099, '127.0.0.1')
const rpc_stream = rpc_client.createStream(console.log.bind(console, 'stream is closed'))

pull(
  tcp_stream,
  rpc_stream,
  tcp_stream
)

/*
rpc_client.usage( 'whatDoTheyUse', (err, text)=>{
  console.log(text)
})
*/
if (process.argv[2] === 'server') {
  require('./server')
  return
}

muxrpcli(process.argv.slice(2), manifest, rpc_client, true)
