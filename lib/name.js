var schemas = require('ssb-msg-schemas')
var u = require('./util')

module.exports = function (argv) {
  var repo, name
  switch (argv._.length) {
    case 1:
      name = argv._[0]
      repo = u.repoId(u.getRemoteUrl('origin'))
          || u.repoId(u.getRemoteUrl('ssb'))
      if (!repo)
        err(1, 'unable to find git-ssb repo')
      break
    case 2:
      repo = u.repoId(argv._[0]) || u.repoId(u.getRemoteUrl(argv._[0]))
      name = argv._[1]
      if (!repo)
        err(1, 'unable to find git-ssb repo \'' + argv._[0] + '\'')
      break
    default:
      return help('name')
  }

  if (!name) err(1, 'missing name')

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    sbot.publish(schemas.name(repo, name), function (err, msg) {
      if (err) throw err
      console.log(msg.key)
      sbot.close()
    })
  })
}
