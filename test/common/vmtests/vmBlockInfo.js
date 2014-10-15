var testData = require('../../../../tests/vmtests/vmBlockInfoTest.json'),
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  Block = require('../../../lib/block.js'),
  assert = require('assert'),
  levelup = require('levelup'),
  testUtils = require('../../testUtils'),
  rlp = require('rlp'),
  Trie = require('merkle-patricia-tree');

var stateDB = levelup('', {
      db: require('memdown')
  }),
  state = new Trie(stateDB);

describe('[Common]: vmBlockInfoTest', function () {

  describe('coinbase', function () {
    testData = testData.coinbase;

    it('setup the trie', function (done) {
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
    });

    it('run code', function(done) {
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
      account.nonce = testUtils.fromDecimal(acctData.nonce);
      account.balance = testUtils.fromDecimal(acctData.balance);

      var vm = new VM(state);
      vm.runCode({
        account: account,
        origin: new Buffer(testData.exec.origin, 'hex'),
        code:  new Buffer(testData.exec.code.slice(2), 'hex'),  // slice off 0x
        value: testUtils.fromDecimal(testData.exec.value),
        address: new Buffer(testData.exec.address, 'hex'),
        from: new Buffer(testData.exec.caller, 'hex'),
        data:  new Buffer(testData.exec.data.slice(2), 'hex'),  // slice off 0x
        gasLimit: testData.exec.gas,
        block: block
      }, function(err, results) {
        assert(!err);
        assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));

        var keysOfPost = Object.keys(testData.post);
        async.each(keysOfPost, function(key, callback) {
          acctData = testData.post[key];

          var account = results.account;
          assert(testUtils.toDecimal(account.balance) === acctData.balance);
          assert(testUtils.toDecimal(account.nonce) === acctData.nonce);

          state.root = account.stateRoot.toString('hex');

          var storageKeys = Object.keys(acctData.storage);
          storageKeys.forEach(function(skey) {
            state.get(testUtils.address(skey), function(err, data) {
              assert(!err);
              assert(rlp.decode(data).toString('hex') === acctData.storage[skey].slice(2));
              callback();
            });
          });
        }, done);
      });
    });
  });
});
