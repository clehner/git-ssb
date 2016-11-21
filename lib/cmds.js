exports.aliases = {
  'prs': 'pull-requests'
}

exports.cmds = [
  'create',
  'fork',
  'forks',
  'help',
  'issues',
  'name',
  'pull-request',
  'pull-requests',
  'version',
  'web',
]

exports.getCmd = function (cmd) {
  if (!cmd) return 'index'
  cmd = exports.aliases[cmd] || cmd
  if (exports.cmds.indexOf(cmd) < 0) return null
  return cmd
}
