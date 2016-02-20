#!/usr/bin/env node
var spawn = require('child_process').spawn
var ssbGit = require('ssb-git')
var pull = require('pull-stream')

var args = process.argv.slice(2)
switch (args[0]) {
  case 'create':
    createRepo(args[1] || 'ssb')
    break

  case 'serve':
    startServer(args[1])
    break

  case undefined:
  case '-h':
    console.log([
      'Usage: git ssb [command]',
      '',
      'Commands:',
      '  create    Create a git repo on SSB.',
      '  serve     Serve a web server for repos.',
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
    require('./lib/server')(sbot, listenAddr, function (err) {
      sbot.close()
      if (err) throw err
    })
  })
}
