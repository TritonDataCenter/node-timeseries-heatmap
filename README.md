
node-heatmap
============

This is the repo for node-heatmap, a node module that uses 
[node-png](https://github.com/pkrumins/node-png) to render
time-based heatmaps.  This isn't to be confused with
[@substack](https://github.com/substack/)'s 
[module of the same name](https://github.com/substack/node-heatmap).
This component is used to build Joyent's 
[cloud analytics](http://dtrace.org/blogs/dap/2011/03/01/welcome-to-cloud-analytics/)
facility, now a part of SmartDataCenter.

# API

The API is documented inline and is reproduced here; these two sources of
documentation should be kept in sync.

## `bucketize(data, conf)`

`bucketize()` processes data into buckets, and is the first stage in
generating a heatmap.  The function takes two arguments: an array (or
object -- see below) representing the data (`data`), and an object denoting
the configuration parameters of the bucketization (`conf`).  The data
is a series of ranges and values associated with those ranges.  These
ranges need not be uniform and may be sparse (or even overlapping); the
data will be bucketized across the specified number of (evenly distributed)
buckets.  Where ranges don't line up precisely with a bucket, the
corresponding value will be fractionally mapped to those buckets with which
the range overlaps, with a weight of overlap.  (That is, the bucketization
will effectively assume a linear distribution within the range.)  The
output of `bucketize()` is a map, which we define to be an array of bucket
arrays, where each element denotes a sample, and each bucket array denotes
the bucketized data for that sample.

`data` is expected to be a series where each data point is an array of
two-tuples where each consists of a two-tuple range and a value.  This
series may be expressed as an array, e.g.:

```
 [
     [
         [ [ 0, 9 ], 20 ],
         [ [ 10, 19 ], 4 ],
         ...
     ], [
         [ [ 10, 19 ], 12 ],
         ...
     ]
 ]
```

Alternatively, the series may also be expressed an object in which each
member is the number of sample:

```
 {
     20: [
         [ [ 0, 9 ], 20 ],
         [ [ 10, 19 ], 4 ],
         ...
     ], 22: [
         [ [ 10, 19 ], 12 ],
         ...
     ]
 }
```

In this representation, `conf` must have `base` and `nsamples`
members to denote the desired range, and may also have `step` to denote the
size of each sample; see below.

The `conf` object describes configuration information and must contain
the following members:

- `nbuckets`: The number of buckets for bucketization

If the object data representation is used (as opposed to the array
representation), the `conf` object must contain two additional members:

- `base`: The index of the lowest sample in `data` to be processed.

- `nsamples`: The number of samples to be processed.

`conf` has the following optional members:

- `min`: The minimum value to represent. If the minimum is not specified,
it is assumed to be 0.

- `max`: The maximum value to represent. The buckets will span a range of
`[ min, max )`.  If the max is not specified, it will be dynamically
determined -- and the result will be set in `conf`.

- `step`: The distance between consecutive samples (only applicable for
the object data representation).

- `weighbyrange`: A boolean that, if true, denotes that values should be
weighed by their range.

## `deduct (total, deduct)`

`deduct()` subtracts the values of one map (`deduct`) from another (`total`).
(See `bucketize()` for the definition of a map.)  It is expected (and is
asserted) that both maps have been bucketized the same way, and that
deducting `deduct` from `total` will result in no negative values.

## `normalize (maps, conf)`

`normalize()` takes a map or an array of maps (see `bucketize()` for the
definition of a map), and modifies the data such that the values range from
0 to 1.  The mechanism for normalization is specified via the `conf`
parameter, which may have the following optional members:

- `rank`: Boolean that denotes that normalization should be based on a values
rank among all values in the map:  values will be sorted and then assigned
the value of their rank divided by the number of values.

- `linear`: Boolean that denotes that normalization should be linear with
respect to value:  values will be normalized by dividing by the maximum
value.

If `conf` is not present or does not have a normalization mechanism set,
`normalize()` will operate as if `conf` were set to `{ rank: true }`.

## `generate (data, conf)`

generate() takes normalized data (that is the output of normalize() and
returns a heatmap as a PNG (that is, a libpng.Png() object) as
specified by the configuration parameter, `conf`.  `data` may either be
a map (see bucketize()) or an array of maps which are to be rendered on the
same heatmap.  Either way, `data` must be normalized:  all values are
expected to be between 0 and 1.
 *
`conf` must have the following members:

- `height`: Height of PNG, in pixels.

- `width`: Width of PNG, in pixels.

- `hue`: The hue (in degrees) to be used in coloring the heatmap.  If `data`
is a map, this is a scalar between 0 and 360; if `data` is an array of maps,
this is an array of hues to be used with the corresponding map.

- `saturation`: A two-tuple that denotes a saturation range to be used to
determine the coloring of the heatmap: the saturation of a given point will
be determined by using the value to index into this range.  Each value in the
range should be a saturation value between 0 and 1.  There is only a single
saturation range, even if the heatmap is generated out of many maps.

- `value`: The value to be used to color the heatmap.  The value component
of color does not vary across the heatmap.  (Note that this is value in
the HSV sense; it should not be confused with the normalized value that
corresponds to a given bucket within a given sample.)

`conf` may have the following members:

- `base`: The index of the zeroth sample in `data`.  This is used to assure
that samples that consume fractions of pixels always consume a constant for
a given sample, regardless of the X offset of the sample within the heatmap.

## `samplerange (x, y, conf)`

Returns a 2-tuple that consists of a sample number and a range for the given
configuration.

## `distribution (map, conf)`

Takes a non-normalized map, and returns the bucket distribution across the
entire map.

## `average (map, conf)`

Takes a non-normalized map, and returns the average for each sample in the
map (as a vector).

## `percentile (map, conf)`

Takes a non-normalized map and a percentile target in the range [0, 1], and
returns for each sample the estimated y-axis value representing the Nth
percentile data point.  The result is a vector of these points.

# Examples

A series of examples can be found in the `examples` directory.


