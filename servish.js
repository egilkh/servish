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
	},
	// a quite simple HTML5 template
	template:
'<!DOCTYPE html>\n\
<html>\n\
<head>\n\
	<title>{title}</title>\n\
</head>\n\
<body>\n\n\
<h1>{title}</h1>\n\
{content}\n\
\n</body>\n\
</html>'
}

// TODO Real simple HTML5 documents for Error, 404 and dir listing
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

// basepath for this one
var docRoot = process.cwd();

// functions
var fillTemplate = function (template, values) {
	var t = template;
	for (v in values) {
		t = swapRecursive(t, '{' + v + '}', values[v]);
	}
	return t;
};

var swapRecursive = function (t, from, to) {
	t = t.replace(from, to);
	if (t.indexOf(from) > -1) {
		t = swapRecursive(t, from, to);
	}
	return t;
};

var requestCallback = function (req, res) {

	res.setHeader('Content-Encoding', 'utf-8');
	res.setHeader('Connection', 'close');

	var requestUrl = url.parse(req.url);
	var requestedDocument = path.join(docRoot, requestUrl.pathname);

	var remoteAddress = req.socket.remoteAddress;

	util.log('Connection from client: ' + requestUrl.pathname  + ' (' + remoteAddress + ').');

	path.exists(requestedDocument, function(exists) {
		if (!exists) {
			var output = fillTemplate(defaults.template, pageContent.notFound);
			//res.setHeader('Content-Length', output.length);
			//res.setHeader('Content-Type', defaults.mime.types['.html']);
			res.writeHead(404, {
				'Content-Length': output.length,
				'Content-Type': defaults.mime.types['.html']
			});
			res.end(output);
			util.log('Served: 404 (' + remoteAddress + ').');
		} else {
			fs.stat(requestedDocument, function(err, stats) {
				if (err) { throw err; }
				if (stats.isFile()) {

					var ext = path.extname(path.basename(requestedDocument));
					var mime = defaults.mime.types[ext] ? defaults.mime.types[ext] : defaults.mime.types['.txt'];

					res.writeHead(200, {
						'Content-Type': mime,
						'Content-Length': stats.size
					});
					// create stream and pipe it, closes res when done
					fs.createReadStream(requestedDocument, {
						encoding : 'utf8'
					}).on('end', function () {
						util.log('Served: ' + this.path + '(' + remoteAddress + ').');
					}).on('error', function(ex){
						// TODO
						util.log('Error read stream, ex: ' + ex);
					}).pipe(res);

				} else if (stats.isDirectory()) {
					// TODO pretty print directory
					var output = fillTemplate(defaults.template, pageContent.directoryListing);
					fs.readdir(requestedDocument, function(err, files) {
						if (err) { throw err; }

						var page = {
							title:requestUrl.pathname,
							content:""
						};
						page.content = '<ul>\n';
						for (f in files) {
							if (files[f].substr(0, 1) == ".") {
								continue;
							}
							page.content += '\t<li><a href="' + files[f] + '">' + files[f] + '</a></li>\n';
						}
						page.content += '</ul>\n';
						var output = fillTemplate(defaults.template, page);
						res.writeHead(200, {
							'Content-Length': output.length
						});
						res.end(output);
						util.log('Served: Directory Listing (' + remoteAddress + ').');
					});
				} else {
					var output = fillTemplate(defaults.template, pageContent.error);
					res.writeHead(500, {
						'Content-Length': output.length
					});
					res.end(output);
					util.log('We nowt sure what to do (' + remoteAddress + ').');
				}
			});
		}
	});
};

var serverBound = function (serv) {
	util.log('Servish, bound to ' + server.address().address + ':' + server.address().port + '.');
};

// TODO
// here we should read .servish from $HOME and extend our defaults

util.log('Servish, serving: ' + docRoot);

if (defaults.port.last < defaults.port.first) {
	util.log('Servish, you might have an error with your config (PORT).');
	process.exit(1);
}

var server = http.createServer(requestCallback);
var currentPort = defaults.port.first;
server.on('error', function (e) {
	if (e.code == "EADDRINUSE") { // probably a port problem
		if ((currentPort + 1) == defaults.port.last) {
			util.log('No port in range to bind to, exiting.');
			process.exit(1);
		}
		util.log('Servish, port in use. Retrying in 1s.');
		setTimeout(function() {
			server.removeAllListeners('listening'); // prevent double listening event
			server.listen(++currentPort, defaults.ip, function() {
				serverBound(this);
			});
		}, 1000);
	}
}).listen(currentPort, defaults.ip, function() {
	serverBound(this);
});;
//tryListen(server, currentPort);

process.on('SIGINT', function () {
	util.log('Got SIGINT, shuting down.');
	server.close();
});
