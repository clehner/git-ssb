var path = require('path')
var ssbRef = require('ssb-ref')
var proc = require('child_process')
var u = exports

u.gitSync = function () {
  var args = [].concat.apply([], arguments)
  return proc.spawnSync('git', args, {encoding: 'utf8'}).stdout.trim()
}

u.getRemoteUrl = function (name) {
  if (!name) return
  return u.gitSync('ls-remote', '--get-url', name)
}

u.getCurrentBranch = function () {
  return u.gitSync('symbolic-ref', '--short', 'HEAD')
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

u.gitDir = function () {
  return u.gitSync('rev-parse', '-q', '--git-dir')
}

u.editor = function (name, defaultText, useText, cb) {
  var fs = require('fs')
  var filename = path.resolve(u.gitDir(), name + '_EDITMSG')

  // prepare the file for editing
  var separator = '=== This line and anything below will be removed ==='
  var text = fs.existsSync(filename) ?
    fs.readFileSync(filename, 'utf8').split(separator)[0].trim() : ''
  text += '\n\n' + separator + '\n' + defaultText
  fs.writeFileSync(filename, text)

  // edit the file
  var editor = u.gitSync('var', 'GIT_EDITOR')
  var args = [filename]
  // give vim special formats, like hub(1) does
  if (/[ng]?vim?$/.test(editor))
    args.unshift('-c', '"set ft=markdown tw=0 wrap lbr"')
  var child = proc.spawn(editor, args, {shell: true, stdio: 'inherit'})
  child.on('exit', function (code) {
    if (code) return cb('error using text editor')
    fs.readFile(filename, 'utf8', function (err, text) {
      if (err) return cb(err)
      // use the data
      useText(text.split(separator)[0].trim(), function (err) {
        if (err) return cb(err)
        // delete the file after succesful read
        fs.unlink(filename, cb)
      })
    })
  })
}

// Get a name for a thing from multiple fallback sources
u.getName = function (sbot, sources, dest, cb) {
  var pull = require('pull-stream')
  var cat = require('pull-cat')
  var name
  pull(
    cat(sources.map(function (source) {
      return sbot.links({
        source: source, dest: dest, rel: 'about',
        values: true, keys: false, meta: false,
        reverse: true
      })
    })),
    pull.drain(function (value) {
      name = value && value.content && value.content.name
      if (name) return false
    }, function (err) {
      cb(err === true ? null : err, name)
    })
  )
}
