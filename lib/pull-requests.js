var pull = require('pull-stream')
var paramap = require('pull-paramap')
var u = require('./util')
var getAbout = require('ssb-avatar')
var PRs = require('ssb-pull-requests')

module.exports = function (argv) {
  if (argv._.length > 1) return require('./help')(argv)

  process.stderr.write('Loading pull requests...\r')
  var headRepo = u.getRemote(argv._[0])
  if (!headRepo) throw 'unable to find git-ssb head repo'

  var open = u.issueStateBool(argv)

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    sbot.whoami(function (err, feed) {
      if (err) throw err
      pull(
        PRs.init(sbot).list({
          repo: headRepo,
          open: open
        }),
        paramap(function (pr, cb) {
          getAbout(sbot, feed.id, pr.author, function (err, authorAbout) {
            pr.authorName = authorAbout.name
            cb(err, pr)
          })
        }, 8),
        pull.map(function (pr) {
          var state = pr.open ? 'open' : 'closed'
          return state + ' ' + pr.id + ' ' + '@' + pr.authorName + '\n' +
            '  ssb://' + pr.headRepo + ':' + pr.headBranch + ' ' +
            '→ ' + pr.baseBranch + '\n' +
            '  ' + u.formatTitle(pr.text, 77) + '\n'
        }),
        pull.drain(function (line) {
          console.log(line)
        }, function (err) {
          if (err) throw err
          process.exit(0)
        })
      )
    })
  })
}


