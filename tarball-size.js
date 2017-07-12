const path = require('path')
const pull = require('pull-stream')
const hyperquest = require('hyperquest')
const Level = require('level')
const bytewise = require('bytewise')
const u = require('./util')

module.exports = function(dbRoot, Q) {
 const cache = Level(path.join(dbRoot, 'tarball-size'), {keyEncoding: bytewise, valueEncoding: 'json'})

  return function tarballSize() {
    return pull(
      pull.asyncMap( (e, cb)=>{
        let key = u.toArrayId(e.id)
        cache.get(key, (err, value) => {
          e.size = err ? undefined : value
          e._key = key
          cb(null, e)
        })
      }),
      pull.asyncMap( (e, cb) => {
        if (typeof e.size !== 'undefined') return cb(null, [Object.assign(e, {cached: true})])
        cb(null, pull(
          Q.byId(e.id),
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
            cache.put(e._key, size)
          }),
          pull.map( (size)=>{
            return Object.assign(e, {size, cached: false})
          })
        ))
      }),
      pull.flatten()
    )
  }
}
