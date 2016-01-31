var toPull = require('stream-to-pull-stream')
var GitFastImportParser = require('git-fast-import-parser')
var utf8 = require('pull-utf8-decoder')

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

/*
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

function capabilitiesCmd(read) {
  read(null, function next(end, data) {
    if(end === true) return
    if(end) throw end

    console.log(data)
    read(null, next)
  })
}

*/

/*
var map = function (read, map) {
  //return a readable function!
  return function (end, cb) {
    read(end, function (end, data) {
      cb(end, data != null ? map(data) : null)
    })
  }
}
*/

// return a source that delivers some data and then ends
function endSource(data) {
  var done
  return function (end, cb) {
    if (done) return cb(true)
    done = true
    cb(null, data)
  }
}

function capabilities() {
  return endSource([
    'option',
    'import',
    'export',
    'refspec refs/heads/*:refs/ssb/heads/*',
    'refspec refs/tags/*:refs/ssb/tags/*',
  ].join('\n') + '\n\n')
}

function gitFastImportSink(read) {
  read(end, function next(end, data) {
    if (end === true) return
    if (end) throw end

    console.error('git fast import:', data)
    read(null, next)
    // throw new Error('Not implemented')
  })
}

// handle a command.
// return a source for command response data
function command(line, payloadSinkCb) {
  if (line == 'capabilities')
    return capabilities()
  else if (line == 'export')
    return function (end, cb) {
      if (end) return cb(end)
      payloadSinkCb(gitFastImportSink)
      cb(true)
    }
  else
    return function (end, cb) {
      cb(new Error('Unknown command ' + line))
    }
}

// commands through. reads command line strings. writes data.
// calls payloadSinkCb with a sink for payload data following the commands
function commands(read, payloadSinkCb) {
  var commandSource
  return function (end, cb) {
    if (commandSource)
      commandSource(end, cb)
    else
      read(end, function (end, line) {
        if (end) return cb(end)
        commandSource = command(line, function (err, payloadSink) {
          if (err) return cb(err)
          payloadSinkCb(payloadSink)
          cb(true)
        })
        commandSource(null, cb)
      })
  }
}

// protocol: commands separated by newlines, followed by optional payload.
// utf8-decode and buffer each command line

// command: string -> source
// e.g. git says list. we respond with list of refs

module.exports = function (sbot) {
  var inPayload = false, payloadSink
  var utf8Decoder = utf8()
  var commandLine = ''
  return function (read) { // sink. reader to stdin
    return function (abort, cb) { // source. read to stdout
      if (inPayload)
        return cb(true)
        // return payloadSink(read)

    var commandsReader = commands(utf8Decoder(read), function (plSink) {
      payloadSink = plSink
    })

      utf8Decoder(read)(abort, function (end, data) {
        commandsReader(end, )

        var i = data.indexOf('\n')
        if (i === 0) {
          // commands done
          beginPayload()
          inPayload = true
        if (i === -1) {
          commandLine += data
          cb() // wait for more data
        } else {
          var _commandLine = commandLine + data.substr(0, i)
          commandLine = ''
          handleCommand(_commandLine, function (err, plSink) {
            // response(null, data.substr(i + 1))
            payloadSink = plSink
            cb(data, err)
          })
          // there should only be a few commands, so it should be okay
          // without looper here
          return commandsRead(end, data.substr(i + 1))
        }
        /*
        var j = data.indexOf('\n', i)
          if (j > i) {
            commandLine += data.substring(i, j)
            gotCommandLine(commandLine)
            commandLine = ''
          } else if (j === i) {
            commandsDone(function (err, plSink) {
              payloadSink = plSink
              if (err)
                cb(err)
            })
            // inPayload = true
          } else {
            commandLine += data
          }
        }
        */

        // console.error('data', data)
        if (end) {
          cb(end)
        } else {
          if (0);
          // cb(null, data)
        }
      })
    }
  }
}
