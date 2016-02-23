var path = require('path')
var ssbKeys = require('ssb-keys')
var proc = require('child_process')

module.exports = function createSSBClient(cb) {
  var appName = process.env.ssb_appname ||
    proc.spawnSync('git', ['config', 'ssb.appname'],
      {encoding: 'utf8'}).stdout.trim()
  var ssbConfig = require('ssb-config/inject')(appName)
  var keys = ssbKeys.loadOrCreateSync(path.join(ssbConfig.path, 'secret'))
  require('ssb-client')(keys, ssbConfig, cb)
}
