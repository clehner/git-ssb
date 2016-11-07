#!/bin/sh
':' //; exec "$(command -v node || command -v nodejs)" "$0" "$@"
// http://unix.stackexchange.com/questions/65235/universal-node-js-shebang
// vi: ft=javascript

var path = require('path')
var proc = require('child_process')
var u = require('./lib/util')

var prog = 'git ssb'

main()

function main() {
  switch (path.basename(process.argv[1])) {
    case 'git-remote-ssb':
      return require('git-remote-ssb/git-remote-ssb')
  }

  var appName = 'ssb_appname' in process.env ? process.env.ssb_appname :
    proc.spawnSync('git', ['config', 'ssb.appname'],
      {encoding: 'utf8'}).stdout.trim()
  var config = require('ssb-config/inject')(appName)

  var cmd = config._.shift()
  if (config.help)
    return help(cmd)
  if (config.version)
    return version()

  switch (cmd) {
    case 'create':
      return createRepo(config, config._[0], config._[1])
    case 'fork':
      return forkRepo(config)
    case 'forks':
      return require('./lib/forks')(config)
    case 'issues':
      return require('./lib/issues')(config)
    case 'prs':
    case 'pull-requests':
      return require('./lib/pull-requests')(config)
    case 'name':
      return nameRepo(config)
    case 'pull-request':
      return require('./lib/pull-request')(config)
    case 'web':
      return require('git-ssb-web/server')
    case 'help':
      return help(config._[0])
    case 'version':
      return version()
    case undefined:
      return usage(0)
    default:
      err(1, 'No such command \'' + cmd + '\'')
  }
}

function usage(code) {
  out(
    'Usage: git ssb [--version] [--help] [command]',
    '',
    'Commands:',
    '  create        Create a git repo on SSB',
    '  fork          Fork a git repo on SSB',
    '  forks         List forks of a repo',
    '  issues        List issues for a repo',
    '  prs           List pull requests for a repo',
    '  name          Name a repo',
    '  pull-request  Create a pull-request',
    '  web           Serve a web server for repos',
    '  help          Get help about a command')
  process.exit(code)
}

function version() {
  var pkg = require('./package')
  console.log(pkg.name, pkg.version)
}

function help(cmd) {
  switch (cmd) {
    case 'help':
      return out(
        'Usage: ' + prog + ' help <command>',
        '',
        '  Get help about a git-ssb command',
        '',
        'Options:',
        '  command   Command to get help with')
    case 'create':
      return out(
        'Usage: ' + prog + ' create <remote> [<name>]',
        '',
        '  Create a new git-ssb repo and add it as a git remote',
        '',
        'Arguments:',
        '  remote    Name of the remote to add. e.g. \'origin\' or \'ssb\'',
        '  name      Name to give the repo, if any')
    case 'fork':
      return out(
        'Usage: ' + prog + ' fork [<upstream>] <remote_name>',
        '',
        '  Create a new git-ssb repo as a fork of another repo',
        '  and add it as a git remote',
        '',
        'Arguments:',
        '  upstream      id, url, or git remote name of the repo to fork.',
        '                default: \'origin\' or \'ssb\'',
        '  remote_name   Name for the new remote')
    case 'forks':
      return out(
        'Usage: ' + prog + ' forks [<repo>]',
        '',
        '  List repos that are forks of the given repo',
        '',
        'Arguments:',
        '  repo      id, url, or git remote name of the base repo.',
        '                default: \'origin\' or \'ssb\'')
    case 'issues':
      return out(
        'Usage: ' + prog + ' issues [--all|--open|--closed] [<repo>]',
        '',
        '  List issues about a repo',
        '',
        'Arguments:',
        '  repo      id, url, or git remote name of the repo.',
        '                default: \'origin\' or \'ssb\'',
        'Options:',
        '  --open    Show only open issues (default)',
        '  --closed  Show only closed issues',
        '  --all     Show issues of all state')
    case 'pull-requests':
    case 'prs':
      return out(
        'Usage: ' + prog + ' prs [--all|--open|--closed] [<repo>]',
        '',
        '  List pull requests for a repo',
        '',
        'Arguments:',
        '  repo      id, url, or git remote name of the base repo.',
        '                default: \'origin\' or \'ssb\'',
        'Options:',
        '  --open    Show only open pull requests (default)',
        '  --closed  Show only closed pull-requests',
        '  --all     Show pull requests of all state')
    case 'name':
      return out(
        'Usage: ' + prog + ' name [<repo>] <name>',
        '',
        '  Publish a name for a git-ssb repo',
        '',
        'Arguments:',
        '  repo      id, url, or git remote name of the base repo.',
        '                default: \'origin\' or \'ssb\'',
        '  name      the name to give the repo')
    case 'pull-request':
      return out(
        'Usage: ' + prog + ' pull-request [-b <base>] [-h <head>],',
        '                                 [-m <message> | -F <file>]',
        '',
        '  Create a pull request. This requests that changes from <head>',
        '  be merged into <base>.',
        '',
        'Arguments:',
        '  head      the head repo/branch, in format "[<repo>:]<branch>"',
        '            Defaults to \'origin\' or \'ssb\', and the current branch.',
        '  base      the base repo/branch, in format "[<repo>:]<branch>"',
        '            where <repo> may be a repo id or git remote name.',
        '            Defaults to the upstream of <head>, or <head>,',
        '            and its default branch (usually \'master\')',
        '  message   the text for the pull-request message',
        '  file      name of file from which to read pull-request text')
    case 'web':
      return out(
        'Usage: ' + prog + ' web [<host:port>] [<options>]',
        '',
        '  Host a git ssb web server',
        '',
        'Options:',
        '  host        Host to bind to. default: localhost',
        '  port        Port to bind to. default: 7718',
        '  --public    Make the instance read-only')
    case undefined:
      usage(0)
    default:
      err(1, 'No help for command \'' + cmd + '\'')
  }
}

function out() {
  console.log([].slice.call(arguments).join('\n'))
}

function err(code) {
  var args = [].slice.call(arguments, 1)
  console.error.apply(console, [prog + ':'].concat(args))
  process.exit(code)
}

function hasRemote(name) {
  var child = proc.spawnSync('git', ['remote'], {encoding: 'utf8'})
  var remotes = child.stdout.split(/\n/)
  return !!~remotes.indexOf(name)
}

function createRepo(config, remoteName, name, upstream) {
  if (config._.length == 0) return help('create')
  if (!remoteName) err(1, 'Missing remote name')
  if (hasRemote(remoteName))
    err(1, 'Remote \'' + remoteName + '\' already exists')
  u.getSbot(config, function (err, sbot) {
    if (err) throw err
    var ssbGit = require('ssb-git-repo')
    ssbGit.createRepo(sbot, {
      upstream: upstream,
      name: name
    }, function (err, repo) {
      if (err) throw err
      var url = 'ssb://' + repo.id
      console.log('Created repo:', url, name ? '(' + name + ')' : '')
      proc.spawnSync('git', ['remote', 'add', remoteName, url])
      console.log('Added remote:', remoteName)
      repo.close()
      sbot.close()
    })
  })
}

function forkRepo(argv) {
  var repo
  if (argv._.length == 1) repo = u.getDefaultRemote()
  else if (argv._.length == 2) repo = u.getRemote(argv._.shift())
  else return help('fork')
  if (!repo) err(1, 'unable to find git-ssb upstream repo')
  var name = argv._[0]
  if (!name) err(1, 'missing remote name')

  createRepo(argv, name, null, repo)
}

function nameRepo(argv) {
  var repo
  if (argv._.length == 1) repo = u.getDefaultRemote()
  else if (argv._.length == 2) repo = u.getRemote(argv._.shift())
  else return help('name')
  if (!repo) err(1, 'unable to find git-ssb repo')
  var name = argv._[0]
  if (!name) err(1, 'missing name')

  u.getSbot(argv, function (err, sbot) {
    if (err) throw err
    var schemas = require('ssb-msg-schemas')
    sbot.publish(schemas.name(repo, name), function (err, msg) {
      if (err) throw err
      console.log(msg.key)
      sbot.close()
    })
  })
}
