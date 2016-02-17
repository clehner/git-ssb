var path = require('path')
var ssbGit = require('ssb-git')
var ssbKeys = require('ssb-keys')

module.exports = function createSSBClient(cb) {
  require('parse-git-config')(function (err, gitConfig) {
    if (err) return cb(err)

    var gitSsbConfig = gitConfig['ssb']
    var appName = process.env.ssb_appname || gitSsbConfig.appname
    var ssbConfig = require('ssb-config/inject')(appName, gitSsbConfig)

    var keys = ssbKeys.loadOrCreateSync(path.join(ssbConfig.path, 'secret'))
    require('ssb-client')(keys, {
      port: ssbConfig.port,
      host: ssbConfig.host || 'localhost'
    }, cb)
  })
}
