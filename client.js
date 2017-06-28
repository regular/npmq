console.log('Hello World')

const ws = require('pull-ws/client');
const fs = require('fs')
const pull = require('pull-stream')
const muxrpc = require('muxrpc')
const mdm = require('mdmanifest')

const mdmanifest = fs.readFileSync(__dirname + "/manifest.md", 'utf8')
const manifest = mdm.manifest(mdmanifest)

const rpc_client = muxrpc(manifest, null) ()
const rpc_stream = rpc_client.createStream(console.log.bind(console, 'stream is closed'))

ws('/ws', {binary: true, onConnect: (err, ws_stream) => {
  pull(
    ws_stream,
    //pull.through( (d)=> console.log(`from ws ${d}`) ),
    //pull.map( (x)=>JSON.parse(x) ),
    rpc_stream,
    //pull.map( (x)=>JSON.stringify(x) ),
    //pull.through( (d)=> console.log(`to ws ${d}`) ),
    ws_stream
  )

  let ul = document.querySelector('ul.result')
  let i = 0
  pull(
    rpc_client.whatDoTheyUse('substack', 'dominictarr', 'mafintosh', {limit: 500000}),
    pull.drain( (e)=>{
      // {name: "phantom", firstSeen: 2959210374, lastSeen: 2959210374, count: 1, accounts: Array(2)}
      let html = `<span class="pos">${++i}</span><span class="count">${e.count}x</span> <span class="name">${e.name}</span><span class="users">${e.accounts.map( (a)=>`<span class="user">${a}</span>`).join('')}</span>`
      let li = document.createElement('li')
      li.innerHTML = html
      ul.appendChild(li)
    })
  )
}})
