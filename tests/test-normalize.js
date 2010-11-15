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

