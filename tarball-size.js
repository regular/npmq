const path = require('path')
const pull = require('pull-stream')
const hyperquest = require('hyperquest')
const Level = require('level')
const bytewise = require('bytewise')

module.exports = function(dbRoot, Q) {
 const cache = Level(path.join(dbRoot, 'tarball-size'), {keyEncoding: bytewise, valueEncoding: 'json'})

  return function getTarrBallSize(id) {
    let [name, version] = id.split('@')
    let [numbers, postfix] = version.split('-')
    let key = [name].concat(numbers.split('.').map(Number)).concat([postfix])
    console.log(`key ${key}\n`)
    return pull(
      pull.once(key),
      pull.asyncMap( (key, cb)=>{
        cache.get(key, (err, value) => {
          cb(null, err ? undefined : value)
        })
      }),
      pull.asyncMap( (size, cb) => {
        if (typeof size !== 'undefined') return cb(null, [{size, cached: true}])
        cb(null, pull(
          Q.byId(id),
          pull.map( (qr)=>{
            return qr.value && qr.value.dist && qr.value.dist.tarball
          }),
          pull.filter(),
          pull.asyncMap( (uri, cb)=>{
            hyperquest(uri, {method: 'HEAD'}, cb) 
          }),
          pull.map( (res)=>{
            return res && res.headers && res.headers["content-length"]
          }),
          pull.filter(),
          pull.map(Number),
          pull.through( (size)=>{
            cache.put(key, size)
          }),
          pull.map( (size)=>{
            return {size, cached: false}
          })
        ))
      }),
      pull.flatten()
    )
  }
}
