/* 
 * GIF steganography algorithm, v0
 *
 * Uses two indexes in the color palette that point to the same color.
 * Toggling two indexes encodes a bit stream on eligible pixels,
 * which is visually imperceptible. The stream of bits
 * is read into a byte stream as:
 * byte 0: the header, the number of bytes that follow in the stream,
 *         excluding the magic byte (N)
 * byte 1: the magic byte. This is for verification and to exercise
 *         both 0 and 1 decoding/encoding
 * bytes 2 ... 2+N the message bytes
 * 
 * On decode, the bytes from each frame are as much as defined.
 * On encode, the bytes are written into each frame as much
 * as possible.
 */

var DEBUG = false;

var MAX_MESSAGE_LENGTH = 4 * 1024;
var MAGIC_BYTE = 0xAA;

function decode(gifBytes) {
	/* 1: bad format (eof)
	 * 2: bad magic byte
	 * 3: no pairs (not encoded)
	 */
	var error = 0;

	var messageBytes = new Uint8Array(MAX_MESSAGE_LENGTH);
	var bi = 0;

	var gr = new GifReader(gifBytes);

	var frameCount = gr.numFrames();
	var frame = gr.frameInfo(0);
	var n = frame.width * frame.height;
	var pixels = new Uint8Array(4 * n);

	if (DEBUG) console.log('frame count ' + frameCount);


	var palette = new Int32Array(256);

	top: for (var i = 0; i < frameCount; ++i) {
		frame = gr.frameInfo(i);
		var trans = frame.transparent_index;
		if (trans === null) trans = 256;

		gr.decodeAndBlitFrameRGBI(i, pixels);

		for (var j = 0; j < 256; ++j) {
			palette[j] = -1;
		}

		var paletteCount = 0;
		for (var j = 0; j < n; ++j) {
			var index = pixels[4 * j + 3];
			if (-1 === palette[index]) {
				if (trans === index) {
					palette[index] = 0;
				} else {
					palette[index] = (pixels[4 * j] << 16) | (pixels[4 * j + 1] << 8) | pixels[4 * j + 2];
				}
				++paletteCount;
			}
		}

		if (DEBUG) {
			console.log('palette count for frame ' + i + ' is ' + paletteCount);
			if (0 == i) {
				// detailed palette output
				for (var j = 0; j < 256; ++j) {
					if (-1 !== palette[j]) {
						console.log('frame ' + i + ' palette[' + j + '] = ' + ((palette[j] >> 16) & 0xFF) + ',' +
							((palette[j] >> 8) & 0xFF) + ',' +
							(palette[j] & 0xFF));
					}
				}
			}
		}

		var pairs = createPairs(palette, trans);


		if (DEBUG) {
			console.log('pair count for frame ' + i + ' is ' + pairs.length);
			if (0 === i) {
				console.log('pairs for frame ' + i + ' are ' + pairs);
			}
		}

		if (0 === pairs.length) {
			console.log("ERROR: no pairs.");

			error = 3;
			break;
		}

		var b = 0;
		var bn = 0;
		var byteCount = 0;
		var j = 0;
		for (; j < n; ++j) {
			var index = pixels[4 * j + 3];
			var k = pairs.indexOf(index);
			if (0 <= k) {
				if (DEBUG) console.log('header read bit ' + (k % 2));

				b |= (k % 2) << bn++;
				if (8 === bn) {
					byteCount = b;
					b = 0;
					bn = 0;

					break;
				}
			}
		}
		if (DEBUG) console.log('encoded byte count for frame ' + i + ' is ' + byteCount);

		// read the magic byte
		for (++j; j < n && 0 < byteCount; ++j) {
			var index = pixels[4 * j + 3];
			var k = pairs.indexOf(index);
			if (0 <= k) {
				if (DEBUG) console.log('magic byte read bit ' + (k % 2));

				b |= (k % 2) << bn++;
				if (8 === bn) {
					if (MAGIC_BYTE !== b) {
						error = 2;
						break top;
					}
					b = 0;
					bn = 0;

					break;
				}
			}
		}

		for (++j; j < n && 0 < byteCount; ++j) {
			var index = pixels[4 * j + 3];
			var k = pairs.indexOf(index);
			if (0 <= k) {
				b |= (k % 2) << bn++;
				if (8 === bn) {
					if (DEBUG) console.log('frame ' + i + ' read byte ' + b);
					messageBytes[bi++] = b;
					b = 0;
					bn = 0;
					--byteCount;
				}
			}
		}
		// encoder will zero out as much as possible
		if (0 !== b && 0 !== bn) {
			console.log("ERROR: message byte left hanging. Problem with encoder.");

			error = 1;
			break;
		}
	}

	return 0 === error ? ab2str(new Uint8Array(messageBytes, 0, bi)) : null;
}

function encode(gifBytes, message) {
	var messageBytes = str2ab(message);
	if (MAX_MESSAGE_LENGTH < messageBytes.length) {
		messageBytes = new Uint8Array(messageBytes, 0, MAX_MESSAGE_LENGTH);
	}

	var bi = 0;


	var gr = new GifReader(gifBytes);

	var frameCount = gr.numFrames();
	var frame = gr.frameInfo(0);
	var n = frame.width * frame.height;
	var pixels = new Uint8Array(4 * n);
	var indexedPixels = new Uint8Array(n);

	if (DEBUG) console.log('frame count ' + frameCount);

	var buf = new Uint8Array(n * frameCount);
	var gw = new GifWriter(buf, frame.width, frame.height, gr.opts());


	var palette = new Int32Array(256);

	var paletteHisto = new Uint32Array(256);

	for (var i = 0; i < frameCount; ++i) {
		frame = gr.frameInfo(i);
		var trans = frame.transparent_index;
		if (trans === null) trans = 256;

		gr.decodeAndBlitFrameRGBI(i, pixels);

		for (var j = 0; j < 256; ++j) {
			palette[j] = -1;
			paletteHisto[j] = 0;
		}


		var paletteCount = 0;
		for (var j = 0; j < n; ++j) {
			var index = pixels[4 * j + 3];
			if (-1 === palette[index]) {
				if (trans === index) {
					palette[index] = 0;
				} else {
					palette[index] = (pixels[4 * j] << 16) | (pixels[4 * j + 1] << 8) | pixels[4 * j + 2];
				}
				++paletteCount;
			}

			++paletteHisto[index];
			indexedPixels[j] = index;
		}

		if (DEBUG) {
			console.log('palette count for frame ' + i + ' is ' + paletteCount);
			if (0 == i) {
				// detailed pallete output
				for (var j = 0; j < 256; ++j) {
					if (-1 !== palette[j]) {
						console.log('frame ' + i + ' palette[' + j + '] = ' + ((palette[j] >> 16) & 0xFF) + ',' +
							((palette[j] >> 8) & 0xFF) + ',' +
							(palette[j] & 0xFF));
					}
				}
			}
		}

		pairs = createPairs(palette, trans);


		if (DEBUG) console.log('pair count for frame ' + i + ' is ' + pairs.length);


		if (0 === pairs.length) {

			// add capacity to the most frequent index
			var maxIndex = -1;
			// first
			for (var j = 0; j < 256; ++j) {
				if (trans !== j && -1 !== palette[j]) {
					maxIndex = j;
					break;
				}
			}

			if (0 <= maxIndex) {
				for (var j = 0; j < 256; ++j) {
					if (trans !== j && -1 !== palette[j] &&
						paletteHisto[maxIndex] < paletteHisto[j]) {
						maxIndex = j;
					}
				}

				// fill in one
				for (var j = 0; j < 256; ++j) {
					if (-1 === palette[j]) {
						palette[j] = palette[maxIndex];
						++paletteCount;
						if (maxIndex < j) {
							pairs.push(maxIndex);
							pairs.push(j);
						} else {
							pairs.push(j);
							pairs.push(maxIndex);

						}
						break;
					}
				}
			}

			if (DEBUG) console.log('extended pair count for frame ' + i + ' is ' + pairs.length);
		}


		if (DEBUG) console.log('recoded ' + bi + ' of ' + messageBytes.length + ' bytes');

		var byteCount = 0;
		// recode as much as can fit
		if (bi < messageBytes.length) {
			var b;
			var bn = 0;

			var j = 0;
			for (; j < n; ++j) {
				var index = indexedPixels[j];
				var k = pairs.indexOf(index);
				if (0 <= k) {
					if (8 === ++bn) {
						break;
					}
				}
			}

			b = MAGIC_BYTE;
			bn = 0;
			for (++j; j < n; ++j) {
				var index = indexedPixels[j];
				var k = pairs.indexOf(index);
				if (0 <= k) {
					indexedPixels[j] = pairs[(0 == (k % 2) ? k : (k - 1)) + ((b >> bn++) & 0x01)];
					if (8 === bn) {
						break;
					}
				}
			}

			if (DEBUG) console.log('recoding stopped header at ' + j + ' with bits ' + bn);

			b = messageBytes[bi];
			bn = 0;
			for (++j; j < n; ++j) {
				var index = indexedPixels[j];
				var k = pairs.indexOf(index);
				if (0 <= k) {
					indexedPixels[j] = pairs[(0 == (k % 2) ? k : (k - 1)) + ((b >> bn++) & 0x01)];
					if (8 == bn) {
						if (DEBUG) console.log('frame ' + i + ' wrote byte ' + b);

						if (++bi === messageBytes.length) {
							break;
						}
						if (255 === ++byteCount) {
							break;
						}
						
						b = messageBytes[bi];
						bn = 0;
					}
				}
			}

			// normalize for RLE as much as possible
			for (++j; j < n; ++j) {
				var index = indexedPixels[j];
				var k = pairs.indexOf(index);
				if (0 <= k) {
					indexedPixels[j] = pairs[0 == (k % 2) ? k : (k - 1)];
				}
			}

			if (DEBUG) console.log('recoded ' + byteCount + ' bytes with ' + bn + ' hanging bits');
		}

		// always write the header
		// the reader counts on having a header (0),
		// and if not skips the frame
		var b = byteCount;
		var bn = 0;
		for (j = 0; j < n; ++j) {
			var index = indexedPixels[j];
			var k = pairs.indexOf(index);
			if (0 <= k) {
				if (DEBUG) console.log('header write bit ' + ((b >> bn) & 0x01));
				indexedPixels[j] = pairs[(0 == (k % 2) ? k : (k - 1)) + ((b >> bn++) & 0x01)];
				if (8 === bn) {
					break;
				}
			}
		}
		if (DEBUG) console.log('wrote header for byte count ' + byteCount);


		// trim the palette to the smallest power of two
		var maxIndex = 0;
		for (var j = 1; j < 256; ++j) {
			if (-1 === palette[j]) {
				maxIndex = j;
			}
		}
		var p = 1;
		for (; p < maxIndex; p *= 2);

		gw.addFrame(0, 0, frame.width, frame.height, indexedPixels, {
			palette: new Int32Array(palette, 0, p),
			transparent: frame.transparent_index,
			delay: frame.delay,
			disposal: frame.disposal
		});
	}

	// when converting to a Blob, the length
	// of the view is ignored; use subarray(..) 
	// which doesn't seem to have that problem
	//return new Uint8Array(buf, 0, gw.end());
	return buf.subarray(0, gw.end());
}


function createPairs(palette, trans) {
	var pairs = [];
	for (var j = 0; j < 256; ++j) {
		if (trans === j || 0 <= pairs.indexOf(j)) {
			continue;
		}
		var c = palette[j];
		if (-1 === c) {
			continue;
		}
		for (var k = j + 1; k < 256; ++k) {
			if (palette[k] === c) {
				pairs.push(j);
				pairs.push(k);
				break;
			}
		}
	}
	return pairs;
}


function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function str2ab(str) {
	var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
	var bufView = new Uint16Array(buf);
	for (var i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return new Uint8Array(buf);
}