#!/bin/sh
':' //; exec "$(command -v node || command -v nodejs)" "$0" "$@"
// http://unix.stackexchange.com/questions/65235/universal-node-js-shebang

if (/\/git-remote-ssb$/.test(process.argv[1])) {
  require('git-remote-ssb/git-remote-ssb')

} else {
  var u = require('./lib/util')
  var config = require('ssb-config/inject')(u.getAppName())
  var fn = require('./lib')
  try {
    fn(config)
  } catch (e) {
    console.error(e instanceof Error ? e.stack : e)
    process.exit(1)
  }
}
