#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
// http://unix.stackexchange.com/questions/65235/universal-node-js-shebang
// vi: ft=javascript

var path = require('path')

var progname = path.basename(process.argv[1])
if (progname == 'git-remote-ssb') {
  require('git-remote-ssb/git-remote-ssb')
  return
}

var spawn = require('child_process').spawn
var ssbGit = require('ssb-git-repo')
var pull = require('pull-stream')

var args = process.argv.slice(2)
switch (args[0]) {
  case 'create':
    createRepo(args[1] || 'ssb')
    break

  case 'web':
    startServer(args[1])
    break

  case undefined:
  case '-h':
    console.log([
      'Usage: git ssb [command]',
      '',
      'Commands:',
      '  create    Create a git repo on SSB.',
      '  web       Serve a web server for repos.',
    ].join('\n'))
    process.exit(0)

  default:
    console.error([
      'Usage: git ssb [command]',
      '',
      'No such command "' + args[0] + '"'
    ].join('\n'))
    process.exit(1)
}

function getSbot(cb) {
  require('./lib/client')(cb)
}

function createRepo(remoteName) {
  getSbot(function (err, sbot) {
    if (err) throw err
    ssbGit.createRepo(sbot, function (err, repo) {
      if (err) throw err
      var url = 'ssb://' + repo.id
      console.log(url)
      repo.close()
      sbot.close()
      spawn('git', ['remote', 'add', remoteName, url], {stdio: 'inherit'})
    })
  })
}

function startServer(listenAddr) {
  getSbot(function (err, sbot) {
    if (err) throw err
    require('git-ssb-web')(sbot, listenAddr, function (err) {
      sbot.close()
      if (err) throw err
    })
  })
}
