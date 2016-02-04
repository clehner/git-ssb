var gitFastImportSink = require('git-fast-import-parser')
var utf8 = require('pull-utf8-decoder')
var crypto = require('crypto')
var packCodec = require('js-git/lib/pack-codec')
var pull = require('pull-stream')
var pkg = require('./package')

var options = {
  verbosity: 1,
  progress: false
}

function handleOption(name, value) {
  switch (name) {
    case 'verbosity':
      options.verbosity = +value || 0
      // console.error("ok verbo")
      return true
    case 'progress':
      options.progress = !!value && value !== 'false'
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
    // 'import',
    // 'export',
    'connect',
    'refspec refs/heads/*:refs/ssb/heads/*',
    'refspec refs/tags/*:refs/ssb/tags/*',
  ].join('\n') + '\n\n')
}

function split2(str) {
  var i = str.indexOf(' ')
  return (i === -1) ? [str, ''] : [
    str.substr(0, i),
    str.substr(i + 1)
  ]
}

function optionSource(cmd) {
  var args = split2(cmd)
  var msg = handleOption(args[0], args[1])
  msg = (msg === true) ? 'ok'
      : (msg === false) ? 'unsupported'
      : 'error ' + msg
  return endSource(msg + '\n')
}

function listSource() {
  return endSource([
    /* TODO */
  ].join('\n') + '\n\n')
}

function createHash() {
  var hash = crypto.createHash('sha256')
  var hasher = pull.through(function (data) {
    hash.update(data)
  }, function () {
    hasher.digest = '&'+hash.digest('base64')+'.sha256'
  })
  return hasher
}

function uploadPack(read) {
  return function (abort, cb) {
    cb('upload pack not implemented')
  }
  // throw new Error('upload pack')
}

// wrap a js-git function to turn it into a through
function throughEmit(read, fn) {
  var ended
  var queue = [], decode = fn(function emit(data) {
    queue.push(data)
  })

  return function readDecode(abort, cb) {
    if (ended) return cb(ended)
    if (queue.length) {
      var obj = queue.shift()
      return cb(obj ? null : true, obj)
    }
    read(abort, function (end, data) {
      if (ended = end) {
        decode()
      } else {
        decode(data)
        readDecode(abort, cb)
      }
    })
  }
}

function getRefs() {
  return pull.values([
    {
      hash: '78beaedba9878623cea3862cf18e098cfb901e10',
      name: 'refs/heads/master'
    },
    {
      hash: '78beaedba9878623cea3862cf18e098cfb901e10',
      name: 'refs/remotes/cel/master'
    }
  ])
  /*
  return function (err, cb) {
    if (err === true) return
    if (err) throw err
    // TODO
    cb(true)
  }
  */
}

function packLineEncode(read) {
  var ended
  return function (end, cb) {
    if (ended) return cb(ended)
    read(end, function (end, data) {
      if (ended = end) {
        cb(end)
      } else {
        var len = data ? data.length + 5 : 0
        cb(end, ('000' + len.toString(16)).substr(-4) + data + '\n')
      }
    })
  }
}

function packLineDecode(read) {
  var line = ''
  var bufQueue = []
  var ended

  function readData(end, cb) {
    if (ended)
      cb(ended)
    else if (bufQueue.length)
      cb(end, bufQueue.shift())
    else
      read(end, cb)
  }

  function readLine(abort, cb) {
    cb(new Error('not implemented'))
  }

  return {
    readData: readData,
    readLine: readLine
  }
}

/*
TODO: investigate capabilities
report-status delete-refs side-band-64k quiet atomic ofs-delta
*/

// Get a line for each ref that we have. The first line also has capabilities.
// Wrap with packLineEncode.
function receivePackHeader(capabilities) {
  var readRef = getRefs()
  var first = true
  var ended
  return function (abort, cb) {
    if (ended) return cb(true)
    readRef(abort, function (end, ref) {
      ended = end
      var name = ref && ref.name
      var hash = ref && ref.hash
      if (first) {
        first = false
        if (end) {
          // use placeholder data if there are no refs
          hash = '0000000000000000000000000000000000000000'
          name = 'capabilities^{}'
        }
        name += '\0' + capabilities.join(' ')
      } else if (end) {
        return cb(true)
      }
      cb(null, hash + ' ' + name)
    })
  }
}

function receiveActualPack(read, onObject, onEnd) {
  var decoder
  decoder = throughEmit(read, packCodec.decodePack)
  decoder(null, function next(end, data) {
    if (end)
      return onEnd(end === true ? null : end)
    var err = onObject(data)
    decoder(err, next)
  })
}

function concat() {
  var sources = [].slice.call(arguments)
  var ended
  return function read(abort, cb) {
    if (ended) return cb(ended)
    if (sources.length === 0) return cb(true)
    sources[0](abort, function (end, data) {
      if (end === true) {
        sources.shift()
        read(abort, cb)
      } else if (ended = end) {
        cb(end)
      } else {
        cb(null, data)
      }
    })
  }
}

function receivePack(read) {
  var ended
  var sendRefs = receivePackHeader([
    'agent=git-remote-ssb/' + pkg.version
  ])

  /*
  var theirRefs = receivePackLineDecode(read)
  theirRefs(null, function (caps) {
    console.error('caps', caps)
  }, function next(end, ref) {
    console.error('ref', end, ref)
    if (end === true) {
      receiveActualPack(read, gotObject, function onDone(err) {
        if (err);
      })
    } else if (end) {
      ended = end
    } else {
      read(null, next)
    }
  })
  */

  function receiveRefs(readLine, cb) {
    var refs = []
    readLine(null, function (end, line) {
      if (end) {
        if (end === true)
          end = new Error('refs line ended early')
        cb(end, refs)
      } else if (line === '') {
        cb(null, refs)
      } else {
        var args = split2(line)
        refs.push({
          hash: args[0],
          name: args[1]
        })
      }
    })
  }

  function gotObject(obj) {
    // got a git object from the received pack
    console.error('object', end, data)
  }

    // if (ended) return cb(ended)
  return packLineEncode(
    concat(
      sendRefs,
      pull.once(''),
      function (abort, cb) {
        if (abort) return
        var lines = packLineDecode(read)
        receiveRefs(lines.readLine, function (err, refs) {
          console.error('refs', refs, err)
          if (err) return cb(err)
          receiveActualPack(lines.readData, gotObject, function (err) {
            if (err) return cb(err)
            cb(true)
          })
        })
      },
      pull.once('unpack ok')
    )
  )
}

function prepend(data, read) {
  var done
  return function (end, cb) {
    if (done) {
      read(end, cb)
    } else {
      done = true
      cb(null, data)
    }
  }
}

function handleConnect(cmd, read) {
  var args = split2(cmd)
  switch (args[0]) {
    case 'git-upload-pack':
      return prepend('\n', uploadPack(read))
    case 'git-receive-pack':
      return prepend('\n', receivePack(read))
    default:
      return pull.error(new Error('Unknown service ' + args[0]))
  }
}

function handleCommand(line, read) {
  var args = split2(line)
  switch (args[0]) {
    case 'capabilities':
      return capabilitiesSource()
    case 'list':
      return listSource()
    case 'connect':
      return handleConnect(args[1], read)
    case 'option':
      return optionSource(args[1])
    default:
      return pull.error(new Error('Unknown command ' + args[0]))
  }
}

// transform a readable into a readable that can be read by line or as data
function liner(read) {
  var line = ''
  var bufQueue = []
  var ended

  function readData(end, cb) {
    if (ended)
      cb(ended)
    else if (bufQueue.length)
      cb(end, bufQueue.shift())
    else
      read(end, cb)
  }

  function readLine(abort, cb) {
    readData(abort, function next(end, buf) {
      if (ended = end) return cb(end)
      var i = buf.indexOf('\n')
      if (i === -1) {
        line += buf.toString('ascii')
        read(null, next)
      } else {
        var l = line + buf.toString('ascii', 0, i)
        line = ''
        if (i + 1 < buf.length)
          bufQueue.push(buf.slice(i + 1))
        cb(null, l)
      }
    })
  }

  return {
    readData: readData,
    readLine: readLine
  }
}

// protocol: commands separated by newlines, followed by optional payload.
// utf8-decode and buffer each command line

// command: string -> source
// e.g. git says list. we respond with list of refs

module.exports = function (sbot) {
  var ended

  return function (read) {
    var lines = liner(read)
    var command

    function getCommand(cb) {
      lines.readLine(null, function (end, line) {
        if (ended = end)
          return cb(end)

        if (options.verbosity > 1)
          console.error('command:', line)

        var cmdSource = handleCommand(line, lines.readData)
        cb(null, cmdSource)
      })
    }

    return function next(abort, cb) {
      if (ended) return cb(ended)

      if (!command) {
        if (abort) return
        getCommand(function (end, cmd) {
          command = cmd
          next(end, cb)
        })
        return
      }

      command(abort, function (err, data) {
        if (err) {
          command = null
          if (err !== true)
            cb(err, data)
          else
            next(abort, cb)
        } else {
          cb(null, data)
        }
      })
    }
  }
}
