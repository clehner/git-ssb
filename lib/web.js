module.exports = function (argv) {
  if (argv.help) return require('./help')(argv)

	require('git-ssb-web/server')
}
