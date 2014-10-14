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
      internals.state.put(new Buffer(key, 'hex'), account.serialize(), callback);
    }, done);
  });

  it('run code', function(done) {
    var env = testData.env,
      block = new Block();
    block.header.timestamp = utils.intToBuffer(Number(env.currentTimestamp));
    block.header.gasLimit = utils.intToBuffer(Number(env.currentGasLimit));
    block.header.parentHash = new Buffer(env.previousHash, 'hex');
    block.header.coinbase = new Buffer(env.currentCoinbase, 'hex');
    block.header.difficulty = utils.intToBuffer(Number(env.currentDifficulty));
    block.header.number = utils.intToBuffer(Number(env.currentNumber));

    var vm = new VM(internals.state);
    vm.runCode({
      origin: testData.exec.origin,
      code: testData.exec.code,
      value: testData.exec.value,
      address: testData.exec.address,
      from: testData.exec.caller,
      data: testData.exec.data,
      gasLimit: testData.exec.gas,
      block: block
    }, function(err, results) {
      console.log('gas used: ', results.gasUsed.toNumber())
      assert(results.gasUsed.toNumber() === testData.gas);
      done();
    });
  });
});
