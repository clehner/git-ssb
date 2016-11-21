module.exports = function (argv) {
  if (argv.help) return require('./help')('version')

  var pkg = require('../package')
  console.log(pkg.name, pkg.version)
}

