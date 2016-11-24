var cmds = require('./cmds')
var fs = require('fs')

module.exports = function (argv) {
  var cmd = typeof argv === 'string' ? argv : argv._[0]
  var file = cmds.getCmd(cmd, 'txt')
  if (!file) throw `No help for command '${cmd}'`
  process.stdout.write(fs.readFileSync(file))
}
