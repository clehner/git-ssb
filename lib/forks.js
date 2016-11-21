var pull = require('pull-stream')
var paramap = require('pull-paramap')
var multicb = require('multicb')
var u = require('./util')
var getAbout = require('ssb-avatar')
var cat = require('pull-cat')

function getForks(sbot, baseMsg) {
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
        return getForks(sbot, msg)
      }),
      pull.flatten()
    )
  ])
}

module.exports = function repoForks(argv) {
  if (argv.help || argv._.length > 1) return require('./help')('forks')

  process.stderr.write('Loading forks...\r')
  var id = u.repoId(u.getRemoteUrl(argv._[0])) || u.getDefaultRemote()
  if (!id) throw 'unable to find git-ssb repo'

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    sbot.whoami(function (err, feed) {
      if (err) throw err
      sbot.get(id, function (err, msg) {
        if (err) throw err
        pull(
          getForks(sbot, {key: id, value: msg, indent: ''}),
          paramap(function (msg, cb) {
            var done = multicb({pluck: 1, spread: true})
            getAbout(sbot, feed.id, msg.value.author, done())
            getAbout(sbot, feed.id, msg.key, done())
            done(function (err, authorAbout, repoAbout) {
              if (err) return cb(err)
              cb(null, msg.indent + '- ' +
                'ssb://' + msg.key + ' ' +
                '@' + authorAbout.name + ' ' +
                (repoAbout.name||''))
            })
          }, 8),
          pull.log(sbot.close)
        )
      })
    })
  })
}
