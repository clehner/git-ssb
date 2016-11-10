var prog = 'git ssb'

module.exports = function (cmd) {
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
    case '':
    case undefined:
      usage(0)
    default:
      throw 'No help for command \'' + cmd + '\''
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

function out() {
  console.log([].slice.call(arguments).join('\n'))
}
