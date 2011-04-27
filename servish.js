#!/usr/bin/env node
/**
 * A slightly simple webserver for serving a folder.
 */
// requires
var http = require('http');
var util = require('util');
var path = require('path');
var url = require('url');
var fs = require('fs');

var defaults = {
	ip: null, // listen to all ip's

	// first and last port to try out when starting to listen
	// give up if last < first or if none of the ports are free to use
	port: {
		first: 8080,
		last: 8100
	},
	// default mime types
	mime: {
		types: {
			'.txt': 'text/plain',
			'.js': 'text/javascript',
			'.css': 'text/css',
			'.html': 'text/html',
			'.png': 'image/png',
			'.jpg': 'image/jpg'
		}
	}
}

// TODO Real simple HTML5 documents for Error, 404 and dir listing

// basepath for this one
var docRoot = process.cwd();

// functions
var request_cb = function (req, res) {

	res.setHeader('Content-Type', defaults.mime.types['.txt']); // default mime!
	res.setHeader('Content-Encoding', 'utf-8');
	res.setHeader('Connection', 'close');

	var requestUrl = url.parse(req.url);
	var requestedDocument = path.join(docRoot, requestUrl.pathname);

	util.log('Connection from client: ' + requestUrl.pathname  + ' (' + req.socket.remoteAddress + ').');

	path.exists(requestedDocument, function(exists) {
		if (!exists) {
			var msg = '404 - File not found.';
			res.setHeader('Content-Length', msg.length);
			res.writeHead(404);
			res.end(msg);
		} else {
			fs.stat(requestedDocument, function(err, stats) {
				if (err) { throw err; }
				if (stats.isFile()) {

					var ext = path.extname(path.basename(requestedDocument));
					var mime = defaults.mime.types[ext] ? defaults.mime.types[ext] : defaults.mime.types['.txt'];

					res.setHeader('Content-Type', mime);
					res.setHeader('Content-Length', stats.size);
					res.writeHead(200);

					// create stream and pipe it over closing the res when done
					fs.createReadStream(requestedDocument, {
						encoding : 'utf8'
					}).on('end', function () {
						util.log('Served file: ' + this.path);
						//console.log(util.inspect(this));
					}).on('error', function(ex){
						// TODO
						util.log('Error read stream, ex: ' + ex);
					}).pipe(res);

				} else if (stats.isDirectory()) {
					// TODO pretty print directory
					var msg = '200 - Directory Listing.';
					res.setHeader('Content-Length', msg.length);
					res.writeHead(200);
					res.end(msg);
				} else {
					// this means we no want to serve them people
					var msg = '500 - I no know what do!';
					res.setHeader('Content-Length', msg.length);
					res.writeHead(500);
					res.end(msg);
				}
			});
		}
	});
};

var tryListen = function (serv, port) {
	util.log('Servish, trying to bind: ' + port);
	serv.listen(port, defaults.ip);
};

// TODO
// here we should read .servish from $HOME and extend our defaults


util.log('Servish, serving: ' + docRoot);

if (defaults.port.last < defaults.port.first) {
	util.log('Servish, you might have an error with your config (PORT).');
	process.exit(1);
}

var server = http.createServer(request_cb);
var currentPort = defaults.port.first;
server.on('error', function (e) {
	if (e.code == "EADDRINUSE") { // probably a port problem
		util.log('Servish, port in use. Retrying in 1s.');
		setTimeout(function() {
			// TODO Logic for port boundries
			tryListen(server, ++currentPort);
		}, 1000);
	}
});
tryListen(server, currentPort);

process.on('SIGINT', function () {
	util.log('Got SIGINT, shuting down.');
	server.close();
});

util.log('Servish, up and running (probably)!');
