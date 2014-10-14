var testData = require('../../../../tests/vmtests/random.json'),
  async = require('async'),
  rlp = require('rlp'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  Block = require('../../../lib/block.js'),
  utils = require('../../../lib/utils.js'),
  Tx = require('../../../lib/transaction.js'),
  assert = require('assert'),
  levelup = require('levelup'),
  Trie = require('merkle-patricia-tree');

var internals = {},
  stateDB = levelup('', {
      db: require('memdown')
  });

internals.state = new Trie(stateDB);
testData = testData.random;

describe('[Common]: VM tests', function () {

  it('setup the trie', function (done) {
    var keysOfPre = Object.keys(testData.pre),
      acctData,
      account;

    async.each(keysOfPre, function(key, callback) {
      acctData = testData.pre[key];

      account = new Account();
      account.nonce = utils.intToBuffer(acctData.nonce);
      account.balance = utils.intToBuffer(acctData.balance);
      // account.stateRoot = new Buffer([0]);
      internals.state.put(new Buffer(key, 'hex'), account.serialize(), callback);
    }, done);
  });

  it('run code', function(done) {
    var env = testData.env,
      block = new Block(),
      acctData,
      account;

    block.header.timestamp = utils.intToBuffer(Number(env.currentTimestamp));
    block.header.gasLimit = utils.intToBuffer(Number(env.currentGasLimit));
    block.header.parentHash = new Buffer(env.previousHash, 'hex');
    block.header.coinbase = new Buffer(env.currentCoinbase, 'hex');
    block.header.difficulty = utils.intToBuffer(Number(env.currentDifficulty));
    block.header.number = utils.intToBuffer(Number(env.currentNumber));

    acctData = testData.pre[testData.exec.address];
    account = new Account();
    account.nonce = utils.intToBuffer(acctData.nonce);
    account.balance = utils.intToBuffer(acctData.balance);

    var vm = new VM(internals.state);
    vm.runCode({
      account: account,
      origin: new Buffer(testData.exec.origin, 'hex'),
      code:  new Buffer(testData.exec.code.slice(2), 'hex'),  // slice off 0x
      value: utils.intToBuffer(testData.exec.value),
      address: new Buffer(testData.exec.address, 'hex'),
      from: new Buffer(testData.exec.caller, 'hex'),
      data:  new Buffer(testData.exec.data.slice(2), 'hex'),  // slice off 0x
      gasLimit: testData.exec.gas,
      block: block
    }, function(err, results) {
      console.log('gas used: ', results.gasUsed.toNumber())
      assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));
      done();
    });
  });
});
