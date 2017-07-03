var pull = require('pull-stream')
var ndjson = require('pull-ndjson')

var optionalProps = [
    '_seq',
    'gitHead',
    '_npmUser',
    'license',
    '_npmVersion',
    'dependencies',
    'devDependencies',
    'maintainers',
    'contributors']

module.exports = function() {
  return pull.map( (m)=>{
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
  })
}

