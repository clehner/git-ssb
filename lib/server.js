var http = require('http')
var url = require('url')
var ref = require('ssb-ref')
var pull = require('pull-stream')
var ssbGit = require('ssb-git')
var toPull = require('stream-to-pull-stream')
var cat = require('pull-cat')
var Repo = require('pull-git-repo')

function parseAddr(str, def) {
  if (!str) return def
  var i = str.lastIndexOf(':')
  if (~i) return {host: str.substr(0, i), port: str.substr(i+1)}
  if (isNaN(str)) return {host: str, port: def.port}
  return {host: def.host, port: str}
}

function link(hrefParts, html) {
  var href = '/' + hrefParts.map(encodeURIComponent).join('/')
  return '<a href="' + href + '">' + (html || hrefParts[0]) + '</a>'
}

function timestamp(time) {
  time = Number(time)
  var d = new Date(time)
  return '<span title="' + time + '">' + d.toLocaleString() + '</span>'
}

function json(obj) {
  return '<pre>' + escapeHTML(JSON.stringify(obj, null, 2)) + '</pre>'
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHTMLStream() {
  return pull.map(function (buf) {
    return escapeHTML(buf.toString('utf8'))
  })
}

function readNext(fn) {
  var next
  return function (end, cb) {
    if (next) return next(end, cb)
    fn(function (err, _next) {
      if (err) return cb(err)
      next = _next
      next(null, cb)
    })
  }
}

var msgTypes = {
  'git-repo': true,
  'git-update': true
}

module.exports = function (sbot, listenAddr, onEnd) {
  sbot.on('error', function (err) {
    console.error('SBOT ERROR', err)
  })
  var addr = parseAddr(listenAddr, {host: 'localhost', port: 7718})
  http.createServer(onRequest).listen(addr.port, addr.host, onListening)

  function onListening() {
    var host = ~addr.host.indexOf(':') ? '[' + addr.host + ']' : addr.host
    console.error('Listening on http://' + host + ':' + addr.port + '/')
  }

  /* Serving a request */

  function onRequest(req, res) {
    console.log(req.method, req.url)
    pull(
      handleRequest(req),
      pull.filter(function (data) {
        if (Array.isArray(data)) {
          res.writeHead.apply(res, data)
          return false
        }
        return true
      }),
      toPull(res)
    )
  }

  function handleRequest(req) {
    var u = url.parse(req.url)
    var dirs = u.pathname.slice(1).split(/\/+/).map(decodeURIComponent)
    switch (dirs[0]) {
      case '':
        return serveIndex(req)
      default:
        if (ref.isMsgId(dirs[0]))
          return serveRepoPage(dirs[0], dirs.slice(1))
        else if (ref.isFeedId(dirs[0]))
          return serveUserPage(dirs[0])
        else
          return serve404(req)
    }
  }

  function serve404(req) {
    var body = '404 Not Found'
    return pull.values([
      [404, {
        'Content-Length': body.length,
        'Content-Type': 'text/plain'
      }],
      body
    ])
  }

  /* Feed */

  function renderFeed(feedId) {
    var opts = {
      reverse: true,
      id: feedId,
      limit: 12,
    }
    return pull(
      feedId ? sbot.createUserStream(opts) : sbot.createLogStream(opts),
      pull.filter(function (msg) {
        return msg.value.content.type in msgTypes
      }),
      pull.map(function (msg) {
        switch (msg.value.content.type) {
          case 'git-repo': return renderRepoCreated(msg)
          case 'git-update': return renderUpdate(msg)
        }
      })
    )
  }

  function renderRepoCreated(msg) {
    var repoLink = link([msg.key])
    var authorLink = link([msg.value.author])
    return '<p>' + timestamp(msg.value.timestamp) + '<br>' +
      authorLink + ' created repo ' + repoLink + '</p>'
  }

  function renderUpdate(msg) {
    var repoLink = link([msg.value.content.repo])
    var authorLink = link([msg.value.author])
    return '<p>' + timestamp(msg.value.timestamp) + '<br>' +
      authorLink + ' pushed to ' + repoLink + '</p>'
  }

  /* Index */

  function serveIndex() {
    return cat([
      pull.values([
        [200, {
          'Content-Type': 'text/html'
        }],
        '<!doctype html><html><head><meta charset=utf-8>',
        '<title>git ssb</title></head><body>',
        '<h1><a href="/">git ssb</a></h1>'
      ]),
      renderFeed(),
      pull.once('</body></html>')
    ])
  }

  function serveUserPage(feedId) {
    return cat([
      pull.values([
        [200, {
          'Content-Type': 'text/html'
        }],
        '<!doctype html><html><head><meta charset=utf-8>',
        '<title>git ssb</title></head><body>',
        '<h1><a href="/">git ssb</a></h1>',
        '<h2>' + feedId + '</h2>',
      ]),
      renderFeed(feedId),
      pull.once('</body></html>')
    ])
  }

  /* Repo */

  function serveRepoPage(id, path) {
    return readNext(function (cb) {
      ssbGit.getRepo(sbot, id, function (err, repo) {
        if (err) return cb(null, serveRepoNotFound(id, err))
        repo = Repo(repo)
        cb(null, (function () {
          var branch = 'master'
          switch (path[0]) {
            case undefined:
              return serveRepoIndex(repo, branch)
            case 'activity':
              return serveRepoActivity(repo, branch)
            case 'commits':
              return serveRepoCommits(repo, path[1])
            case 'blob':
              return serveBlob(repo, path[1], path.slice(2))
            default:
              return serve404(req)
          }
        })())
      })
    })
  }

  function serveRepoNotFound(id, err) {
    return pull.values([
      [404, {
        'Content-Type': 'text/html'
      }],
      '<!doctype html><html><head><meta charset=utf-8>',
      '<title>Repo not found</title></head><body>',
      '<h1><a href="/">git ssb</a></h1>',
      '<h2>Repo not found</h2>',
      '<p>Repo ' + id + ' was not found</p>',
      '<pre>' + escapeHTML(err.stack) + '</pre>',
      '</body></html>'
    ])
  }

  function renderRepoPage(repo, branch, body) {
    var gitUrl = 'ssb://' + repo.id
    var gitLink = '<code>' + gitUrl + '</code>'

    return cat([
      pull.values([
        [200, {
          'Content-Type': 'text/html'
        }],
        '<!doctype html><html><head><meta charset=utf-8>' +
        '<title>git ssb</title></head><body>' +
        '<h1><a href="/">git ssb</a></h1>' +
        '<h2>' + repo.id + '</h2>' +
        '<p>git URL: ' + gitLink + '</p>' +
        '<p>Author: ' + link([repo.feed]) + '</p>' +
        '<p>' + link([repo.id], 'Code') + ' ' +
          link([repo.id, 'activity'], 'Activity') + ' ' +
          link([repo.id, 'commits', branch], 'Commits') + '</p>' +
        '<hr/>'
      ]),
      function (end, cb) {
        body(end, function (err, data) {
          if (err === true)
            cb(true, cb)
          else if (err)
            cb(null,
              '<h3>' + err.toString() + '</h3>' +
              '<pre>' + escapeHTML(err.stack) + '</pre>')
          else
            cb(null, data)
        })
      },
      pull.once('<hr/></body></html>')
    ])
  }

  function serveRepoIndex(repo, branch) {
    var ref = 'refs/heads/' + branch

    return renderRepoPage(repo, branch, cat([
      renderRepoTree(repo, branch, []),
      renderRepoReadme(repo, branch, []),
    ]))
  }

  /* Repo activity */

  function serveRepoActivity(repo, branch) {
    return renderRepoPage(repo, branch, cat([
      pull.once('<h3>Activity</h3>'),
      pull(
        sbot.links({
          type: 'git-update',
          dest: repo.id,
          source: repo.feed,
          rel: 'repo',
          values: true,
          reverse: true,
          limit: 8
        }),
        pull.map(renderRepoUpdate)
      )
    ]))
  }

  function renderRepoUpdate(msg) {
    var authorLink = link([msg.value.author])
    var c = msg.value.content

    var refs = c.refs ? Object.keys(c.refs).map(function (ref) {
      return {name: ref, value: c.refs[ref]}
    }) : []
    var numObjects = c.objects ? Object.keys(c.objects).length : 0

    return '<p>' + timestamp(msg.value.timestamp) + '<br>' +
      (numObjects ? 'Pushed ' + numObjects + ' objects<br>' : '') +
      refs.map(function (update) {
        return escapeHTML(update.name) + ' &rarr; ' + escapeHTML(update.value)
      }).join('<br>') +
      '</p>'
  }

  /* Repo commits */

  function serveRepoCommits(repo, branch) {
    return renderRepoPage(repo, branch, cat([
      pull.once('<h3>Commits</h3><ul>'),
      pull(
        repo.readLog(branch, 5),
        pull.asyncMap(function (hash, cb) {
          cb(null, '<li><code>' + hash + '</code></li>')
        })
      ),
      pull.once('</ul>')
    ]))
  }

  /* Repo tree */

  function renderRepoTree(repo, branch, path) {
    return cat([
      pull.once('<h3>Tree</h3><ul>'),
      pull(
        repo.readTree(branch),
        pull.map(function (file) {
          var path = [repo.id, 'blob', branch, file.name]
          return '<li>' + link(path, escapeHTML(file.name)) + '</li>'
        })
      ),
      pull.once('</ul>')
    ])
  }

  /* Repo readme */

  function renderRepoReadme(repo, branch, path) {
    return readNext(function (cb) {
      pull(
        repo.readDir(branch, path),
        pull.filter(function (file) {
          return /readme(\.|$)/i.test(file.name)
        }),
        pull.take(1),
        pull.collect(function (err, files) {
          if (err) return cb(null, pull.empty())
          var file = files[0]
          if (!file)
            return cb(null, pull.once('<p>No readme</p>'))
          repo.getObject(file.id, function (err, obj) {
            if (err) return cb(null, pull.empty())
            cb(null, cat([
              pull.once(escape(file.name) + ':<blockquote><pre>'),
              pull(
                obj.read,
                escapeHTMLStream()
              ),
              pull.once('</pre></blockquote>')
            ]))
          })
        })
      )
    })
  }

  /* Blob */

  function serveBlob(repo, branch, path) {
    return readNext(function (cb) {
      repo.getFile(branch, path, function (err, object) {
        if (err) return cb(null, serveBlobNotFound(repoId, err))
        cb(null, serveObjectRaw(object))
      })
    })
  }

  function serveBlobNotFound(repoId, err) {
    return pull.values([
      [404, {
        'Content-Type': 'text/html'
      }],
      '<!doctype html><html><head><meta charset=utf-8>',
      '<title>Blob not found</title></head><body>',
      '<h1><a href="/">git ssb</a></h1>',
      '<h2>Blob not found</h2>',
      '<p>Blob in repo ' + link([repoId]) + ' was not found</p>',
      '<pre>' + escapeHTML(err.stack) + '</pre>',
      '</body></html>'
    ])
  }

  function serveObjectRaw(object) {
    return cat([
      pull.once([200, {
        'Content-Length': object.length,
        'Content-Type': 'text/plain'
      }]),
      object.read
    ])
  }

}
