var bignum = require('bignum'),
  utils = require('../lib/utils');

/**
 * toDecimal - converts buffer to decimal string, no leading zeroes
 * @param  {Buffer}
 * @return {String}
 */
exports.toDecimal = function (buffer) {
  return bignum.fromBuffer(buffer).toString();
};

/**
 * fromDecimal - converts decimal string to buffer
 * @param {[type]}
*  @return {Buffer}
 */
exports.fromDecimal = function (string) {
  return utils.intToBuffer(parseInt(string, 10));
};
