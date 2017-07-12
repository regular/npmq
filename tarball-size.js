const path = require('path')
const pull = require('pull-stream')
const hyperquest = require('hyperquest')
const Level = require('level')
const bytewise = require('bytewise')

module.exports = function(dbRoot, Q) {
 const cache = Level(path.join(dbRoot, 'tarball-size'), {keyEncoding: bytewise, valueEncoding: 'json'})

  return function tarballSize() {
    return pull(
      pull.asyncMap( (e, cb)=>{
        let [name, version] = e._id.split('@')
        let [numbers, postfix] = version.split('-')
        let key = [name].concat(numbers.split('.').map(Number)).concat([postfix])
        cache.get(key, (err, value) => {
          e.size = err ? undefined : value
          e._key = key
          cb(null, e)
        })
      }),
      pull.asyncMap( (e, cb) => {
        if (typeof e.size !== 'undefined') return cb(null, [{id: e._id, size: e.size, cached: true}])
        cb(null, pull(
          Q.byId(e._id),
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
            return {id: e._id, size, cached: false}
          })
        ))
      }),
      pull.flatten()
    )
  }
}
