#!/usr/bin/env node

var ref = require('ssb-ref')
var ssbKeys = require('ssb-keys')
var path = require('path')
var LinerStream = require('linerstream')
var GitFastImportParser = require('git-fast-import-parser')

function createSsbClient(cb) {
  var keys = ssbKeys.loadOrCreateSync(path.join(ssbConfig.path, 'secret'))
  require('ssb-client')(keys, {
    port: config.port,
    host: config.host || 'localhost'
  }, cb)
}

function die() {
  console.error.apply(console, arguments)
  process.exit(1)
}

var args = process.argv.slice(2)
if (args.length < 2)
  die('Not enough arguments')

var alias = args[0]
var url = args[1]

var m = url.match(/^ssb:(?:\/\/)?(.*)$/)
var root = m && m[1]
if (!ref.isMsgId(root))
    die(root || 'URL', 'is not a valid SSB message ID')

var gitSsbConfig = require('parse-git-config').sync()['remote-ssb']
var appName = gitSsbConfig.appname || process.env.ssb_appname
var ssbConfig = require('ssb-config/inject')(appName, gitSsbConfig)

0 &&
createSsbClient(function (err, sbot) {
  if (err) throw err
})

function printList(lines) {
  process.stdout.write(lines.concat('', '').join('\n'))
}

var verbosity = 1

function handleOption(name, value) {
  switch (name) {
    case 'verbosity':
      verbosity = +value || 0
      break
    default:
      return false
  }
}

var liner = process.stdin.pipe(new LinerStream())
liner.on('data', function (line) {
  console.error('>', line)
  if (line == 'capabilities') {
    printList([
      // 'fetch',
      // 'push',
      // 'list',
      'option',
      'import',
      'export',
      'refspec refs/heads/*:refs/ssb/heads/*',
      'refspec refs/tags/*:refs/ssb/tags/*',
    ])
  } else if (line == 'list' || line == 'list for-push') {
    // get refs
    printList([
      // value name [attr..]
      // sha name [attr..]
      // '@refs/heads/' + head + ' HEAD'
    ])
  } else if (line == 'export') {
    process.stdin.pipe(new GitFastImportParser())
  } else if (line.indexOf('option') === 0) {
    var m = line.match(/^option ([^ ]*) (.*)$/)
    var msg
    if (!m) {
      msg = 'error missing option'
    } else try {
      msg = handleOption(m[1], m[2]) === false ? 'unsupported' : 'ok'
    } catch(e) {
      msg = 'error ' + e.message
    }
    process.stdout.write(msg + '\n')
  }
})
