var path = require('path')
var ssbGit = require('ssb-git')
var ssbKeys = require('ssb-keys')
var spawnSync = require('child_process').spawnSync

function getAppName() {
  var res = spawnSync('git', ['config', 'ssb.appname'], {encoding: 'utf8'})
  return res.stdout.trim()
}

module.exports = function createSSBClient(cb) {
  var appName = process.env.ssb_appname || getAppName()
  var ssbConfig = require('ssb-config/inject')(appName)
  var keys = ssbKeys.loadOrCreateSync(path.join(ssbConfig.path, 'secret'))
  require('ssb-client')(keys, {
    port: ssbConfig.port,
    host: ssbConfig.host || 'localhost'
  }, cb)
}
