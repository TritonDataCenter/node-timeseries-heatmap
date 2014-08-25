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

var sys = require('sys');
var heatmap = require('heatmap');
var assert = require('assert');

var conf = { nbuckets: 10, base: 100, nsamples: 2, min: 1, max: 101 };
var data = {
   100: [
	[[ 1, 10], 10],
	[[11, 20], 10],
	[[21, 30], 10],
	[[31, 40], 10],
	[[41, 50], 10],
	[[51, 60], 10],
	[[61, 70], 10],
	[[71, 80], 10],
	[[81, 90], 10],
	[[91, 100], 10]
   ],
   101: [
	[[ 1, 10],  5],
	[[11, 20], 10],
	[[21, 30], 30],
   ]
};

var map, rval;

map = heatmap.bucketize(data, conf);
console.log(map);

/* 0th percentile (= minimum) */
conf.percentile = 0;
rval = heatmap.percentile(map, conf);
console.log(rval);
assert.deepEqual(rval, [[ 100, 1 ], [ 101, 1 ]]);

/* 50th percentile (median) */
conf.percentile = 0.50;
rval = heatmap.percentile(map, conf);
console.log(rval);
assert.deepEqual(rval, [[100, 51], [101, 23.5]]);

/* 95th percentile */
conf.percentile = 0.95;
rval = heatmap.percentile(map, conf);
console.log(rval);
assert.deepEqual(rval, [[100, 96], [101, 30.25]]);

/* 100th percentile (max) */
conf.percentile = 1;
rval = heatmap.percentile(map, conf);
console.log(rval);
assert.deepEqual(rval, [[100, 101], [101, 31]]);
