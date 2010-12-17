/*
 * Copyright 2010 Joyent, Inc.  All rights reserved.
 * Use is subject to license terms.
 */

var assert = require('assert');
var libpng = require('png');
var sys = require('sys');

/*
 * bucketize() processes data into buckets, and is the first stage in
 * generating a heatmap.  The function takes two arguments: an array (or
 * object -- see below) representing the data ('data'), and an object denoting
 * the configuration parameters of the bucketization ('conf').  The data
 * is a series of ranges and values associated with those ranges.  These
 * ranges need not be uniform and may be sparse (or even overlapping); the
 * data will be bucketized across the specified number of (evenly distributed)
 * buckets.  Where ranges don't line up precisely with a bucket, the
 * corresponding value will be fractionally mapped to those buckets with which
 * the range overlaps, with a weight of overlap.  (That is, the bucketization
 * will effectively assume a linear distribution within the range.)  The
 * output of bucketize() is a map, which we define to be an array of bucket
 * arrays, where each element denotes a sample, and each bucket array denotes
 * the bucketized data for that sample.
 *
 * 'data' is expected to be a series where each data point is an array of
 * two-tuples where each consists of a two-tuple range and a value.  This
 * series may be expressed as an array, e.g.:
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
 * Alternatively, the series may also be expressed an object in which each
 * member is the number of sample:
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
 * In this representation, 'conf' must have 'base' and 'nsamples'
 * members to denote the desired range; see below.
 *
 * The 'conf' object describes configuration information and must contain
 * the following members:
 *
 *	nbuckets	=>	The number of buckets for bucketization
 *
 * If the object data representation is used (as opposed to the array
 * representation), the 'conf' object must contain two additional members:
 *
 *	base		=>	The index of the lowest sample in 'data' to
 *				be processed.
 *
 *	nsamples	=>	The number of samples to be processed.
 *
 * 'conf' has the following optional members:
 *
 *	min		=>	The minimum value to represent. If the minimum
 *				is not specified, it is assumed to be 0.
 *
 *	max		=>	The maximum value to represent. The buckets
 *				will span a range of [ min, max ).  If the max
 *				is not specified, it will dynamically
 *				determined.
 *
 *	weighbyrange	=>	A boolean that, if true, denotes that values
 *				should be weighed by their range.
 * 
 */
exports.bucketize = function (data, conf) 
{
	var min = conf.hasOwnProperty('min') ? conf.min : 0;
	var max = conf.hasOwnProperty('max') ? conf.max : 0;
	var nbuckets = conf.nbuckets;
	var i, j, k;
	var low, high;
	var lowfilled, highfilled;

	assert.ok(nbuckets >= 0 && typeof (nbuckets) == 'number');
	assert.ok(min >= 0 && typeof (min) == 'number');
	assert.ok(max >= 0 && typeof (max) == 'number');

	if (!(data instanceof Array)) {
		var d = [];

		assert.ok(conf.hasOwnProperty('base'));
		assert.ok(conf.hasOwnProperty('nsamples'));

		for (i = conf.base; i < conf.base + conf.nsamples; i++) {
			if (data[i]) {
				assert.ok(data[i] instanceof Array);
				d.push(data[i]);
			} else {
				d.push([]);
			}
		}

		data = d;
	}

	if (max === 0) {
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

			assert.ok(range[0] <= range[1]);

			if (conf.weighbyrange)
				val *= range[0] + ((range[1] - range[0]) / 2);

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
};

/*
 * deduct() subtracts the values of one map ('deduct') from another ('total').
 * (See bucketize() for the definition of a map.)  It is expected (and is
 * asserted) that both maps have been bucketized the same way, and that
 * deducting 'deduct' from 'total' will result in no negative values.
 */
exports.deduct = function (total, deduct)
{
	var i, j;

	assert.ok(total instanceof Array, 'expected a map to deduct from');
	assert.ok(deduct instanceof Array, 'expected a map to deduct');
	assert.ok(total.length == deduct.length, 'maps are not same length');

	for (i = 0; i < total.length; i++) {
		assert.ok(total[i] instanceof Array);
		assert.ok(deduct[i] instanceof Array);
		assert.ok(total[i].length == deduct[i].length);

		for (j = 0; j < total[i].length; j++) {
			/*
			 * Logically, total[i][j] should be greater than what
			 * we're trying to deduct, however error can
			 * accumulate to the point that this is not exactly
			 * true; assert that these errors have not added up
			 * to a significant degree.
			 */
			assert.ok(total[i][j] - deduct[i][j] > -0.5, 'at [' +
			    i + ', ' + j + '], deduction value (' +
			    deduct[i][j] + ') ' + 'exceeds total (' +
			    total[i][j] + ') by more than accumulated ' +
			    'error tolerance');
			total[i][j] -= deduct[i][j];
			
			if (total[i][j] < 0)
				total[i][j] = 0;
		}
	}
};

/*
 * normalize() takes a map or an array of maps (see bucketize() for the
 * definition of a map), and modifies the data such that the values range from
 * 0 to 1.  The mechanism for normalization is specified via the 'conf'
 * parameter, which may have the following optional members:
 *
 *	rank		=>	Boolean that denotes that normalization should
 *				be based on a values rank among all values in
 *				the map:  values will be sorted and then
 *				assigned the value of their rank divided by
 *				the number of values.
 *
 * 	linear		=>	Boolean that denotes that normalization should
 * 				be linear with respect to value:  values will
 *				be normalized by dividing by the maximum
 *				value.
 *
 * If 'conf' is not present or does not have a normalization mechanism set,
 * normalize() will operate as if 'conf' were set to { rank: true }.
 */
exports.normalize = function (maps, conf) 
{
	var values = [];
	var mapping = {};
	var i, j, m, max = 1;
	var data;
	var preprocess = function () {};
	var process = function () {};
	var normalized = function (value) { return (value); };

	if (!conf || (!conf.rank && !conf.linear))
		conf = { rank: true };

	assert.ok(maps instanceof Array);
	assert.ok(maps[0] instanceof Array);
	assert.ok(conf.rank || conf.linear,
	    'expected normalization to be set to rank or linear');
	assert.ok(!(conf.rank && conf.linear),
	    'expected normalization to be set to one of rank or linear');

	if (!(maps[0][0] instanceof Array))
		maps = [ maps ];

	assert.ok(maps[0][0] instanceof Array);

	if (conf.rank) {
		preprocess = function (value) {
			/*
			 * For rank normalization, we will only consider
			 * non-zero values in the ranking (assuring that values
			 * that are zero will remain as zero).
			 */
			if (value !== 0)
				values.push(value);
		};

		process = function () {
			values.sort(function (lhs, rhs) { 
				if (lhs < rhs)
					return (1);

				if (lhs > rhs)
					return (-1);

				return (0);
			});

			for (i = 0; i < values.length; i++) {
				mapping[values[i]] =
				    (values.length - i) / values.length;

				while (i < values.length &&
				    values[i + 1] == values[i])
					i++;
			}
		};

		normalized = function (value) {
			if (value)
				return (mapping[value]);

			return (0);
		};
	}

	if (conf.linear) {
		preprocess = function (value) {
			if (value > max)
				max = value;
		};

		normalized = function (value) {
			return (value / max);
		};
	}

	/*
	 * First, take a preprocessing pass over all data, across all maps.
	 */
	for (m = 0; m < maps.length; m++) {
		data = maps[m];

		assert.ok(data.length == maps[0].length);

		for (i = 0; i < data.length; i++) {
			assert.ok(data[i].length == data[0].length);
			assert.ok(data[0].length == maps[0][0].length);

			for (j = 0; j < data[i].length; j++)
				preprocess(data[i][j]);
		}
	}

	process();

	for (m = 0; m < maps.length; m++) {
		data = maps[m];

		for (i = 0; i < data.length; i++) {
			for (j = 0; j < data[i].length; j++)
				data[i][j] = normalized(data[i][j]);
		}
	}
};

/*
 * generate() takes normalized data (that is the output of normalize() and
 * returns a heatmap as a PNG (that is, a libpng.Png() object) as
 * specified by the configuration parameter, 'conf'.  'data' may either be
 * a map (see bucketize()) or an array of maps which are to be rendered on the
 * same heatmap.  Either way, 'data' must be normalized:  all values are
 * expected to be between 0 and 1.
 *
 * 'conf' must have the following members:
 *
 *	height		=>	Height of PNG, in pixels.
 *
 *	width		=>	Width of PNG, in pixels.
 *
 *	hue		=>	The hue (in degrees) to be used in coloring the
 *				heatmap.  If 'data' is a map, this is a scalar
 *				between 0 and 360; if 'data' is an array of
 *				maps, this is an array of hues to be used with
 *				the corresponding map.
 *
 *	saturation	=>	A two-tuple that denotes a saturation range to
 *				be used to determine the coloring of the
 *				heatmap: the saturation of a given point will
 *				be determined by using the value to index into
 *				this range.  Each value in the range should be
 *				a saturation value between 0 and 1.  There is
 *				only a single saturation range, even if the
 *				heatmap is generated out of many maps.
 *
 *	value		=>	The value to be used to color the heatmap.
 *				The value component of color does not vary 
 *				across the heatmap.  (Note that this is value
 *				in the HSV sense; it should not be confused
 *				with the normalized value that corresponds to
 *				a given bucket within a given sample.)
 *
 * 'conf' may have the following members:
 *
 *	base		=>	The index of the zeroth sample in 'data'.
 * 				This is used to assure that samples that
 * 				consume fractions of pixels always consume a
 * 				constant for a given sample, regardless of the
 * 				X offset of the sample within the heatmap.
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
	var base = conf.base ? conf.base : 0;
	var basewidth = Math.floor(base * bwidth);
	var background = [ 0xff, 0xff, 0xff ];
	var i, j;

	var buf = new Buffer(width * height * 3);

	var color = function (hue, value) {
		if (value === 0)
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
			var jh = nbuckets - j - 1;
			var hbase = Math.floor(jh * bheight);
			var hlimit = Math.floor((jh + 1) * bheight);
			var wbase = Math.floor((base + i) * bwidth);
			var wlimit = Math.floor((base + i + 1) * bwidth);
			var rgb;

			wbase -= basewidth;
			wlimit -= basewidth;

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
					if (t === 0) {
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
};

/*
 * Returns a 2-tuple that consists of a sample number and a range for the given
 * configuration.
 */
exports.samplerange = function (x, y, conf) 
{
	assert.ok(conf.width > 0);
	assert.ok(conf.height > 0);
	
	var nbuckets = conf.nbuckets;
	var min = conf.min;
	var max = conf.max;
	var nsamples = conf.nsamples;
	var size = (max - min) / nbuckets;

	assert.ok(nbuckets >= 0 && typeof (nbuckets) == 'number');
	assert.ok(min >= 0 && typeof (min) == 'number');
	assert.ok(max >= 0 && typeof (max) == 'number');
	assert.ok(nsamples >= 0 && typeof (nsamples) == 'number');
	assert.ok(x < conf.width);
	assert.ok(y < conf.height);

	var bheight = conf.height / nbuckets;
	var bwidth = conf.width / nsamples;
	var base = conf.base ? conf.base : 0;
	var basewidth = Math.floor(base * bwidth);

	sample = Math.floor((x + basewidth) / bwidth);
	bucket = nbuckets - Math.floor(y / bheight) - 1;

	return ([ sample, [ Math.round(min + (bucket * size)),
	    Math.round(min + (bucket + 1) * size) - 1 ] ]);
};

/*
 * Takes a non-normalized map, and returns the bucket distribution across the
 * entire map.
 */
exports.distribution = function (map, conf) 
{
	var nsamples = map.length;
	var nbuckets = map[0].length;
	var total = new Array(nbuckets);
	var max = conf.max;
	var min = conf.min;

	assert.ok(conf.hasOwnProperty('min'));
	assert.ok(conf.hasOwnProperty('max'));
	assert.equal(nbuckets, conf.nbuckets);

	var size = (max - min) / nbuckets;

	for (i = 0; i < nbuckets; i++)
		total[i] = [ min + ((i + 0.5) * size), 0 ];

	for (i = 0; i < nsamples; i++) {
		for (j = 0; j < nbuckets; j++)
			total[j][1] += map[i][j];
	}

	return (total);
};

/*
 * Takes a non-normalized map, and returns the average for each sample in the
 * map (as a vector).
 */
exports.average = function (map, conf) 
{
	var nsamples = map.length;
	var nbuckets = map[0].length;
	var avg = [];
	var max = conf.max;
	var min = conf.min;

	assert.ok(conf.hasOwnProperty('min'));
	assert.ok(conf.hasOwnProperty('max'));
	assert.equal(nbuckets, conf.nbuckets);

	var size = (max - min) / nbuckets;

	for (i = 0; i < nsamples; i++) {
		var sum = 0, count = 0;

		for (j = 0; j < nbuckets; j++) {
			count += map[i][j];
			sum += map[i][j] * (min + ((j + 0.5) * size));
		}	

		avg.push([ conf.base + i , sum / count ]);
	}

	return (avg);
};

/*
 * An internal utility routine to convert from HSV to RGB.  Ported from the
 * Java implementation by Eugene Vishnevsky:
 *
 *   http://www.cs.rit.edu/~ncs/color/t_convert.html
 */
function convertHSVToRGB(h, s, v)
{
	var r, g, b;
	var i;
	var f, p, q, t;
 
	assert.ok(h >= 0 && h <= 360, 'hue (' + h + ') out of range');
	assert.ok(s >= 0 && s <= 1, 'saturation (' + s + ') out of range');
	assert.ok(v >= 0 && v <= 1, 'value (' + v + ') out of range');
 
	if (s === 0) {
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
			break;
	}
 
	return ([ Math.round(r * 255),
	    Math.round(g * 255), Math.round(b * 255)] );
}
