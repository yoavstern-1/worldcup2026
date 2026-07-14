// Local dev server. ESPN blocks file:// (null origin), so the site must be
// served over http to load match data.
//   node serve.js   ->   http://localhost:8099
var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = parseInt(process.env.PORT, 10) || 8099;
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };

http.createServer(function(req, res) {
  var rel = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  var file = path.join(__dirname, path.normalize(rel).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(file, function(err, data) {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, function() {
  console.log('World Cup 2026 running at http://localhost:' + PORT);
  console.log('Ctrl+C to stop.');
});
