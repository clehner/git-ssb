var pull = require('pull-stream')
var paramap = require('pull-paramap')
var multicb = require('multicb')
var u = require('./util')
var Names = require('ssb-names')
var cat = require('pull-cat')

function top(obj) {
  var maxK
  for (var k in obj)
    if (!(obj[k] < obj[maxK]))
      maxK = k
  return maxK
}

function getForks(sbot, names, baseMsg) {
  return cat([
    pull.once(baseMsg),
    pull(
      sbot.links({
        dest: baseMsg.key,
        rel: 'upstream',
        values: true
      }),
      pull.map(function (msg) {
        msg.indent = baseMsg.indent + '  '
        return getForks(sbot, names, msg)
      }),
      pull.flatten()
    )
  ])
}

module.exports = function repoForks(argv) {
  var id = u.repoId(u.getRemoteUrl(argv._[0])) || u.getDefaultRemote()
  if (!id)
    err(1, 'unable to find git-ssb repo')

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    var names = Names.init(sbot)
    sbot.get(id, function (err, msg) {
      if (err) throw err
      pull(
        getForks(sbot, names, {key: id, value: msg, indent: ''}),
        paramap(function (msg, cb) {
          var done = multicb({pluck: 1, spread: true})
          names.signifier(msg.value.author, done())
          names.signifier(msg.key, done())
          done(function (err, authorNames, repoNames) {
            if (err) return cb(err)
            cb(null, msg.indent + '- ' +
              'ssb://' + msg.key + ' ' +
              top(authorNames) + ' ' +
              (top(repoNames)||''))
          })
        }, 8),
        pull.log(sbot.close)
      )
    })
  })
}
