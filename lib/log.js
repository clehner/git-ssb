var pull = require('pull-stream')
var paramap = require('pull-paramap')
var u = require('./util')
var getAbout = require('ssb-avatar')

module.exports = function (argv) {
  var repoId
  if (argv.global || argv.g) {
    if (argv._.length > 0) return require('./help')('log')
    repoId = null
  } else {
    repoId = u.getRemote(argv._[0])
    if (!repoId) throw 'unable to find git-ssb repo'
  }

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    sbot.whoami(function (err, feed) {
      if (err) throw err
      pull(
        sbot.links({
          dest: repoId,
          rel: 'repo',
          values: true,
          meta: false,
          reverse: true,
        }),
        pull.filter(function (msg) {
          var c = msg.value.content
          return c.type === 'git-update'
        }),
        // TODO:
        // - sort by timestamp, or causal order?
        // - show causal links
        paramap(function (msg, cb) {
          getAbout(sbot, feed.id, msg.value.author, function (err, about) {
            if (err) return cb(err)
            msg.authorName = '@' + about.name
            cb(err, msg)
          })
        }, 8),
        pull.map(function (msg) {
          var c = msg.value.content
          var commits = Array.isArray(c.commits) ? c.commits : []
          var numMoreCommits = ~~c.commits_more
          var date = new Date(msg.value.timestamp)
          return '' +
`${msg.key}
${msg.authorName} ${date.toLocaleString()}
${commits.map(commit =>
`  + ${String(commit.sha1).substr(0, 8)} ${commit.title||''}
`).join('')}`
+ (c.commits_more ?
`  + ${~~c.commits_more} more` : '')
        }),
        pull.log(function (err) {
          if (err) throw err
          process.exit(0)
        })
      )
    })
  })
}
