var u = require('./util')

module.exports = function (argv) {
  if (argv.help || argv._.length < 1 || argv._.length > 2) return require('./help')('name')

  var repo
  if (argv._.length == 1) repo = u.getRemote()
  else if (argv._.length == 2) repo = u.getRemote(argv._.shift())
  if (!repo) throw 'unable to find git-ssb repo'
  var name = argv._[0]
  if (!name) throw 'missing name'

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    var schemas = require('ssb-msg-schemas')
    sbot.publish(schemas.name(repo, name), function (err, msg) {
      if (err) throw err
      console.log(msg.key)
      sbot.close()
    })
  })
}

