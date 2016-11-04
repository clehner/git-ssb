var pull = require('pull-stream')
var paramap = require('pull-paramap')
var u = require('./util')
var getAbout = require('ssb-avatar')
var Issues = require('ssb-issues')

function formatTitle(str) {
  var len = 60
  str = String(str).replace(/[\n\r\t ]+/g, ' ')
  if (str.length > len) str = str.substr(0, len) + '…'
  return str
}

module.exports = function (argv) {
  var id = u.repoId(u.getRemoteUrl(argv._[0])) || u.getDefaultRemote()
  if (!id)
    err(1, 'unable to find git-ssb repo')

  var open =
    argv.all || (argv.open && argv.closed) ? null :
    argv.open ? true :
    argv.closed ? false :
    true

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
            formatTitle(issue.text)
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

