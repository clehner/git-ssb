var toPull = require('stream-to-pull-stream')
var GitFastImportParser = require('git-fast-import-parser')

var verbosity = 1

function handleOption(name, value) {
  switch (name) {
    case 'verbosity':
      verbosity = +value || 0
      // console.error("ok verbo")
      return true
    case 'progress':
      progress = !!value && value !== 'false'
      return true
    default:
      console.error('unknown option', name + ': ' + value)
      return false
  }
}

function capabilitiesCmd(read) {
  read(null, function next(end, data) {
    if(end === true) return
    if(end) throw end

    console.log(data)
    read(null, next)
  })
}

// return a source that delivers some data and then ends
// TODO: use pull.once and abortCb for this
function endSource(data) {
  var done
  return function (end, cb) {
    if (done) return cb(true)
    done = true
    cb(null, data)
  }
}

function capabilitiesSource() {
  return endSource([
    'option',
    'import',
    'export',
    'refspec refs/heads/*:refs/ssb/heads/*',
    'refspec refs/tags/*:refs/ssb/tags/*',
  ].join('\n') + '\n\n')
}

function optionSource(line) {
  var m = line.match(/^option ([^ ]*) (.*)$/)
  var msg
  if (!m) {
    msg = 'error missing option'
  } else {
    msg = handleOption(m[1], m[2])
    msg = (msg === true) ? 'ok'
        : (msg === false) ? 'unsupported'
        : 'error ' + msg
  }
  return endSource(msg + '\n')
}

function listSource() {
  return endSource([
    /* TODO */
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

// return a duplex
// source part handles command response data
// sink part handles a payload (optional)
function handleCommand(line, cb) {
  if (verbosity > 1)
    console.error('command:', line)
  if (line == 'capabilities')
    return {
      source: capabilitiesSource()
    }
  if (line == 'list')
    return {
      source: listSource()
    }
  if (line == 'export')
    return {
      sink: gitFastImportSink
    }
  if (line.indexOf('option') === 0)
    return {
      source: optionSource(line)
    }
  throw new Error('Unknown command ' + line)
}

// protocol: commands separated by newlines, followed by optional payload.
// utf8-decode and buffer each command line

// command: string -> source
// e.g. git says list. we respond with list of refs

module.exports = function (sbot) {
  var commandSource
  var readNext
  var sourceCb

  function source(end, cb) {
    // console.error('SRC')
    if (commandSource) {
      commandSource(end, function (end, data) {
        // console.error('cmd source', end, JSON.stringify(data))
        if (end === true) {
          // console.error('READ next'),
          sourceCb = cb
          readNext()
        } else if (end) {
          throw err // TODO
        } else {
          // console.error('CB'),
          cb(end, data)
        }
      })
      // sourceCb = null
    } else {
      sourceCb = cb
    }
  }

  function sink(read) {
    var payloadBuf
    var inPayload = false
    var commandLine = ''

    function payloadRead(end, cb) {
      if (end) return read(end)
      if (payloadBuf) {
        // read initial buffered chunk of payload
        var buf = payloadBuf
        payloadBuf = null
        // payloadCb = cb
        cb(null, buf)
      } else {
        // pass the rest of the stream to the payload sink
        read(end, cb)
      }
    }

    read(null, function next(end, buf) {
      if (inPayload)
        throw new Error('in payload')
        // return payloadCb(end, buf)

      if (end === true) return console.error('end')
      if (end) throw end

      if (verbosity > 2)
        console.error('>', end || JSON.stringify(buf.toString('utf8')))

      // TODO: make this UTF8-safe
      var i = buf.indexOf('\n')
      if (i === 0) {
        // console.error('commands done being sent')
        // got empty line: commands are done
        inPayload = true
        if (!payloadSink)
          return read(true, function () {
            console.error('no payload sink')
          })
        payloadBuf = buf.slice(1)
        payloadSink(payloadRead)
      } else if (i === -1) {
        // console.error('in command')
        // got part of a command
        commandLine += buf.toString('utf8')
        read(null, next)
      } else {
        // console.error('and more')
        // got command line and more
        commandLine += buf.toString('utf8', 0, i)
        var cmd = handleCommand(commandLine)
        commandLine = ''
        payloadSink = cmd.sink
        commandSource = cmd.source
        var nextBuf = buf.slice(i + 1)
        readNext = function () {
          // console.error('reading next')
          if (nextBuf.length)
            next(null, nextBuf)
          else
            read(null, next)
        }
        // console.error('cmd', commandLine, 'sourcecb', sourceCb)
        if (sourceCb)
          // console.error('SRCCB'),
          source(null, sourceCb)
      }
    })
  }

  return {
    source: source,
    sink: sink
  }
}
