var stRecursiveCreate = require('ethereum-tests').StateTests.stRecursiveCreate,
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

describe.skip('[Common]: stRecursiveCreate', function () {
  var tests = Object.keys(stRecursiveCreate);

  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = stRecursiveCreate[testKey];

    it(testKey + ' setup the trie', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        acctData,
        account,
        vm = new VM(state),
        tx = testUtils.makeTx(testData.transaction);

      // testUtils.enableVMtracing(vm);

      vm.runTx(tx, block, function(err, results) {
        assert(!err);

        if (testData.out.slice(2)) {
          assert.strictEqual(results.vm.returnValue.toString('hex'), testData.out.slice(2));
        }

        testUtils.verifyGas(results, testData);

        delete testData.post[testData.env.currentCoinbase];  // coinbase is only done in runBlock
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
