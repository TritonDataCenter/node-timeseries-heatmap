/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

var path = require('path');
require.paths.unshift(path.dirname(__dirname) + '/lib');

var http = require('http');
var port = process.env.PORT || 8001;
var util = require('util');
var heatmap = require('heatmap');
var libdtrace = require('libdtrace');

dtp = new libdtrace.Consumer();

prog = '\
sched:::on-cpu							\n\
{								\n\
	self->on = timestamp;					\n\
}								\n\
								\n\
sched:::off-cpu							\n\
/self->on/							\n\
{								\n\
	this->us = (timestamp - self->on) / 1000;		\n\
	@ = lquantize(this->us, 0, 10000, 100);			\n\
}								\n\
';

dtp.strcompile(prog);
dtp.go();
data = [];

var base = 0;

setInterval(function () {
	dtp.aggwalk(function (varid, key, val) {
		data.push(val);

		if (data.length > 60) {
			base++;
			data.shift();
		}
	});
}, 1000);

var script = 'window.onload = function () {\n' +
'	var id = 0;\n' +
'	setInterval(function () {\n' +
'		document.getElementById("cpu").src = \n' +
'		    "/cpu.png?" + id++;\n' +
'	}, 1000);\n' +
'}';

var doc = '<body><html><img id="cpu" src="/cpu.png">' +
    '<script type="text/javascript">' + script + '</script></html></body>';

var hue = 21;

http.createServer(function (req, res) {
	if (req.method == 'GET' && req.url == '/') {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(doc);
		return;
	}

	if (data.length < 1) {
		res.writeHead(503, { 'Retry-After': 2 });
		res.end();
		return;
	}

	res.writeHead(200, {
	    'Content-Type': 'image/png',
	    'Transfer-Encoding': 'chunked'
	});	

	var rval = heatmap.bucketize(data, { max: 10000, nbuckets: 100 } );
	heatmap.normalize(rval);

	var png = heatmap.generate(rval, { height: 400, width: 1200, 
    	    hue: hue, saturation: [ 0, .9 ], value: .95 });

	res.end(png.encodeSync());
}).listen(port);

