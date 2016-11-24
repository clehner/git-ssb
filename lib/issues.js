var pull = require('pull-stream')
var paramap = require('pull-paramap')
var u = require('./util')
var getAbout = require('ssb-avatar')
var Issues = require('ssb-issues')

module.exports = function (argv) {
  if (argv._.length > 1) return require('./help')('issues')

  process.stderr.write('Loading issues...\r')
  var id = u.getRemote(argv._[0])
  if (!id) throw 'unable to find git-ssb repo'

  var open = u.issueStateBool(argv)

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    sbot.whoami(function (err, feed) {
      if (err) throw err
      var issues = Issues.init(sbot)
      pull(
        issues.list({
          project: id,
          open: open
        }),
        paramap(function (issue, cb) {
          getAbout(sbot, feed.id, issue.author, function (err, authorAbout) {
            issue.authorName = authorAbout.name
            cb(err, issue)
          })
          // TODO: show issue petnames?
        }, 8),
        pull.map(function (issue) {
          return issue.id + ' ' +
            '@' + issue.authorName + ' ' +
            (open == null ? issue.open ? 'open: ' : 'closed: ' : '') +
            u.formatTitle(issue.text, 60)
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

