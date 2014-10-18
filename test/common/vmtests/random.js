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
      account.balance = testUtils.fromDecimal(acctData.balance);
      // we assume runTx has incremented the nonce
      account.nonce = bignum(acctData.balance).add(1).toBuffer();

      var vm = new VM(internals.state);
      vm.runCall({
        // since there is no 'to', an address will be generated for the contract
        fromAccount: account,
        origin: new Buffer(testData.exec.origin, 'hex'),
        data:  new Buffer(testData.exec.code.slice(2), 'hex'),  // slice off 0x

        // using account.balance instead testData.exec.value to simulate that
        // the generated address is the fromAccount
        value: bignum.fromBuffer(account.balance),
        from: new Buffer(testData.exec.caller, 'hex'),
        gas: testData.exec.gas,
        block: block
      }, function(err, results) {
        assert(!err);
        assert(results.gasUsed.toNumber()
          === (testData.exec.gas - testData.gas), 'gas used mismatch');

        var suicideTo = results.vm.suicideTo.toString('hex');
        assert(Object.keys(testData.post).indexOf(suicideTo) !== -1);

        internals.state.get(new Buffer(suicideTo, 'hex'), function(err, acct) {
          assert(!err);
          var account = new Account(acct);
          var expectedSuicideAcct = testData.post[suicideTo];

          assert(testUtils.toDecimal(account.balance) === expectedSuicideAcct.balance);
          assert(testUtils.toDecimal(account.nonce) === expectedSuicideAcct.nonce);

          // we can't check that 7d577a597b2742b498cb5cf0c26cdcd726d39e6e has
          // been deleted/hasBalance0 because the generated address doesn't
          // match 7d577a597b2742b498cb5cf0c26cdcd726d39e6e
          done();
        });
      });
    });
  });
});
