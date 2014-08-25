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

rval = heatmap.bucketize([ [ 
    [ [ 0, 9 ], 10 ],
    [ [ 10, 19 ], 20 ],
    [ [ 20, 29 ], 60 ]
] ], { nbuckets: 10 });

sys.puts(sys.inspect(rval));

heatmap.normalize(rval);

sys.puts(sys.inspect(rval));

