
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

module.exports = {
  parseId,
  getAuthorName,
  getUser
}
