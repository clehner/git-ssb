#!/bin/sh
':' //; exec "$(command -v node || command -v nodejs)" "$0" "$@"
// http://unix.stackexchange.com/questions/65235/universal-node-js-shebang

try {
  main()
} catch(e) {
  console.error(e instanceof Error ? e.stack : e)
  process.exit(1)
}

function main() {
  var path = require('path')
  switch (path.basename(process.argv[1])) {
    case 'git-remote-ssb':
      return require('git-remote-ssb/git-remote-ssb')
  }

  var config = require('ssb-config/inject')(getAppName())
  var cmd = config._.shift()
  if (config.help)
    return require('./lib/help')(cmd)
  if (config.version)
    return version()

  switch (cmd) {
    case 'create':
      return require('./lib/create')(config, config._[0], config._[1])
    case 'fork':
      return require('./lib/fork')(config)
    case 'forks':
      return require('./lib/forks')(config)
    case 'issues':
      return require('./lib/issues')(config)
    case 'prs':
    case 'pull-requests':
      return require('./lib/pull-requests')(config)
    case 'name':
      return require('./lib/name')(config)
    case 'pull-request':
      return require('./lib/pull-request')(config)
    case 'web':
      return require('git-ssb-web/server')
    case 'help':
      return require('./lib/help')(config._[0])
    case 'version':
      return version()
    case undefined:
      return require('./lib/help')()
    default:
      throw 'No such command \'' + cmd + '\''
  }
}

function version() {
  var pkg = require('./package')
  console.log(pkg.name, pkg.version)
}

function getAppName() {
  var proc = require('child_process')
  return 'ssb_appname' in process.env ? process.env.ssb_appname :
    proc.spawnSync('git', ['config', 'ssb.appname']).stdout.toString().trim()
}
