var http = require('http')
var url = require('url')
var ref = require('ssb-ref')
var pull = require('pull-stream')
var ssbGit = require('ssb-git')

function parseAddr(str, def) {
  if (!str) return def
  var i = str.lastIndexOf(':')
  if (~i) return {host: str.substr(0, i), port: str.substr(i+1)}
  if (isNaN(str)) return {host: str, port: def.port}
  return {host: def.host, port: str}
}

module.exports = function (sbot, listenAddr, onEnd) {
  var addr = parseAddr(listenAddr, {host: '::1', port: 7718})
  http.createServer(onRequest).listen(addr.port, addr.host, onListening)

  function onListening() {
    console.error('Listening on ' + addr.host + ':' + addr.port)
  }

  function onRequest(req, res) {
    var u = url.parse(req.url)
    console.log(req.method, req.url)
    var dirs = u.pathname.slice(1).split(/\/+/)
    switch (dirs[0]) {
      case '':
        return serveIndex(req, res)
      default:
        if (ref.isMsgId(dirs[0]))
          return serveRepo(req, res)
        else
          return serve404(req, res)
    }
  }

  function serve404(req, res) {
    var body = '404 Not Found'
    res.writeHead(404, {
      'Content-Length': body.length,
      'Content-Type': 'text/html'
    })
    res.end(body)
  }

  function serveIndex(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    })
    res.write('<html><head><meta charset=utf-8></head>' +
      '<title>git SSB</title><body>')
    pull(
      ssbGit.repos(sbot),
      pull.drain(function (repo) {
        res.write('<p>' + repo.id + '</p>')
      }, function (err) {
        if (err)
          res.write(err.stack)
        res.end('</body></html>')
      })
    )
  }

  function serveRepo(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    })
    res.end('not implemented')
  }
}
