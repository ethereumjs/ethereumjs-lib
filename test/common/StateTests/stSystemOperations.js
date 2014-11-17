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

describe('[Common]: stSystemOperationsTest FAST ONLY', function () {
  var tests = Object.keys(stSystemOperationsTest);
  tests.forEach(function(testKey) {
    if (testKey.match(
      /^ABAcalls1$|^ABAcalls2$|^ABAcalls3$|^CallRecursiveBomb/
    )) { return; }

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
        vm = new VM(state),
        tx = testUtils.makeTx(testData.transaction);

      // testUtils.enableVMtracing(vm);

      vm.runTx(tx, block, function(err, results) {
        if (!expectError(testKey)) {
          assert(!err);
        }

        if (testData.out.slice(2)) {
          assert.strictEqual(results.vm.returnValue.toString('hex'), testData.out.slice(2), 'invalid return value');
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

// these need mocha --timeout 900000
describe.skip('[Common]: stSystemOperationsTest ALL', function () {
  var tests = Object.keys(stSystemOperationsTest);
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
        vm = new VM(state),
        tx = testUtils.makeTx(testData.transaction);

      // testUtils.enableVMtracing(vm);

      vm.runTx(tx, block, function(err, results) {
        if (!expectError(testKey)) {
          assert(!err);
        }

        if (testData.out.slice(2)) {
          assert.strictEqual(results.vm.returnValue.toString('hex'), testData.out.slice(2), 'invalid return value');
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
