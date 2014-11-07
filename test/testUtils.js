const bignum = require('bignum'),
  async = require('async'),
  assert = require('assert'),
  SHA3 = require('sha3'),
  rlp = require('rlp'),
  utils = require('../lib/utils'),
  Account = require('../lib/account.js'),
  Transaction = require('../lib/transaction.js'),
  Block = require('../lib/block.js');


const testUtils = exports;

exports.makeTx = function(txData) {
  var privKey = new Buffer(txData.secretKey, 'hex'),
    tx = new Transaction([
      bignum(txData.nonce).toBuffer(),
      bignum(txData.gasPrice).toBuffer(),
      bignum(txData.gasLimit).toBuffer(),
      new Buffer(txData.to, 'hex'),
      bignum(txData.value).toBuffer(),
      bignum(txData.data).toBuffer(),
    ]);
  tx.sign(privKey);
  return tx;
}

/**
 * verifyAccountPostConditions using JSON from tests repo
 * @param {[type]}   state    DB/trie
 * @param {[type]}   account  to verify
 * @param {[type]}   acctData postconditions JSON from tests repo
 * @param {Function} cb       completion callback
 */
exports.verifyAccountPostConditions = function(state, account, acctData, cb) {
  // validate the postcondition of account
  assert.strictEqual(testUtils.toDecimal(account.balance), acctData.balance, 'balance mismatch');
  assert.strictEqual(testUtils.toDecimal(account.nonce), acctData.nonce, 'nonce mismatch');

  // validate storage
  var storageKeys = Object.keys(acctData.storage);
  if (storageKeys.length > 0) {
    state.root = account.stateRoot.toString('hex');
    storageKeys.forEach(function(skey) {
      state.get(testUtils.fromAddress(skey), function(err, data) {
        assert(!err);
        assert.strictEqual(rlp.decode(data).toString('hex'),
          acctData.storage[skey].slice(2), 'storage mismatch');
        cb();
      });
    });
  } else {
    console.log('no storage to verify');
    cb();
  }
};

/**
 * makeRunCallData - helper to create the object for VM.runCall using
 *   the exec object specified in the tests repo
 * @param {Object} testData    object from the tests repo
 * @param {Object} block   that the transaction belongs to
 * @return {Object}        object that will be passed to VM.runCall function
 */
exports.makeRunCallData = function(testData, block) {
  var exec = testData.exec,
    acctData = testData.pre[exec.caller],
    account = new Account();

  account.nonce = testUtils.fromDecimal(acctData.nonce);
  account.balance = testUtils.fromDecimal(acctData.balance);

  return {
    fromAccount: account,
    origin: new Buffer(exec.origin, 'hex'),
    data: new Buffer(exec.code.slice(2), 'hex'), // slice off 0x
    value: bignum(exec.value),
    from: new Buffer(exec.caller, 'hex'),
    to: new Buffer(exec.address, 'hex'),
    gas: exec.gas,
    block: block
  };
};

/**
 * makeRunCallDataWithAccount - helper to create the object for VM.runCall using
 *   the exec object specified in the tests repo
 * @param {Object} testData    object from the tests repo
 * @param {Object} account that is making the call
 * @param {Object} block   that the transaction belongs to
 * @return {Object}        object that will be passed to VM.runCall function
 */
exports.makeRunCallDataWithAccount = function(testData, account, block) {
  var exec = testData.exec;
  return {
    fromAccount: account,
    origin: new Buffer(exec.origin, 'hex'),
    data: new Buffer(exec.code.slice(2), 'hex'), // slice off 0x
    value: bignum(exec.value),
    from: new Buffer(exec.caller, 'hex'),
    to: new Buffer(exec.address, 'hex'),
    gas: exec.gas,
    block: block
  };
};

/**
 * toDecimal - converts buffer to decimal string, no leading zeroes
 * @param  {Buffer}
 * @return {String}
 */
exports.toDecimal = function(buffer) {
  return bignum.fromBuffer(buffer).toString();
};

/**
 * fromDecimal - converts decimal string to buffer
 * @param {String}
 *  @return {Buffer}
 */
exports.fromDecimal = function(string) {
  return utils.intToBuffer(parseInt(string, 10));
};

/**
 * fromAddress - converts hexString address to 256-bit buffer
 * @param  {String} hexString address for example '0x03'
 * @return {Buffer}
 */
exports.fromAddress = function(hexString) {
  hexString = hexString.substring(2);
  return utils.pad256(bignum(hexString, 16).toBuffer());
};

/**
 * toCodeHash - applies sha3 to hexCode
 * @param {String} hexCode string from tests repo
 * @return {Buffer}
 */
exports.toCodeHash = function(hexCode) {
  hexCode = hexCode.substring(2);
  var hash = new SHA3.SHA3Hash(256);
  hash.update(hexCode, 'hex');
  return new Buffer(hash.digest('hex'), 'hex');
};

/**
 * makeBlockFromEnv - helper to create a block from the env object in tests repo
 * @param {Object} env object from tests repo
 * @return {Object}  the block
 */
exports.makeBlockFromEnv = function(env) {
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
exports.makeRunCodeData = function(exec, account, block) {
  return {
    account: account,
    origin: new Buffer(exec.origin, 'hex'),
    code: new Buffer(exec.code.slice(2), 'hex'), // slice off 0x
    value: testUtils.fromDecimal(exec.value),
    address: new Buffer(exec.address, 'hex'),
    from: new Buffer(exec.caller, 'hex'),
    data: new Buffer(exec.data.slice(2), 'hex'), // slice off 0x
    gasLimit: exec.gas,
    gasPrice: testUtils.fromDecimal(exec.gasPrice),
    block: block
  };
};

/**
 * storeCode for a given account
 * @param {[type]}   state    trie/DB
 * @param {[type]}   address  of account
 * @param {[type]}   account  for which code belongs to
 * @param {[type]}   code     to store
 * @param {Function} callback completion
 */
exports.storeCode = function(state, address, account, code, callback) {
  account.storeCode(state, code, function(err, codeHash) {
    if (err) {
      callback(err);
    } else {
      account.codeHash = codeHash;
      state.put(new Buffer(address, 'hex'), account.serialize(), callback);
    }
  });
};

/**
 * setupPreConditions given JSON testData
 * @param {[type]}   state    - the state DB/trie
 * @param {[type]}   testData - JSON from tests repo
 * @param {Function} done     - callback when function is completed
 */
exports.setupPreConditions = function(state, testData, done) {
  var keysOfPre = Object.keys(testData.pre),
    acctData,
    account;

  async.eachSeries(keysOfPre, function(key, callback) {
    acctData = testData.pre[key];

    //convert to buffer
    acctData.code = bignum(acctData.code.slice(2), 16).toBuffer();

    account = new Account();
    account.nonce = testUtils.fromDecimal(acctData.nonce);
    account.balance = testUtils.fromDecimal(acctData.balance);

    async.series([
      function(cb2) {
        if (acctData.code.toString('hex') !== '00') {
          account.storeCode(state, acctData.code, cb2);
        } else {
          cb2();
        }
      },
      function(cb2){
        state.put(new Buffer(key, 'hex'), account.serialize(), cb2);
      }
    ], callback);

  }, done);
};
