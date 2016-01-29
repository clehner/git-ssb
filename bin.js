#!/usr/bin/env node

var ref = require('ssb-ref')
var ssbKeys = require('ssb-keys')
var path = require('path')
var toPull = require('stream-to-pull-stream')
var pull = require('pull-stream')

var args = process.argv.slice(2)
if (args.length < 2)
  throw new Error('Not enough arguments')

var alias = args[0]
var url = args[1]

var m = url.match(/^ssb:(?:\/\/)?(.*)$/)
var root = m && m[1]
if (!ref.isMsgId(root))
    throw new Error(root || 'URL', 'is not a valid SSB message ID')

var gitSsbConfig = require('parse-git-config').sync()['remote-ssb']
var appName = gitSsbConfig.appname || process.env.ssb_appname
var ssbConfig = require('ssb-config/inject')(appName, gitSsbConfig)

var keys = ssbKeys.loadOrCreateSync(path.join(ssbConfig.path, 'secret'))
require('ssb-client')(keys, {
  port: ssbConfig.port,
  host: ssbConfig.host || 'localhost'
}, function (err, sbot) {
  if (err) throw err
  pull(
    toPull(process.stdin),
    require('.')(sbot),
    toPull(process.stdout, function (err) {
      sbot.close(err, function (err) {
        if (err) throw err
      })
    })
  )
})
