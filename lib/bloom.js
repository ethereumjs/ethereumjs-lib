var assert = require('assert'),
  utils = require('./utils.js');

/**
 * Represents a Bloom
 * @constructor
 * @param {Buffer} bitvector  
 */
var Bloom = module.exports = function(bitvector) {
  if (!bitvector) {
    this.bitvector = new Buffer(64);
  } else {
    assert(bitvector.length === 64, 'bitvectors must be 512 bits long');
    this.bitvector = bitvector;
  }
};


/**
 * adds an element to a bit vector of a 64 byte bloom filter
 * @method add
 * @param {Buffer} element
 */
Bloom.prototype.add = function(e) {

  e = utils.sha3(e);
  var mask = 511; //binary 111111111

  for (var i = 0; i < 3; i++) {
    var first2bytes = e.readUInt16BE(i * 2);
    var loc = mask & first2bytes;
    var byteLoc = loc >> 3;
    var bitLoc = 1 << loc % 8;
    this.bitvector[64 - byteLoc - 1] |= bitLoc;
  }
};

/**
 * checks if an element is in the blooom
 * @method check
 * @param {Buffer} element
 */
Bloom.prototype.check = function(e) {

  e = utils.sha3(e);
  var mask = 511; //binary 111111111
  var match = true;

  for (var i = 0; i < 3 && match; i++) {
    var first2bytes = e.readUInt16BE(i * 2);
    var loc = mask & first2bytes;
    var byteLoc = loc >> 3;
    var bitLoc = 1 << loc % 8;
    match = (this.bitvector[64 - byteLoc - 1] & bitLoc);
  }

  return match;
};
