var stSystemOperationsTest = require('ethereum-tests').StateTests.stSystemOperationsTest,
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

function expectError(testKey) {
  if (testKey.match(
      /^createNameRegistratorValueTooHigh/)) {
    return true;
  }
  return false;
}

describe('[Common]: stSystemOperationsTest', function() {
  var tests = Object.keys(stSystemOperationsTest);

  tests.forEach(function(testKey) {
    // TODO
    if (testKey.match(
        /^ABAcalls|^CallRecursiveBomb/
      )) {
      return;
    }

    var state = new Trie();
    var testData = stSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function(done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        acctData,
        account,
        vm = new VM(state),
        tx = testUtils.makeTx(testData.transaction);

      vm.runTx(tx, block, function(err, results) {
        if (!expectError(testKey)) {
          assert(!err);
        }

        if (testData.out.slice(2)) {
          assert.strictEqual(results.vm.returnValue.toString('hex'), testData.out.slice(2), 'invalid return value');
        }
        // TODO assert.strictEqual(results.gasUsed.toNumber(),
        //   testData.exec.gas - testData.gas, 'gas used mismatch');


        delete testData.post[testData.env.currentCoinbase]; // coinbase is only done in runBlock

        var keysOfPost = Object.keys(testData.post);
        async.eachSeries(keysOfPost, function(key, cb) {
          state.get(new Buffer(key, 'hex'), function(err, raw) {

            assert(!err);

            account = new Account(raw);

            acctData = testData.post[key];
            testUtils.verifyAccountPostConditions(state, account, acctData, cb);

          });
        }, done);
      });
    });
  });
});
