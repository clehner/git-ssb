var fs = require('fs')
var u = require('./util')
var multicb = require('multicb')

function splitEnd(str) {
  return str ? /(?:(.*?):)?(.*)/.exec(str).slice(1) : []
}

function mdLink(text, href) {
  return !text || text == href ? href : '[' + text + '](' + href + ')'
}

module.exports = function pullRequest(argv) {
  var head = splitEnd(argv.head || argv.h)
  var headRepoId = u.getRemote(head[0] || u.getDefaultRemote())
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
  var sbot
  u.getSbot(argv, function (err, _sbot) {
    if (err) throw err
    sbot = _sbot

    sbot.whoami(function (err, feed) {
      if (err) throw err
      sbot.id = feed.id
    })

    if (baseRepoId && baseBranch) return next()

    // default base repo to upstream of head repo
    // default base branch to base repo's default branch
    var ssbGit = require('ssb-git-repo')
    if (baseRepoId) ssbGit.getRepo(sbot, baseRepoId, gotBaseRepo)
    else ssbGit.getRepo(sbot, headRepoId, function (err, headRepo) {
      if (err) throw err
      if (headRepo.upstream) {
        baseRepoId = headRepo.upstream.id
        gotBaseRepo(null, headRepo.upstream)
      } else {
        throw 'unable to find base repo'
      }
    })
  })

  function gotBaseRepo(err, baseRepo) {
    if (err) throw err
    if (baseBranch) next()
    else baseRepo.getHead(function (err, ref) {
      if (err) throw err
      baseBranch = ref && ref.replace(/refs\/heads\//, '') || 'master'
      next()
    })
  }

  function next() {
    if (text) gotText(null, text)
    else if (filename) fs.readFile(filename, 'utf8', gotText)
    else {
      var done = multicb({pluck: 1, spread: true})
      u.getName(sbot, [sbot.id, null], baseRepoId, done())
      u.getName(sbot, [sbot.id, null], headRepoId, done())
      done(function (err, baseRepoName, headRepoName) {
        if (err) throw err
        var defaultText = 'Requesting a pull ' +
          'to ' + mdLink(baseRepoName, baseRepoId) + ':' + baseBranch + '\n' +
          'from ' + mdLink(headRepoName, headRepoId) + ':' + headBranch + '\n\n' +
        'Write message text for this pull request.'
        u.editor('PULLREQ', defaultText, gotText)
      })
    }
  }

  function gotText(err, text) {
    if (err) throw err
    if (!text) throw 'empty message: aborting'
    var prSchemas = require('ssb-pull-requests/lib/schemas')
    var value = prSchemas.new(baseRepoId, baseBranch,
      headRepoId, headBranch, text)
    return console.log(JSON.stringify(value, 0, 2)), sbot.close()
    sbot.publish(value, function (err, msg) {
      if (err) throw err
      console.log(JSON.stringify(msg, 0, 2))
      sbot.close()
    })
  }
}
