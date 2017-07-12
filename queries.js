const pull = require('pull-stream')
const Index = require('flumeview-level')
const Reduce = require('flumeview-reduce')
const defer = require('pull-defer')
const debug = require('debug')('queries')

const u = require('./util')

// more queries could be:
/*
    if (m.dist && m.dist.tarball) r.tarball = m.dist.tarball
    if (m.dist && m.dist.integrity) r.integrity = m.dist.integrity
    var sha = m._shasum || (m.dist || {}).shasum
    if (sha) r.sha = sha
*/

module.exports =function (db) {
  db
  .use('numRecords', Reduce(1, (acc) => (acc || 0) + 1 ))
  .use('lastSequence', Reduce(1, (acc, i) => acc =  i._seq))
  .use('userByAuthor', Reduce(2, (acc, {user, author}) => {
    acc = acc || {}
    const counters = acc[author] || (acc[author] = {})
    counters[user] = (counters[user] || 0) + 1
    return acc
  }, (e)=>{
    if (!(e._npmUser && e._npmUser.name) || !(e.author && e.author.name)) return null
    return {user: e._npmUser.name, author: e.author.name}
  }))
  .use('authorByUser', Reduce(2, (acc, {user, author}) => {
    acc = acc || {}
    const counters = acc[user] || (acc[user] = {})
    counters[author] = (counters[author] || 0) + 1
    return acc
  }, (e)=>{
    if (!(e._npmUser && e._npmUser.name) || !(e.author && e.author.name)) return null
    return {user: e._npmUser.name, author: e.author.name}
  }))
  .use('tags', Index(1, (e) => {
    // npm-ssb@latest
    if (!e._id) return []
    let [name, version] = u.parseId(e._id)
    if (!name || !version) return []
    let tags = e['_dist-tags']
    return Object.keys(tags).filter( tag => tags[tag] === version ).map( tag => `${name}@${tag}` )
  }))
  .use('version', Index(4, (e) => {
    // [npm-ssb,1,1,0,alpha,1] (sorts correctly, see typewise-semver)
    if (!e._id) return []
    let arrId = u.toArrayId(e._id)
    if (!arrId) return []
    //console.log(arrId)
    return [arrId]
  }))
  .use('deps', Index(8, function (e) {
    // pull-stream:npm-ssb@1.1.0:~2.4.x
    let deps = e.dependencies||{};
    return Object.keys(deps).map((d)=>d+':'+e._id+':'+deps[d]) 
  }))
  .use('devDeps', Index(8, function (e) {
    // tape:npm-ssb@1.1.0:~2.4.x
    let deps = e.devDependencies||{};
    return Object.keys(deps).map((d)=>d+':'+e._id+':'+deps[d])
  }))
  .use('author', Index(5, function (e) {
    // janblsche:npm-ssb
    if (!e._id) return []
    let [name, version] = u.parseId(e._id)
    return [u.getAuthorName(e).replace(/[^a-zA-Z]/g, '').toLowerCase()+":"+name]
  }))
  .use('user', Index(7, function (e) {
    // regular:npm-ssb
    if (!e._id) return []
    let [name, version] = u.parseId(e._id)
    return [u.getUser(e)+":"+name]
  }))
  .use('requireDev', Index(1, function (e) {
    // npm-ssb@1.1.0:pull-stream@~2.1.0
    let deps = Object.assign(
      {},
      e.dependencies || {},
      e.devDependencies || {}
    )
    return Object.keys(deps).map( (k)=>
      `${e._id}:${k}@${deps[k]}` 
    )
  }))
  .use('require', Index(12, function (e) {
    // npm-ssb@1.1.0:pull-stream@~2.1.0
    let deps = Object.assign(
      {},
      e.dependencies || {}
    )
    return Object.keys(deps).map( (k)=>
      `${e._id}:${k}@${deps[k]}` 
    )
  }))
  .use('repo', Index(13, function (e) {
    //  https://github.com/ghuser/reponame.git
    if (e.repository && e.repository.url) return [e.repository.url]
    return []
  }))

  function makeWhoIsQuery(view, propName, searchByProp) {
    return function (name) {
      const ret = defer.source()
      view.get( (err, index)=> ret.resolve(
        err ? 
        pull.error(err) : 
        pull(
          pull.keys(index[name] || {}),
          pull.map( (candidate)=>({
            [propName]: candidate,
            [searchByProp]: name,
            count: index[name][candidate]
          }))
        )
      ))
      return ret
    }
  }

  function byName(name, opts) {
    return db.version.read(Object.assign({
      'gt': [name],
      'lt': [name, '']
    }, opts))
  }

  function tagsByName(name, opts) {
    return db.tags.read(Object.assign({
      'gt': `${name}@`,
      'lt': `${name}@~`
    }, opts))
  }

  function byRepo(name, opts) {
    return db.repo.read(Object.assign({
      'gte': name,
      'lt': name + '~'
    }, opts))
  }

  function byId(id) {
    let arrId = u.toArrayId(id)
    return db.version.read({
      'gte': arrId,
      'lte': arrId  
    })
  }

  function byAuthor(realName) {
    return db.author.read({
        'gt': realName + ':',
        'lt': realName + ':~'  
    })
  }

  function byPublisher(user) {
    return db.user.read({
      'gt': user + ':',
      'lt': user + ':~'
    })
  }

  function byDependency(name) {
    // tape:npm-ssb@1.1.0:~2.4.x
    return db.deps.read({
      'gt': name + ':',
      'lt': name + ':~'
    })
  }

  function latestVersion(name) {
    return db.tags.read({
      'gte': `${name}@latest`,
      'lte': `${name}@latest`
    })

    /*
    return pull(
      db.version.read({
        'gt': [name],
        'lt': [name, ''],
        reverse: true
      }),
      pull.through( (e)=>debug(`latest version of ${name}: ${e.value._id}`) ),
      pull.take(1)
    )
    */
  }

  function byDependant(id, opts) { // aka dependenciesOf
    // npm-ssb@1.1.0:pull-stream@~1.2.3
    // npm-ssb@1.1.0:pull-sort@1.x.x 2.x.x
    opts = opts || {}
    return pull(
      db[opts.dev ? "requireDev" : "require"].read({
        'gt': `${id}:`,
        'lt': `${id}:~`
      }),
      pull.map( (e)=>{
        [name, range] = e.key.split(':')[1].split('@')
        return {value: {name, range}}
      } )
    )
  }

  return {
    userByAuthor: makeWhoIsQuery(db.userByAuthor, 'user', 'author'),
    authorByUser: makeWhoIsQuery( db.authorByUser, 'author', 'user'),
    byName,
    byId,
    tagsByName,
    byAuthor,
    byRepo,
    byPublisher,
    byDependant,
    byDependency,
    latestVersion
  }
}
