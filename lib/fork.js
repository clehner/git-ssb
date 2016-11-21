var u = require('./util')

module.exports = function (argv) {
  if (argv._.length < 1 || argv._.length > 2) return require('./help')(argv)

  var repo
  if (argv._.length == 1) repo = u.getRemote()
  else if (argv._.length == 2) repo = u.getRemote(argv._.shift())
  if (!repo) throw 'unable to find git-ssb upstream repo'
  var name = argv._[0]
  if (!name) throw 'missing remote name'
  require('./create').createRepo(argv, name, null, repo)
}
