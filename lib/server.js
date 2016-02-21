var http = require('http')
var url = require('url')
var ref = require('ssb-ref')
var pull = require('pull-stream')
var ssbGit = require('ssb-git')
var toPull = require('stream-to-pull-stream')
var cat = require('pull-cat')

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
  return escapeHTML('<pre>' + JSON.stringify(obj, null, 2) + '</pre>')
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

var msgTypes = {
  'git-repo': true,
  'git-update': true
}

module.exports = function (sbot, listenAddr, onEnd) {
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
          return serveRepo(dirs[0])
        if (ref.isFeedId(dirs[0]))
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

  function serveRepo(id) {
    var next
    return function (end, cb) {
      if (next) return next(end, cb)
      ssbGit.getRepo(sbot, id, function (err, repo) {
        next = err ?
          serveRepoNotFound(id, err) :
          serveRepoFound(repo)
        next(null, cb)
      })
    }
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

  function serveRepoFound(repo) {
    var gitUrl = 'ssb://' + repo.id
    var gitLink = '<code>' + gitUrl + '</code>'

    return cat([
      pull.values([
        [200, {
          'Content-Type': 'text/html'
        }],
        '<!doctype html><html><head><meta charset=utf-8>',
        '<title>git ssb</title></head><body>',
        '<h1><a href="/">git ssb</a></h1>',
        '<h2>' + repo.id + '</h2>',
        '<p>' + gitLink + '</p>',
        '<p>Author: ' + link([repo.feed]) + '</p>',
      ]),
      renderRepoFeed(repo),
      pull.once('</body></html>')
    ])
  }

  /* Repo feed */

  function renderRepoFeed(repo) {
    return pull(
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
}
