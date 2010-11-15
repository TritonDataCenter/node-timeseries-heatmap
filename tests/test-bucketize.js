var path = require('path');
require.paths.unshift(path.dirname(__dirname) + '/lib');

var sys = require('sys');
var heatmap = require('heatmap');
var assert = require('assert');

rval = heatmap.bucketize([ [ 
    [ [ 0, 19 ], 10 ],
    [ [ 20, 29 ], 20 ],
    [ [ 30, 99 ], 60 ]
] ], { nbuckets: 10 });

assert.deepEqual(rval, [ [ 5,
    5,
    20,
    8.571428571428571,
    8.571428571428571,
    8.571428571428571,
    8.571428571428571,
    8.571428571428571,
    8.571428571428571,
    8.571428571428571 ] ]);

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


