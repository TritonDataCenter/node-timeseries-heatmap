/*
 * Copyright 2010 Joyent, Inc.  All rights reserved.
 * Use is subject to license terms.
 */

var assert = require('assert');
var libpng = require('png');
var sys = require('sys');

/*
 * Expects data to be a series where each data point is an array of two-tuples
 * where each consists of a two-tuple range and a value.  This series may be
 * expressed as an array, e.g.:
 *
 *  [
 *      [
 *          [ [ 0, 9 ], 20 ],
 *          [ [ 10, 19 ], 4 ],
 *          ...
 *      ], [
 *          [ [ 10, 19 ], 12 ],
 *          ...
 *      ]
 *  ]
 *
 * The series may also be expressed an object in which each member is the
 * number of sample:
 *
 *  {
 *      20: [
 *          [ [ 0, 9 ], 20 ],
 *          [ [ 10, 19 ], 4 ],
 *          ...
 *      ], 22: [
 *          [ [ 10, 19 ], 12 ],
 *          ...
 *      ]
 *  }
 *
 * In this representation, the conf argument must have 'base' and 'nsamples'
 * members to denote the desired range.
 */
exports.bucketize = function (data, conf) 
{
	var min = conf.hasOwnProperty('min') ? conf.min : 0;
	var max = conf.hasOwnProperty('max') ? conf.max : 0;
	var nbuckets = conf.nbuckets;
	var i, j, k;
	var low, high;
	var lowfilled, highfilled;

	if (!(data instanceof Array)) {
		var d = [];

		assert.ok(conf.hasOwnProperty('base'));
		assert.ok(conf.hasOwnProperty('nsamples'));

		for (i = conf.base; i < conf.nsamples; i++) {
			if (data[i]) {
				assert.ok(data[i] instanceof Array);
				d.push(data[i]);
			} else {
				d.push([]);
			}
		}

		data = d;
	}

	if (max == 0) {
		/*
		 * If the max was not specified, we'll iterate over data to
		 * determine our maximum range.
		 */
		for (i = 0; i < data.length; i++) {
			for (j = 0; j < data[i].length; j++) {
				if (data[i][j][0][1] > max)
					max = data[i][j][0][1] + 1;
			}
		}
	}

	var size = (max - min) / nbuckets;
	var rval = [];

	for (i = 0; i < data.length; i++) {
		var buckets = new Array(nbuckets);
		var datum = data[i];

		for (j = 0; j < buckets.length; j++)
			buckets[j] = 0;

		for (j = 0; j < datum.length; j++) {
			var range = datum[j][0];
			var val = datum[j][1];
			var u;

			if (range[0] >= max || range[1] < min)
				continue;

			/*
			 * First, normalize our range to our buckets, expressing
			 * it in terms of multiple of buckets.
			 */
			low = (range[0] - min) / size;
			high = ((range[1] + 1) - min) / size;

			lowfilled = Math.floor(low) + 1;
			highfilled = Math.floor(high);

			if (highfilled < lowfilled) {
				/*
				 * We don't even fill an entire bucket.  In this
				 * case, our entire value assignment goes to
				 * the bucket that both the low and high
				 * correspond to.
				 */
				buckets[highfilled] += val;
				continue;
			}

			/*
			 * Determine the amount of value that corresponds to
			 * one filled bucket (which, if we do not fill an entire
			 * bucket, may exceed our value).
			 */
			u = (1 / (high - low)) * val;

			/*
			 * Clamp our low and our high to our bucket range.
			 */
			if (low < 0)
				low = 0;

			if (high >= nbuckets)
				high = nbuckets - 1;

			if (highfilled > nbuckets)
				highfilled = nbuckets;

			/*
			 * If our low is lowest than our lowest filled bucket,
			 * add in the appropriate portion of our value to the
			 * partially filled bucket.
			 */
			if (low < lowfilled && lowfilled > 0)
				buckets[lowfilled - 1] += (lowfilled - low) * u;

			/*
			 * Now iterate over the entirely filled buckets (if
			 * there are any), and add in the proportion of our
			 * value that corresponds to a single bucket.
			 */
			for (k = lowfilled; k < highfilled; k++)
				buckets[k] += u;

			if (high > highfilled)
				buckets[highfilled] += (high - highfilled) * u;
		}

		rval.push(buckets);
	}

	return (rval);
}

/*
 * Deducts the values from one map from another.  It is expected that both
 * maps have been bucketized the same way, and that deducting the second
 * map from the first will result in no negative values.
 */
exports.deduct = function (total, deduct)
{
	var i, j;

	assert.ok(total instanceof Array);
	assert.ok(deduct instanceof Array);
	assert.ok(total.length == deduct.length);

	for (i = 0; i < total.length; i++) {
		assert.ok(total[i] instanceof Array);
		assert.ok(deduct[i] instanceof Array);
		assert.ok(total[i].length == deduct[i].length);

		for (j = 0; j < total[i].length; j++) {
			assert.ok(total[i][j] >= deduct[i][j]);
			total[i][j] -= deduct[i][j];
		}
	}
}

/*
 * Expects data to be an array of maps, whereby each map is a series of bucket
 * arrays (that is, the output of bucketize()).  Will modify the data such that
 * values are distributed from 0 to 1 based on their relative ordering (as
 * opposed to their relative values).
 */
exports.normalize = function (maps) 
{
	var values = [];
	var mapping = {};
	var i, j;
	var data;

	assert.ok(maps instanceof Array);
	assert.ok(maps[0] instanceof Array);

	if (!(maps[0][0] instanceof Array))
		maps = [ maps ];

	assert.ok(maps[0][0] instanceof Array);

	/*
	 * First, take a pass over all data, across all maps.
	 */
	for (m = 0; m < maps.length; m++) {
		data = maps[m];

		assert.ok(data.length == maps[0].length);

		for (i = 0; i < data.length; i++) {
			assert.ok(data[i].length == data[0].length);
			assert.ok(data[0].length == maps[0][0].length);

			for (j = 0; j < data[i].length; j++) {
				/*
				 * We will only normalize non-zero values --
				 * values that are zero will remain as zero.
				 */
				if (data[i][j] != 0)
					values.push(data[i][j]);
			}
		}
	}

	values.sort(function (lhs, rhs) { 
		if (lhs < rhs)
			return (1);

		if (lhs > rhs)
			return (-1);

		return (0);
	});

	for (i = 0; i < values.length; i++) {
		mapping[values[i]] = (values.length - i) / values.length;

		while (i < values.length && values[i + 1] == values[i])
			i++;
	}

	for (m = 0; m < maps.length; m++) {
		data = maps[m];

		for (i = 0; i < data.length; i++) {
			for (j = 0; j < data[i].length; j++) {
				if (data[i][j] != 0)
					data[i][j] = mapping[data[i][j]];
			}
		}
	}
}

/*
 * Convert from HSV to RGB.  Ported from the Java implementation by Eugene
 * Vishnevsky:
 *
 *   http://www.cs.rit.edu/~ncs/color/t_convert.html
 */
function convertHSVToRGB(h, s, v)
{
	var r, g, b;
	var i;
	var f, p, q, t;
 
	assert.ok(h >= 0 && h <= 360);
	assert.ok(s >= 0 && s <= 1);
	assert.ok(v >= 0 && v <= 1);
 
	if (s == 0) {
		/*
		 * A saturation of 0.0 is achromatic (grey).
		 */
		r = g = b = v;

		return ([ Math.round(r * 255), Math.round(g * 255),
		    Math.round(b * 255) ]);
	}

	h /= 60; // sector 0 to 5

	i = Math.floor(h);
	f = h - i; // fractional part of h
	p = v * (1 - s);
	q = v * (1 - s * f);
	t = v * (1 - s * (1 - f));

	switch (i) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
 
		case 1:
			r = q;
			g = v;
			b = p;
			break;
 
		case 2:
			r = p;
			g = v;
			b = t;
			break;
 
		case 3:
			r = p;
			g = q;
			b = v;
			break;
 
		case 4:
			r = t;
			g = p;
			b = v;
			break;
 
		default: // case 5:
			r = v;
			g = p;
			b = q;
	}
 
	return ([ Math.round(r * 255),
	    Math.round(g * 255), Math.round(b * 255)] );
}

/*
 * Expects normalized data (that is, the output of normalize()), and a
 * configuration file dictating the parameters for the heatmap.  This routine
 * returns a libpng.Png() object.
 */
exports.generate = function (data, conf) 
{
	var hue = conf.hue;
	var width = conf.width;
	var height = conf.height;

	assert.ok(conf.width > 0);
	assert.ok(conf.height > 0);
	assert.ok(conf.hasOwnProperty('hue'));
	assert.ok(conf.hasOwnProperty('value'));
	assert.ok(conf.saturation instanceof Array);
	assert.equal(conf.saturation.length, 2);
	assert.ok(conf.saturation[0] >= 0 && conf.saturation[0] <= 1);
	assert.ok(conf.saturation[1] >= 0 && conf.saturation[1] <= 1);
	assert.ok(conf.saturation[0] < conf.saturation[1]);
	assert.ok(data instanceof Array);
	assert.ok(data[0] instanceof Array);
	assert.ok((data[0][0] instanceof Array && conf.hue instanceof Array) ||
	    (!(data[0][0] instanceof Array) && !(conf.hue instanceof Array)));

	if (!(data[0][0] instanceof Array)) {
		assert.ok(!(hue instanceof Array));
		data = [ data ];
		hue = [ conf.hue ];
	}

	assert.ok(data[0][0] instanceof Array);
	assert.ok(!(data[0][0][0] instanceof Array));
	assert.ok(data.length == hue.length);

	var nbuckets = data[0][0].length;
	var bheight = height / nbuckets;
	var nsamples = data[0].length;
	var bwidth = width / nsamples;
	var base = conf.startingSample ? conf.startingSample : 0;
	var background = [ 0xff, 0xff, 0xff ];
	var i, j;

	var buf = new Buffer(width * height * 3);

	var color = function (hue, value) {
		if (value == 0)
			return (background);

		return (convertHSVToRGB(hue, conf.saturation[0] +
		    (value * (conf.saturation[1] - conf.saturation[0])),
		    conf.value));
	};

	var mix = function (rgb, hue, value, total) {
		var r = color(hue, value);
		var ratio = value / total;

		rgb[0] += r[0] * ratio;
		rgb[1] += r[1] * ratio;
		rgb[2] += r[2] * ratio;
	};

	for (i = 0; i < nsamples; i++) {
		for (j = 0; j < nbuckets; j++) {
			var jh = nbuckets - j - 1
			var hbase = Math.floor(jh * bheight);
			var hlimit = Math.floor((jh + 1) * bheight);
			var wbase = Math.floor((base + i) * bwidth);
			var wlimit = Math.floor((base + i + 1) * bwidth);
			var rgb;

			if (data.length == 1) {
				rgb = color(hue[0], data[0][i][j]);
			} else {
				rgb = [ 0, 0, 0 ];
				var t = 0;

				for (m = 0; m < data.length; m++) {
					assert.ok(i < data[m].length);
					assert.ok(j < data[m][i].length);
					t += data[m][i][j];
				}

				for (m = 0; m < data.length; m++) {
					if (t == 0) {
						rgb = background;
						break;
					}

					mix(rgb, hue[m], data[m][i][j], t);
				}
			}

			assert.ok(rgb[0] >= 0 && rgb[0] <= 0xff);
			assert.ok(rgb[1] >= 0 && rgb[1] <= 0xff);
			assert.ok(rgb[2] >= 0 && rgb[2] <= 0xff);

			for (h = hbase; h < hlimit; h++) {
				for (w = wbase; w < wlimit; w++) {
					var offs = h * width * 3 + w * 3;

					buf[offs] = rgb[0];
					buf[offs + 1] = rgb[1];
					buf[offs + 2] = rgb[2];
				}
			}
		}
	}

	return (new libpng.Png(buf, width, height, 'rgb'));
}

