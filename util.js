const tw_semver = require('typewise-semver')
const semver = require('semver')

function parseId(id) {
  if (id[0]==='@') {
    let [_,name,version] = id.split('@')
    return [`@${name}`, version]
  } else {
    return id.split('@')
  }
}

function getAuthorName(e) {
  if (typeof e.author === 'string') return e.author
  return (e.author || {}).name || ""
}

function getUser(e) {
  return ( (e._npmUser && e._npmUser.name) || (e.maintainers && e.maintainers[0] && e.maintainers[0].name)) || ""
}

function toArrayId(id) {
    if (!id) return null
    let [name, version] = parseId(id)
    if (!name || !version) return null
    //console.log('parse version',name, version)
    if (semver.parse(version) === null) return null
    return [name].concat(tw_semver.parse(version))
}

module.exports = {
  parseId,
  getAuthorName,
  getUser,
  toArrayId
}
