var path = require('path')
var fs = require('fs')
var cmds = require('./cmds')

module.exports = function (argv) {
  var cmd = cmds.getCmd(argv._[0])
  if (!cmd) throw `No help for command '${cmd}'`
  var file = path.join(__dirname, './' + cmd + '.txt')
  process.stdout.write(fs.readFileSync(file))
}
