var testData = require('../../../../tests/vmtests/random.json'),
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  Block = require('../../../lib/block.js'),
  testUtils = require('../../testUtils'),
  assert = require('assert'),
  levelup = require('levelup'),
  bignum = require('bignum'),
  Trie = require('merkle-patricia-tree');

var internals = {},
  stateDB = levelup('', {
      db: require('memdown')
  });

internals.state = new Trie(stateDB);
testData = testData.random;

describe('[Common]: VM tests', function () {

  describe('random.json', function () {
    it('setup the trie', function (done) {
      var keysOfPre = Object.keys(testData.pre),
        acctData,
        account;

      async.each(keysOfPre, function(key, callback) {
        acctData = testData.pre[key];

        account = new Account();
        account.nonce = testUtils.fromDecimal(acctData.nonce);
        account.balance = testUtils.fromDecimal(acctData.balance);
        internals.state.put(new Buffer(key, 'hex'), account.serialize(), callback);
      }, done);
    });

    it('run call', function(done) {
      var env = testData.env,
        block = new Block(),
        acctData,
        account;

      block.header.timestamp = testUtils.fromDecimal(env.currentTimestamp);
      block.header.gasLimit = testUtils.fromDecimal(env.currentGasLimit);
      block.header.parentHash = new Buffer(env.previousHash, 'hex');
      block.header.coinbase = new Buffer(env.currentCoinbase, 'hex');
      block.header.difficulty = testUtils.fromDecimal(env.currentDifficulty);
      block.header.number = testUtils.fromDecimal(env.currentNumber);

      acctData = testData.pre[testData.exec.address];
      account = new Account();
      account.nonce = testUtils.fromDecimal('1');  // 1 because we assume runTx has incremented it
      account.balance = testUtils.fromDecimal(acctData.balance);

      var vm = new VM(internals.state);
      vm.runCall({
        fromAccount: account,
        origin: new Buffer(testData.exec.origin, 'hex'),
        data:  new Buffer(testData.exec.code.slice(2), 'hex'),  // slice off 0x

        // using account.balance instead testData.exec.value to simulate that
        // the generated address is the fromAccount
        value: bignum.fromBuffer(account.balance),
        // to: new Buffer(testData.exec.address, 'hex'),
        from: new Buffer(testData.exec.caller, 'hex'),
        //data:  new Buffer(testData.exec.data.slice(2), 'hex'),  // slice off 0x
        gas: testData.exec.gas,
        block: block
      }, function(err, results) {
        assert(!err);
        console.log('res: ', results)
        assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));

        internals.state.get(new Buffer('0000000000000000000000000000000000000001', 'hex'), function(err, acct) {

        // internals.state.get(new Buffer('7d577a597b2742b498cb5cf0c26cdcd726d39e6e', 'hex'), function(err, acct) {

          var account = new Account(acct);

          console.log('data: ', account.balance.toString('hex'))
          done();
        })
      });
    });
  });
});
