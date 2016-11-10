var u = require('./util')

function hasRemote(name) {
  var child = proc.spawnSync('git', ['remote'], {encoding: 'utf8'})
  var remotes = child.stdout.split(/\n/)
  return !!~remotes.indexOf(name)
}

module.exports = function (config, remoteName, name, upstream) {
  if (config._.length == 0) return require('./help')('create')
  if (!remoteName) throw 'Missing remote name'
  if (hasRemote(remoteName))
    throw 'Remote \'' + remoteName + '\' already exists'
  u.getSbot(config, function (err, sbot) {
    if (err) throw err
    require('ssb-git-repo').createRepo(sbot, {
      upstream: upstream,
      name: name
    }, function (err, repo) {
      if (err) throw err
      var url = 'ssb://' + repo.id
      console.log('Created repo:', url, name ? '(' + name + ')' : '')
      proc.spawnSync('git', ['remote', 'add', remoteName, url])
      console.log('Added remote:', remoteName)
      repo.close()
      sbot.close()
    })
  })
}

