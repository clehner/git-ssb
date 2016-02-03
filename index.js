var gitFastImportSink = require('git-fast-import-parser')
var utf8 = require('pull-utf8-decoder')
var crypto = require('crypto')
var packCodec = require('js-git/lib/pack-codec')

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
  return function (err, cb) {
    if (err === true) return
    if (err) throw err
    // TODO
    cb(true)
  }
}

function receivePackLineEncode(read) {
  //return a readable function!
  return function (end, cb) {
    read(end, function (end, data) {
      var len = data ? data.length : 0
      cb(end, ('000' + len.toString(16)).substr(-4) + data + '\n')
    })
  }
}

var capabilitiesList = [
  'delete-refs',
]

function receivePackHeader() {
  var readRef = getRefs()
  var first = true
  return receivePackLineEncode(function (abort, cb) {
    readRef(abort, function (end, hash, ref) {
      if (first) {
        first = false
        if (end) {
          hash = '0000000000000000000000000000000000000000'
          ref = 'capabilities^{}'
        }
        ref += '\0' + capabilitiesList.join(' ')
      }
      cb(end, hash + ' ' + ref)
    })
  })
}

function receivePack() {
  var decoder

  return function (abort, cb) {
    cb(new Error('receive pack not implemented'))
  }

  /*
  var ourRefs = receivePackHeader()

  return {
    sink: function (read) {
      console.error('recieve pack sink')
      decoder = throughEmit(read, packCodec.decodePack)
      decoder(null, function (end, data) {
        console.error('object', end, data)
      })
    },

    source: function (end, cb) {
      console.error('receive pack source')
      // if (end) return cb(end)
      if (ourRefs) {
        ourRefs(end, cb)
      }
    }
  }
  */
}

function handleCommand(line, read) {
  if (line == 'capabilities')
    return capabilitiesSource()

  if (line == 'list')
    return listSource()

  if (line == 'connect git-upload-pack')
    return uploadPack(read)

  if (line == 'connect git-receive-pack')
    return receivePack(read)

  if (line.substr(0, 6) == 'option')
    return optionSource(line)

  return function (abort, cb) {
    cb(new Error('unknown command ' + line))
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

        var cmdSource = handleCommand(line)
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
