var u = require('./util')

module.exports = function (argv) {
  var repo
  if (argv._.length == 1) repo = u.getDefaultRemote()
  else if (argv._.length == 2) repo = u.getRemote(argv._.shift())
  else return require('./help')('fork')
  if (!repo) throw 'unable to find git-ssb upstream repo'
  var name = argv._[0]
  if (!name) throw 'missing remote name'
  require('./create')(argv, name, null, repo)
}
