
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

function toHexId(id) {
    if (!id) return null
    let [name, version] = parseId(id)
    if (!name || !version) return null
    return `${name}@${Buffer.from(version.split('.')).toString('hex')}`
}

module.exports = {
  parseId,
  getAuthorName,
  getUser,
  toHexId
}
