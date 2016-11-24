var proc = require('child_process')
var u = require('./util')

function hasRemote(name) {
  var remotes = proc.spawnSync('git', ['remote']).stdout.toString().split(/\n/)
  return !!~remotes.indexOf(name)
}

module.exports = function (argv) {
  if (argv._.length < 1 || argv._.length > 2) return require('./help')('create')

  module.exports.createRepo(argv, argv._[0], argv._[1]);
}

module.exports.createRepo = function (config, remoteName, name, upstream) {
  if (!remoteName) throw 'Missing remote name'
  if (hasRemote(remoteName)) throw `Remote '${remoteName}' already exists`
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

