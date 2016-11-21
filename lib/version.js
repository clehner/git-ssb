module.exports = function (argv) {
  if (argv.help) return require('./help')(argv)

  var pkg = require('../package')
  console.log(pkg.name, pkg.version)
}

