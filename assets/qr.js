/*
 * MicLink QR: a small, self-contained QR Code generator.
 *
 * Scope: byte mode, error correction level M, versions 1 to 10 (up to 213 bytes of text,
 * plenty for a store link). No dependencies, no network access.
 *
 *   MicLinkQR.matrix("https://example.com")  -> array of rows of booleans (true = dark), or null
 *   MicLinkQR.svg("https://example.com", { margin: 4, title: "QR code" }) -> SVG markup, or null
 *
 * Both return null when the text does not fit in a version 10 symbol.
 */
(function (root) {
  "use strict";

  // Error correction level M, indexed by version (index 0 unused).
  var ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var BLOCK_COUNT = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var MAX_VERSION = 10;
  var FORMAT_BITS_LEVEL_M = 0;

  function utf8Bytes(text) {
    var encoded = unescape(encodeURIComponent(String(text)));
    var bytes = [];
    for (var i = 0; i < encoded.length; i++) bytes.push(encoded.charCodeAt(i));
    return bytes;
  }

  // Number of modules left for data and error correction once the fixed patterns are placed.
  function rawDataModules(version) {
    var result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      var alignCount = Math.floor(version / 7) + 2;
      result -= (25 * alignCount - 10) * alignCount - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }

  function dataCodewordCount(version) {
    return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCK_COUNT[version];
  }

  // ---- Reed-Solomon over GF(2^8) with the QR polynomial 0x11D ----

  function gfMultiply(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }

  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var rootValue = 1;
    for (var j = 0; j < degree; j++) {
      for (var k = 0; k < result.length; k++) {
        result[k] = gfMultiply(result[k], rootValue);
        if (k + 1 < result.length) result[k] ^= result[k + 1];
      }
      rootValue = gfMultiply(rootValue, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (byte) {
      var factor = byte ^ result.shift();
      result.push(0);
      divisor.forEach(function (coefficient, index) {
        result[index] ^= gfMultiply(coefficient, factor);
      });
    });
    return result;
  }

  // ---- Data encoding ----

  function encodeData(bytes, version) {
    var capacityBits = dataCodewordCount(version) * 8;
    var bits = [];
    function push(value, length) {
      for (var i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }
    push(0x4, 4); // byte mode
    push(bytes.length, version <= 9 ? 8 : 16);
    bytes.forEach(function (byte) { push(byte, 8); });
    push(0, Math.min(4, capacityBits - bits.length)); // terminator
    push(0, (8 - (bits.length % 8)) % 8); // byte alignment
    for (var pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);

    var codewords = [];
    for (var index = 0; index < bits.length; index += 8) {
      var value = 0;
      for (var bit = 0; bit < 8; bit++) value = (value << 1) | bits[index + bit];
      codewords.push(value);
    }
    return codewords;
  }

  function addErrorCorrection(data, version) {
    var blockCount = BLOCK_COUNT[version];
    var eccLength = ECC_PER_BLOCK[version];
    var rawCodewords = Math.floor(rawDataModules(version) / 8);
    var shortBlockCount = blockCount - (rawCodewords % blockCount);
    var shortBlockLength = Math.floor(rawCodewords / blockCount);
    var divisor = rsDivisor(eccLength);

    var blocks = [];
    var offset = 0;
    for (var i = 0; i < blockCount; i++) {
      var dataLength = shortBlockLength - eccLength + (i < shortBlockCount ? 0 : 1);
      var blockData = data.slice(offset, offset + dataLength);
      offset += dataLength;
      var ecc = rsRemainder(blockData, divisor);
      if (i < shortBlockCount) blockData.push(0); // filler so every block has the same length
      blocks.push(blockData.concat(ecc));
    }

    var result = [];
    for (var column = 0; column < blocks[0].length; column++) {
      for (var row = 0; row < blocks.length; row++) {
        var isFiller = column === shortBlockLength - eccLength && row < shortBlockCount;
        if (!isFiller) result.push(blocks[row][column]);
      }
    }
    return result;
  }

  // ---- Symbol construction ----

  function alignmentPositions(version) {
    if (version === 1) return [];
    var size = version * 4 + 17;
    var count = Math.floor(version / 7) + 2;
    var step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    var result = [6];
    for (var position = size - 7; result.length < count; position -= step) {
      result.splice(1, 0, position);
    }
    return result;
  }

  function buildSymbol(codewords, version) {
    var size = version * 4 + 17;
    var modules = [];
    var isFunction = [];
    for (var r = 0; r < size; r++) {
      modules.push(new Array(size).fill(false));
      isFunction.push(new Array(size).fill(false));
    }

    function setFunction(x, y, dark) {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    }

    function drawFinder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var distance = Math.max(Math.abs(dx), Math.abs(dy));
          var x = cx + dx;
          var y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            setFunction(x, y, distance !== 2 && distance !== 4);
          }
        }
      }
    }

    function drawAlignment(cx, cy) {
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    function drawFormatBits(mask) {
      var data = (FORMAT_BITS_LEVEL_M << 3) | mask;
      var remainder = data;
      for (var i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
      var bits = ((data << 10) | remainder) ^ 0x5412;
      function bit(index) { return ((bits >>> index) & 1) !== 0; }

      for (var a = 0; a <= 5; a++) setFunction(8, a, bit(a));
      setFunction(8, 7, bit(6));
      setFunction(8, 8, bit(7));
      setFunction(7, 8, bit(8));
      for (var b = 9; b < 15; b++) setFunction(14 - b, 8, bit(b));

      for (var c = 0; c < 8; c++) setFunction(size - 1 - c, 8, bit(c));
      for (var d = 8; d < 15; d++) setFunction(8, size - 15 + d, bit(d));
      setFunction(8, size - 8, true); // the module that is always dark
    }

    function drawVersionBits() {
      if (version < 7) return;
      var remainder = version;
      for (var i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
      var bits = (version << 12) | remainder;
      for (var index = 0; index < 18; index++) {
        var dark = ((bits >>> index) & 1) !== 0;
        var a = size - 11 + (index % 3);
        var b = Math.floor(index / 3);
        setFunction(a, b, dark);
        setFunction(b, a, dark);
      }
    }

    // Timing patterns, finders, alignment patterns, then reserved format and version areas.
    for (var t = 0; t < size; t++) {
      setFunction(6, t, t % 2 === 0);
      setFunction(t, 6, t % 2 === 0);
    }
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);
    var positions = alignmentPositions(version);
    var last = positions.length - 1;
    for (var i = 0; i < positions.length; i++) {
      for (var j = 0; j < positions.length; j++) {
        var onFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (!onFinder) drawAlignment(positions[i], positions[j]);
      }
    }
    drawFormatBits(0);
    drawVersionBits();

    // Data modules, in the zigzag order of the standard.
    var bitIndex = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vertical = 0; vertical < size; vertical++) {
        for (var k = 0; k < 2; k++) {
          var x = right - k;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vertical : vertical;
          if (!isFunction[y][x] && bitIndex < codewords.length * 8) {
            modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
            bitIndex++;
          }
        }
      }
    }

    function applyMask(mask) {
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          if (isFunction[y][x]) continue;
          var invert;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
          }
          if (invert) modules[y][x] = !modules[y][x];
        }
      }
    }

    // Penalty rules of the standard, used only to pick the most scanner-friendly mask.
    function penalty() {
      var score = 0;
      var x;
      var y;

      function linePenalty(get) {
        var total = 0;
        var history = "";
        var runColour = get(0);
        var runLength = 1;
        history += runColour ? "1" : "0";
        for (var i = 1; i < size; i++) {
          var colour = get(i);
          history += colour ? "1" : "0";
          if (colour === runColour) {
            runLength++;
            if (runLength === 5) total += 3;
            else if (runLength > 5) total += 1;
          } else {
            runColour = colour;
            runLength = 1;
          }
        }
        // Finder-like pattern 1:1:3:1:1 with four light modules on either side.
        var padded = "0000" + history + "0000";
        var from = 0;
        while ((from = padded.indexOf("1011101", from)) !== -1) {
          var before = padded.slice(from - 4, from) === "0000";
          var after = padded.slice(from + 7, from + 11) === "0000";
          if (before || after) total += 40;
          from += 1;
        }
        return total;
      }

      for (y = 0; y < size; y++) score += linePenalty(function (i) { return modules[y][i]; });
      for (x = 0; x < size; x++) score += linePenalty(function (i) { return modules[i][x]; });

      var dark = 0;
      for (y = 0; y < size; y++) {
        for (x = 0; x < size; x++) {
          var colour = modules[y][x];
          if (colour) dark++;
          if (x + 1 < size && y + 1 < size && colour === modules[y][x + 1] &&
              colour === modules[y + 1][x] && colour === modules[y + 1][x + 1]) {
            score += 3;
          }
        }
      }
      var total = size * size;
      var steps = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      score += Math.max(0, steps) * 10;
      return score;
    }

    var bestMask = 0;
    var bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      applyMask(mask);
      drawFormatBits(mask);
      var current = penalty();
      if (current < bestScore) {
        bestScore = current;
        bestMask = mask;
      }
      applyMask(mask); // masking twice restores the unmasked symbol
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);
    return modules;
  }

  function matrix(text) {
    var bytes = utf8Bytes(text);
    for (var version = 1; version <= MAX_VERSION; version++) {
      var headerBits = 4 + (version <= 9 ? 8 : 16);
      if (headerBits + bytes.length * 8 <= dataCodewordCount(version) * 8) {
        return buildSymbol(addErrorCorrection(encodeData(bytes, version), version), version);
      }
    }
    return null;
  }

  function escapeXml(text) {
    return String(text).replace(/[&<>"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character];
    });
  }

  function svg(text, options) {
    var modules = matrix(text);
    if (!modules) return null;
    var settings = options || {};
    var margin = typeof settings.margin === "number" ? settings.margin : 4;
    var size = modules.length + margin * 2;
    var path = "";
    for (var y = 0; y < modules.length; y++) {
      for (var x = 0; x < modules.length; x++) {
        if (!modules[y][x]) continue;
        var start = x;
        while (x + 1 < modules.length && modules[y][x + 1]) x++;
        path += "M" + (start + margin) + " " + (y + margin) + "h" + (x - start + 1) + "v1h-" + (x - start + 1) + "z";
      }
    }
    var title = settings.title ? "<title>" + escapeXml(settings.title) + "</title>" : "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size +
      '" shape-rendering="crispEdges" role="img"' +
      (settings.title ? ' aria-label="' + escapeXml(settings.title) + '"' : ' aria-hidden="true"') + ">" +
      title + '<rect width="' + size + '" height="' + size + '" fill="#fff"/>' +
      '<path fill="#000" d="' + path + '"/></svg>';
  }

  var api = { matrix: matrix, svg: svg };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MicLinkQR = api;
})(typeof window !== "undefined" ? window : this);
