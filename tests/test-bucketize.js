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

var conf = { nbuckets: 10 };

rval = heatmap.bucketize([ [ 
    [ [ 0, 19 ], 10 ],
    [ [ 20, 29 ], 20 ],
    [ [ 30, 99 ], 60 ]
] ], conf);

assert.equal(conf.max, 120);

assert.deepEqual(rval, [ [ 6,
    12,
    17.142857142857146,
    10.285714285714285,
    10.285714285714285,
    10.285714285714285,
    10.285714285714285,
    10.285714285714285,
    3.428571428571434,
    0 ] ]);

rval = heatmap.bucketize([ [ 
    [ [ 0, 9 ], 10 ],
    [ [ 10, 19 ], 20 ],
    [ [ 20, 29 ], 60 ]
] ], { nbuckets: 10, max: 1000 });

assert.deepEqual(rval, [ [ 90, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);

rval = heatmap.bucketize([ [ 
    [ [ 0, 9 ], 10 ],
    [ [ 10, 19 ], 20 ],
    [ [ 20, 29 ], 60 ]
] ], { nbuckets: 10, min: 0, max: 35, nbuckets: 7 });

assert.deepEqual(rval, [ [ 5, 5, 10, 10, 30, 30, 0 ] ]);

rval = heatmap.bucketize([ [ 
    [ [ 0, 9 ], 10 ],
    [ [ 10, 19 ], 20 ],
    [ [ 20, 29 ], 60 ]
] ], { nbuckets: 10, min: 15, max: 25, nbuckets: 2 });

sys.puts(sys.inspect(rval));
assert.deepEqual(rval, [ [ 10, 30 ] ]);

rval = heatmap.bucketize([ [ 
    [ [ 0, 9 ], 10 ],
    [ [ 10, 19 ], 20 ],
    [ [ 20, 29 ], 60 ]
] ], { nbuckets: 10, min: 15, max: 25, nbuckets: 2 });

rval = heatmap.bucketize([ [ 
    [ [ 0, 0 ], 1 ],
    [ [ 1, 1 ], 1 ],
    [ [ 2, 2 ], 1 ]
] ], { nbuckets: 3, min: 0, max: 3 });

assert.deepEqual(rval, [ [ 1, 1, 1 ] ]);

sys.puts(sys.inspect(rval));
