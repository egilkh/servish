#!/usr/bin/env node

/**
 * A slightly simple webserver for serving a folder.
 */

'use strict';

// requires
var http = require('http');
var util = require('util');
var path = require('path');
var url = require('url');
var fs = require('fs');

var defaults = {

  // ip to listen to, null means all ip's
  ip: null, // listen to all ip's

  // first and last port to try out when starting to listen
  // give up if last < first or if none of the ports are free to use
  port: {
    first: 8080,
    last: 8100
  },

  // should we show hidden files/folders (. files)
  showHidden: false,

  rewriteToIndex: false,

  // default mime types, what I plan to serve ze best
  mime: {
    types: {
      '.txt': 'text/plain; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
    },
    binary: ['.jpg', '.jpeg', '.png', '.gif']
  },

  // a quite simple HTML5 template
  template: [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
      '<title>{title}</title>',
    '</head>',
    '<body>',
    '<h1>{title}</h1>',
    '{content}',
    '</body>',
    '</html>',
  ].join('\n')
};

// basic content for the various templates
var pageContent = {
  notFound: {
    title: '404 - File not found',
    content: 'This is not the file you are looking for.'
  },
  error: {
    title: '500 - Error',
    content: 'Do not know what to do.'
  },
  directoryListing : {
    title: 'Directory Listing',
    content: 'This should never be shown.'
  }
};

// Check args
process.argv.forEach(function (arg) {
  if (arg === '--rewrite') {
    util.log('Servish, will be rewriting 404 to index.html');
    defaults.rewriteToIndex = true;
  }
});

// basepath for this one
var documentRoot = process.cwd();

// functions
var swapRecursive = function (t, from, to) {
  t = t.replace(from, to);
  if (t.indexOf(from) > -1) {
    t = swapRecursive(t, from, to);
  }
  return t;
};

var fillTemplate = function (template, values) {
  var t = template;
  for (var v in values) {
    if (!values.hasOwnProperty(v)) {
      continue;
    }

    t = swapRecursive(t, '{' + v + '}', values[v]);
  }
  return t;
};

var serve404 = function (req, res) {
  var output = fillTemplate(defaults.template, pageContent.notFound);

  res.writeHead(404, {
    'Content-Length': output.length,
    'Content-Type': defaults.mime.types['.html']
  });
  res.end(output);
  util.log('Served: 404 (' + req.socket.remoteAddress + ').');
};

var serveError = function (req, res) {
  var output = fillTemplate(defaults.template, pageContent.error);
  res.writeHead(500, {
    'Content-Length': output.length
  });
  res.end(output);
  util.log('We not sure what to do (' + req.socket.remoteAddress + ').');
};

var serveDir = function (req, res, dir) {
  var requestUrl = url.parse(req.url);

  fs.readdir(dir, function(err, files) {
    if (err) { throw err; }

    var page = {
      title: requestUrl.pathname,
      content: '',
    };

    var dirname = req.url + (req.url[req.url.length - 1] !== '/' ? '/' : '');

    page.content = '<ul>\n';
    for (var f in files) {
      if (!files.hasOwnProperty(f)) {
        continue;
      }

      if (files[f].substr(0, 1) === '.' && !defaults.showHidden) {
        continue;
      }

      page.content += '\t<li><a href="' + dirname + files[f] + '">' + files[f] + '</a></li>\n';
    }
    page.content += '</ul>\n';

    var output = fillTemplate(defaults.template, page);
    res.writeHead(200, {
      'Content-Type': defaults.mime.types['.html'],
      'Content-Length': output.length
    });
    res.end(output);
    util.log('Served: Directory Listing (' + req.socket.remoteAddress + ').');
  });
};

var serveFile = function (req, res, file) {
  fs.stat(file, function(err, stats) {
    if (err) { throw err; }

    if (stats.isFile()) {

      var ext = path.extname(path.basename(file));
      var mime = defaults.mime.types[ext] ? defaults.mime.types[ext] : defaults.mime.types['.txt'];

      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stats.size
      });

      var readOptions = {};
      if (defaults.mime.binary.indexOf(ext) === -1) {
        readOptions.encoding = 'utf8';
      }
      // create stream and pipe it, closes res when done
      // TODO Fix sending of binary content ?
      fs.createReadStream(file, readOptions)
      .on('end', function () {
        util.log('Served: ' + this.path + '(' + req.socket.remoteAddress + ').');
      }).on('error', function(ex){
        // TODO
        util.log('Error reading stream, ex: ' + ex);
      }).pipe(res);

    } else if (stats.isDirectory()) {
      return serveDir(req, res, file);
    } else {
      return serveError(req, res);
    }
  });
};

var serveRewrite = function (req, res) {
  util.log('Servish, rewriting');
  var indexFile = path.join(documentRoot, 'index.html');

  fs.exists(indexFile, function (indexExists) {
    if (indexExists) {
      return serveFile(req, res, indexFile);
    } else {
      return serve404(req, res);
    }
  });

  return;
};

var requestCallback = function (req, res) {
  res.setHeader('Connection', 'close'); // we no accept long calls

  var requestUrl = url.parse(req.url),
      requestedDocument = path.join(documentRoot, requestUrl.pathname),
      remoteAddress = req.socket.remoteAddress;

  util.log('Connection from client: ' + requestUrl.pathname  + ' (' + remoteAddress + ').');

  if (requestUrl === '/' && defaults.rewriteToIndex) {
    return serveRewrite(req, res);
  }

  fs.exists(requestedDocument, function(exists) {
    if (!exists) {
      if (defaults.rewriteToIndex) {
        return serveRewrite(req, res);
      }

      return serve404(req, res);
    } else {
      return serveFile(req, res, requestedDocument);
    }
  });
};

var serverBound = function (server) {
  util.log('Servish, bound to ' + server.address().address + ':' + server.address().port + '.');
};

// TODO
// here we should read .servish from $HOME and extend our defaults

util.log('Servish, serving: ' + documentRoot);

if (defaults.port.last < defaults.port.first) {
  util.log('Servish, you might have an error with your config (PORT).');
  process.exit(1);
}

var server = http.createServer(requestCallback);
var currentPort = defaults.port.first;
server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') { // probably a port problem
    if ((currentPort + 1) === defaults.port.last) {
      util.log('No port in range to bind to, exiting.');
      process.exit(1);
    }
    util.log('Servish, port in use. Retrying in 1s.');
    setTimeout(function() {
      server.removeAllListeners('listening'); // prevent double listening event
      currentPort = currentPort + 1;
      server.listen(currentPort, defaults.ip, function() {
        serverBound(this);
      });
    }, 1000);
  }
}).listen(currentPort, defaults.ip, function() {
  serverBound(this);
});

// Allows graceful shutdown on Windows.
// From: http://stackoverflow.com/a/14861513
if (process.platform === 'win32') {
  require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  }).on('SIGINT', function () {
    process.emit('SIGINT');
  });
}

process.on('SIGINT', function () {
  util.log('Got SIGINT, shuting down.');
  server.close(function () {
    process.exit();
  });
});
