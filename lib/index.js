var cmds = require('./cmds')

module.exports = function (argv) {
  if (argv.version) return require('./version')(argv)
  if (argv._.length === 0) return require('./help')('index')

  var cmd = argv._.shift()
  cmd = cmds.aliases[cmd] || cmd
  if (cmds.cmds.indexOf(cmd) < 0) throw `No such command '${cmd}'`
  var fn = require('./' + cmd)
  fn(argv)
}
