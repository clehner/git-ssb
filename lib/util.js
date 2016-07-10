var path = require('path')
var ssbRef = require('ssb-ref')
var proc = require('child_process')
var u = exports

u.getRemoteUrl = function (name) {
  if (!name) return
  return proc.spawnSync('git', ['remote', 'get-url', name],
    {encoding: 'utf8'}).stdout.trim()
}

u.getRemote = function (name) {
  return u.repoId(name) || u.repoId(u.getRemoteUrl(name))
}

u.getDefaultRemote = function (name) {
  return u.repoId(u.getRemoteUrl('origin'))
      || u.repoId(u.getRemoteUrl('ssb'))
}

u.repoId = function (id) {
  if (!id) return
  id = String(id).replace(/^ssb:\/*/, '')
  return ssbRef.isMsg(id) ? id : null
}

u.getSbot = function (config, cb) {
  var keys = require('ssb-keys')
    .loadOrCreateSync(path.join(config.path, 'secret'))
  require('ssb-client')(keys, config, cb)
}
