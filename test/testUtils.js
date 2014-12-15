const bignum = require('bignum'),
  fs = require('fs'),
  async = require('async'),
  assert = require('assert'),
  SHA3 = require('sha3'),
  rlp = require('rlp'),
  JSONStream = require('JSONStream'),
  utils = require('../lib/utils'),
  Account = require('../lib/account.js'),
  Transaction = require('../lib/transaction.js'),
  Block = require('../lib/block.js');


const testUtils = exports;

const EMPTY_ACCOUNT_JSON = JSON.stringify([
  '00',
  '00',
  utils.emptyRlpHash().toString('hex'),
  utils.emptyHash().toString('hex')
]);


/**
 * makeTx using JSON from tests repo
 * @param {[type]} txData the transaction object from tests repo
 * @return {Object}        object that will be passed to VM.runTx function
 */
exports.makeTx = function(txData) {
  var privKey = new Buffer(txData.secretKey, 'hex'),
    tx = new Transaction([
      bignum(txData.nonce).toBuffer(),
      bignum(txData.gasPrice).toBuffer(),
      bignum(txData.gasLimit).toBuffer(),
      new Buffer(txData.to, 'hex'),
      bignum(txData.value).toBuffer(),
      new Buffer(txData.data.slice(2), 'hex')  // slice off 0x
    ]);
  tx.sign(privKey);
  return tx;
};

/**
 * verifyAccountPostConditions using JSON from tests repo
 * @param {[type]}   state    DB/trie
 * @param {[type]}   account  to verify
 * @param {[type]}   acctData postconditions JSON from tests repo
 * @param {Function} cb       completion callback
 */
exports.verifyAccountPostConditions = function(state, account, acctData, cb) {
  if (testUtils.verifyEmptyAccount(account, acctData)) {
    cb();
    return;
  }

  assert.strictEqual(testUtils.toDecimal(account.balance), acctData.balance, 'balance mismatch');
  assert.strictEqual(testUtils.toDecimal(account.nonce), acctData.nonce, 'nonce mismatch');

  // validate storage
  var origRoot = state.root,
    storageKeys = Object.keys(acctData.storage);

  if (storageKeys.length > 0) {
    state.root = account.stateRoot.toString('hex');
    async.eachSeries(storageKeys, function(skey, cb2) {
      state.get(testUtils.fromAddress(skey), function(err, data) {
        assert(!err);
        assert.strictEqual(rlp.decode(data).toString('hex'),
          acctData.storage[skey].slice(2), 'invalid storage result');
        cb2();
      });
    }, function() {
      state.root = origRoot;
      cb();
    });
  } else {
    console.log('no storage to verify');
    cb();
  }
};

/**
 * verifyGas by computing the difference of coinbase account balance
 * @param {Object} results  to verify
 * @param {Object} testData from tests repo
 */
exports.verifyGas = function(results, testData) {
  var coinbaseAddr = testData.env.currentCoinbase,
    preBal = testData.pre[coinbaseAddr] ? testData.pre[coinbaseAddr].balance : 0,
    postBal,
    gasUsed;

  if (!testData.post[coinbaseAddr]) {
    assert.deepEqual(testData.pre, testData.post);
    console.log('gas NOT checked: invalid tx');
    return;
  }

  postBal = bignum(testData.post[coinbaseAddr].balance);
  gasUsed = postBal.sub(preBal).toString();
  assert.strictEqual(results.gasUsed.toString(), gasUsed);
};

/**
 * verifyEmptyAccount using JSON from tests repo
 * @param {[type]}   account  to verify
 * @param {[type]}   acctData postconditions JSON from tests repo
 */
exports.verifyEmptyAccount = function(account, acctData) {
  if (!acctData ||
      (acctData.balance === '0' &&
      acctData.code === '0x' &&
      acctData.nonce === '0' &&
      JSON.stringify(acctData.storage) === '{}')) {
    assert.strictEqual(JSON.stringify(account), EMPTY_ACCOUNT_JSON);
    return true;
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
 * enableVMtracing - set up handler to output VM trace on console
 * @param {[type]} vm - the VM object
 * @param file
 */
exports.enableVMtracing = function(vm, file) {
  
  var stringify = JSONStream.stringify();
  stringify.pipe(fs.createWriteStream(file));

  vm.onStep = function(info, done) {

    var logObj = {
      pc: bignum(info.pc).toString(16),
      opcode: info.opcode,
      gas: info.gasLeft.toString(),
      stack: []
    };

    var stack = info.stack.slice().reverse();
    stack.forEach(function (item) {
      logObj.stack.push(item.toString('hex'));
    });


    stringify.write(logObj);
    
    // for debugging storage
    // var stream = vm.trie.createReadStream();
    // stream.on("data", function(data) {
    //   var account = new Account(data.value);
    //   console.log("key: " + data.key.toString("hex"));
    //   //console.log(data.value.toString('hex'));
    //   console.log('decoded:' + bignum.fromBuffer(account.balance).toString() + '\n');
    // });
    //
    // stream.on('end', done);

    done();
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

exports.makeExecAccount = function(state, testData, done) {
  var address = testData.exec.address,
    code = new Buffer(testData.exec.code.slice(2), 'hex'), // slice off 0x
    acctData = testData.pre[address],
    account = new Account();

  account.nonce = testUtils.fromDecimal(acctData.nonce);
  account.balance = testUtils.fromDecimal(acctData.balance);
  testUtils.storeCode(state, address, account, code, function(err, execAcct) {
    if (err) {
      done(err);
      return;
    }
    done(null, execAcct);
  });
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
 * @param {Trie}   state    trie/DB
 * @param {String}   address  of account
 * @param {Account}   account  for which code belongs to
 * @param {Buffer}   code     to store
 * @param {Function} callback completion
 */
exports.storeCode = function(state, address, account, code, callback) {
  account.storeCode(state, code, function(err, codeHash) {
    if (err) {
      callback(err);
    } else {
      account.codeHash = codeHash;
      state.put(new Buffer(address, 'hex'), account.serialize(), function(err) {
        if (err) {
          callback(err);
          return;
        }
        account.stateRoot = state.root;
        callback(null, account);
      });
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
    account,
    codeBuf;

  async.eachSeries(keysOfPre, function(key, callback) {
    acctData = testData.pre[key];

    account = new Account();
    account.nonce = testUtils.fromDecimal(acctData.nonce);
    account.balance = testUtils.fromDecimal(acctData.balance);

    codeBuf = bignum(acctData.code.slice(2), 16).toBuffer();
    async.series([
      function(cb2) {
        if (codeBuf.toString('hex') !== '00') {
          account.storeCode(state, codeBuf, cb2);
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
