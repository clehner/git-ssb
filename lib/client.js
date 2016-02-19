var path = require('path')
var ssbGit = require('ssb-git')
var ssbKeys = require('ssb-keys')
var execFileSync = require('child_process').execFileSync

module.exports = function createSSBClient(cb) {
  var appName = process.env.ssb_appname ||
    execFileSync('git', ['config', 'ssb.appname'], {encoding: 'utf8'}).trim()
  var ssbConfig = require('ssb-config/inject')(appName)
  var keys = ssbKeys.loadOrCreateSync(path.join(ssbConfig.path, 'secret'))
  require('ssb-client')(keys, {
    port: ssbConfig.port,
    host: ssbConfig.host || 'localhost'
  }, cb)
}
