var fs = require('fs')
var u = require('./util')
var multicb = require('multicb')
var Mentions = require('ssb-mentions')

function splitEnd(str) {
  return str ? /(?:(.*?):)?(.*)/.exec(str).slice(1) : []
}

function mdLink(text, href) {
  return !text || text == href ? href : '[' + text + '](' + href + ')'
}

function getRev(repo, branch, cb) {
  var Repo = require('pull-git-repo')
  Repo(repo).resolveRef(branch, function (err, rev) {
    if (err && err.name === 'NotFoundError') err = null
    cb(null, rev)
  })
}

function formatGitLog(a, b) {
  var range = a + '..' + b
  try {
    // https://github.com/github/hub/blob/master/git/git.go
    return u.gitSync('log', '--no-color', '--cherry',
      '--format=%h (%aN, %ar)%n%w(78,3,3)%s%n%+b', range)
  } catch(e) {
    return '`git log ' + range + '`'
  }
}

module.exports = function pullRequest(argv) {
  if (argv.help || argv._.length > 0) return require('./help')('pull-requests')

  var head = splitEnd(argv.head || argv.h)
  var headRepoId = u.getRemote(head[0])
  var headBranch = head[1] || u.getCurrentBranch()
  if (!headRepoId || !headBranch) throw 'unable to find head'

  var text = argv.message || argv.m
  var filename = argv.file || argv.F
  if (text && filename)
    throw 'only one of message and file option may be specified'
  if (filename && !fs.existsSync(filename))
    throw 'file ' + JSON.stringify(filename) + ' does not exist'

  var base = splitEnd(argv.base || argv.b)
  var baseRepoId = base[0]
  var baseBranch = base[1]
  if (baseRepoId) {
    baseRepoId = u.getRemote(baseRepoId)
    if (!baseRepoId) throw 'invalid base repo ' + JSON.stringify(base[0])
  }

  var ssbGit = require('ssb-git-repo')
  var sbot
  var done = multicb({pluck: 1, spread: true})
  var gotFeed = done()
  var gotHeadRepo = done()
  var gotBaseRepo = done()
  u.getSbot(argv, function (err, _sbot) {
    if (err) throw err
    sbot = _sbot
    sbot.whoami(gotFeed)
    ssbGit.getRepo(sbot, headRepoId, gotHeadRepo)
    if (baseRepoId) ssbGit.getRepo(sbot, baseRepoId, gotBaseRepo)
    else gotBaseRepo()
  })

  done(function (err, feed, headRepo, baseRepo) {
    if (err) throw err
    sbot.id = feed.id

    // default base repo to upstream of head repo, or head repo
    // default base branch to base repo's default branch
    if (!baseRepo) {
      if (headRepo.upstream) {
        baseRepo = headRepo.upstream
      } else {
        baseRepo = headRepo
      }
      baseRepoId = baseRepo.id
    }

    if (baseBranch) next()
    else baseRepo.getHead(function (err, ref) {
      if (err) throw err
      baseBranch = ref && ref.replace(/refs\/heads\//, '') || 'master'
      next()
    })

    function next() {
      if (text) gotText(text, doneEditing)
      else if (filename) fs.readFile(filename, 'utf8', gotText)
      else {
        var done = multicb({pluck: 1, spread: true})
        u.getName(sbot, [sbot.id, null], baseRepoId, done())
        u.getName(sbot, [sbot.id, null], headRepoId, done())
        getRev(baseRepo, baseBranch, done())
        getRev(headRepo, headBranch, done())
        done(editText)
      }
    }
  })

  function editText(err, baseRepoName, headRepoName, baseRev, headRev) {
    if (err) throw err
    var defaultText = 'Requesting a pull ' +
      'to ' + mdLink(baseRepoName, baseRepoId) + ':' + baseBranch + '\n' +
      'from ' + mdLink(headRepoName, headRepoId) + ':' + headBranch + '\n\n' +
      'Write message text for this pull request.' +
      (baseRev && headRev
        ? '\n\nChanges:\n\n' + formatGitLog(baseRev, headRev)
        : '')
    u.editor('PULLREQ', defaultText, gotText, doneEditing)
  }

  function gotText(text, cb) {
    if (!text) return cb('empty message: aborting')
    var prSchemas = require('ssb-pull-requests/lib/schemas')
    var value = prSchemas.new(baseRepoId, baseBranch,
      headRepoId, headBranch, text)
    var mentions = Mentions(text)
    if (mentions.length) value.mentions = mentions
    sbot.publish(value, function (err, msg) {
      if (err) return cb(err)
      console.log(JSON.stringify(msg, 0, 2))
      cb(null)
    })
  }

  function doneEditing(err) {
    if (err) console.error(err)
    sbot.close()
  }
}
