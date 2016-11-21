var pull = require('pull-stream')
var paramap = require('pull-paramap')
var u = require('./util')
var getAbout = require('ssb-avatar')

function getRepoUpdates(sbot, repoMsg, includeMerged) {
  // includeMerged: include updates pushed to downstream (fork) repos
  // which are merged into the upstream

  var commitsInUpstream = {}
  function gotUpstreamCommit(commit) {
    commitsInUpstream[commit.sha1] = true
  }
  function isCommitInUpstream(commit) {
    return commit && commitsInUpstream[commit.sha1]
  }

  return pull(
    includeMerged ? u.getForks(sbot, repoMsg) : pull.once(repoMsg),
    pull.map(function (msg) {
      return sbot.links({
        dest: msg.key,
        rel: 'repo',
        values: true,
        reverse: true,
      })
    }),
    pull.flatten(),
    pull.filter(function (msg) {
      var c = msg.value.content
      if (c.type !== 'git-update') return false
      if (!includeMerged) return true
      var commits = Array.isArray(c.commits) ? c.commits : []
      // upstream messages come first
      if (c.repo === repoMsg.key) {
        // keep track of commits in upstream
        commits.forEach(gotUpstreamCommit)
        return true
      } else {
        // update to a fork. only include if it was later merged upstream.
        return commits.some(isCommitInUpstream)
      }
    })
  )
}

module.exports = function (argv) {
  var repoId = u.getRemote(argv._[0])
  if (!repoId) throw 'unable to find git-ssb repo'
  var noForks = argv.forks === false || argv.n === true

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    sbot.whoami(function (err, feed) {
      if (err) throw err
      sbot.get(repoId, function (err, value) {
        if (err) throw err
        next(sbot, feed.id, {key: repoId, value: value})
      })
    })
  })

  function next(sbot, myId, repoMsg) {
    pull(
      getRepoUpdates(sbot, repoMsg, !noForks),
      pull.unique(function (msg) {
        return msg.value.author
      }),
      paramap(function (msg, cb) {
        getAbout(sbot, myId, msg.value.author, function (err, about) {
          if (err) return cb(err)
          cb(null, `${msg.key} ${msg.value.author} @${about.name}`)
        })
      }, 8),
      pull.log(function (err) {
        if (err) throw err
        sbot.close()
      })
    )
  }
}
