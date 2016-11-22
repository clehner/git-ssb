var cmds = require('./cmds')

module.exports = function (argv) {
  if (argv.version) return require('./version')(argv)
  if (argv.help) return require('./help')(argv)
  if (argv._.length === 0) return require('./help')(argv)

  var cmd = argv._.shift()
  var file = cmds.getCmd(cmd, 'js')
  if (!file) throw `No such command '${cmd}'`
  var fn = require(file)
  fn(argv)
}
