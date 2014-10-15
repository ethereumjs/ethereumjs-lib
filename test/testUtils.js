var bignum = require('bignum'),
  utils = require('../lib/utils'),
  Block = require('../lib/block.js');


var testUtils = exports;

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
 * @param {String}
*  @return {Buffer}
 */
exports.fromDecimal = function (string) {
  return utils.intToBuffer(parseInt(string, 10));
};

/**
 * address - converts 0x to utils.zero256, otherwise returns input
 * @param  {String}
 * @return {String}
 */
exports.address = function (string) {
  return !parseInt(string, 16) ? utils.zero256() : string;
};

exports.makeBlockFromEnv = function (env) {
  var block = new Block();
  block.header.timestamp = testUtils.fromDecimal(env.currentTimestamp);
  block.header.gasLimit = testUtils.fromDecimal(env.currentGasLimit);
  block.header.parentHash = new Buffer(env.previousHash, 'hex');
  block.header.coinbase = new Buffer(env.currentCoinbase, 'hex');
  block.header.difficulty = testUtils.fromDecimal(env.currentDifficulty);
  block.header.number = testUtils.fromDecimal(env.currentNumber);

  return block;
};
