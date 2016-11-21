module.exports = function (argv) {
  if (argv.help) return require('./help')('web')

	require('git-ssb-web/server')
}
