var stSystemOperationsTest = require('ethereum-tests').StateTests.stSystemOperationsTest,
  async = require('async'),
  VM = require('../../../lib/vm'),
  ERROR = require('../../../lib/vm/constants').ERROR,
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: stSystemOperationsTest', function () {
  var tests = Object.keys(stSystemOperationsTest);
  tests = ['CallToNameRegistrator0']
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = stSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        acctData,
        account,
        runCodeData,
        vm = new VM(state),
        tx = testUtils.makeTx(testData.transaction);


      var fromAddr = tx.getSenderAddress().toString('hex');

      // acctData = testData.pre[testData.exec.address];
      // account = new Account();
      // account.nonce = testUtils.fromDecimal(acctData.nonce);
      // account.balance = testUtils.fromDecimal(acctData.balance);
      //
      // runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);

      vm.runTx(tx, block, function(err, results) {
        assert(!err);
        // assert.strictEqual(results.gasUsed.toNumber(),
        //   testData.exec.gas - testData.gas, 'gas used mismatch');

        // delete testData.post[testData.env.currentCoinbase];  // coinbase is only done in runBlock
        var keysOfPost = Object.keys(testData.post);
        async.eachSeries(keysOfPost, function(key, cb) {
          state.get(new Buffer(key, 'hex'), function(err, raw) {
            assert(!err);

            account = new Account(raw);
            acctData = testData.post[key];
console.log('bal: ', testUtils.toDecimal(account.balance), 'exp: ', acctData.balance)
cb()

            // testUtils.verifyAccountPostConditions(state, account, acctData, cb);
          });
        }, done);
      });
    });
  });
});
