var path = require('path')
var ssbRef = require('ssb-ref')
var proc = require('child_process')

exports.getRemoteUrl = function (name) {
  return proc.spawnSync('git', ['remote', 'get-url', name],
    {encoding: 'utf8'}).stdout.trim()
}

exports.repoId = function (id) {
  if (!id) return
  id = String(id).replace(/^ssb:\/*/, '')
  return ssbRef.isMsg(id) ? id : null
}

exports.getSbot = function (config, cb) {
  var keys = require('ssb-keys')
    .loadOrCreateSync(path.join(config.path, 'secret'))
  require('ssb-client')(keys, config, cb)
}
