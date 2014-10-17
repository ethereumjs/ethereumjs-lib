var bignum = require('bignum'),
  async = require('async'),
  utils = require('../lib/utils'),
  Account = require('../lib/account.js');
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

/**
 * makeBlockFromEnv - helper to create a block from the env object in tests repo
 * @param {Object} env object from tests repo
 * @return {Object}  the block
 */
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

/**
 * makeRunCodeData - helper to create the object for VM.runCode using
 *   the exec object specified in the tests repo
 * @param {Object} exec    object from the tests repo
 * @param {Object} account that the executing code belongs to
 * @param {Object} block   that the transaction belongs to
 * @return {Object}        object that will be passed to VM.runCode function
 */
exports.makeRunCodeData = function (exec, account, block) {
  return {
    account: account,
    origin: new Buffer(exec.origin, 'hex'),
    code:  new Buffer(exec.code.slice(2), 'hex'),  // slice off 0x
    value: testUtils.fromDecimal(exec.value),
    address: new Buffer(exec.address, 'hex'),
    from: new Buffer(exec.caller, 'hex'),
    data:  new Buffer(exec.data.slice(2), 'hex'),  // slice off 0x
    gasLimit: exec.gas,
    gasPrice: testUtils.fromDecimal(exec.gasPrice),
    block: block
  };
};


exports.setupPreConditions = function(state, testData, done) {
  var keysOfPre = Object.keys(testData.pre),
    acctData,
    account;

  async.each(keysOfPre, function(key, callback) {
    acctData = testData.pre[key];

    account = new Account();
    account.nonce = testUtils.fromDecimal(acctData.nonce);
    account.balance = testUtils.fromDecimal(acctData.balance);
    state.put(new Buffer(key, 'hex'), account.serialize(), callback);
  }, done);
}
