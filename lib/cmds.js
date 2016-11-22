var path = require('path')
var fs = require('fs')

exports.aliases = {
  'prs': 'pull-requests'
}

exports.getCmd = function (cmd, ext) {
  cmd = cmd ? exports.aliases[cmd] || cmd : 'index'
  if (/[:\/]/.test(cmd)) return null
  var file = path.join(__dirname, cmd + '.' + ext)
  if (fs.existsSync(file)) return file
  return null
}
