var path = require('path')
var fs = require('fs')
var cmds = require('./cmds')

module.exports = function (argv) {
  if (typeof argv === 'string') argv = {_: [argv]}
  var cmd = argv._[0]
  if (argv.help) cmd = 'help'
  cmd = cmds.aliases[cmd] || cmd || 'index'
  if (cmds.cmds.indexOf(cmd) < 0) throw `No help for command '${cmd}'`
  var file = path.join(__dirname, './' + cmd + '.txt')
  process.stdout.write(fs.readFileSync(file))
}
