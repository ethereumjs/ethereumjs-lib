var vmPushDupSwapTest = require('ethereum-tests').VMTests.vmPushDupSwapTest,
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: vmPushDupSwapTest', function () {
  // var dup2error = vmPushDupSwapTest.dup2error;
  // var push32error = vmPushDupSwapTest.push32error;
  // var swap2error = vmPushDupSwapTest.swap2error;

  delete vmPushDupSwapTest.dup2error;
  delete vmPushDupSwapTest.push32error;
  delete vmPushDupSwapTest.swap2error;

  var tests = Object.keys(vmPushDupSwapTest);
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmPushDupSwapTest[testKey];

    it(testKey + ' setup the pre', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        acctData,
        account,
        runCodeData,
        vm = new VM(state);

      acctData = testData.pre[testData.exec.address];
      account = new Account();
      account.nonce = testUtils.fromDecimal(acctData.nonce);
      account.balance = testUtils.fromDecimal(acctData.balance);

      runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);
      vm.runCode(runCodeData, function(err, results) {
        assert(!err, 'err: ' + err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        async.series([
          function(cb) {
            account = results.account;
            acctData = testData.post[testData.exec.address];
            testUtils.verifyAccountPostConditions(state, account, acctData, cb);
          },

          function() {
            // validate the postcondition of other accounts
            delete testData.post[testData.exec.address];
            var keysOfPost = Object.keys(testData.post);
            async.eachSeries(keysOfPost, function(key, cb) {
              state.get(new Buffer(key, 'hex'), function(err, raw) {
                assert(!err, 'err: ' + err);

                account = new Account(raw);
                acctData = testData.post[key];
                testUtils.verifyAccountPostConditions(state, account, acctData, cb);
              });
            }, done);
          }
        ]);
      });
    });
  });

  it('TODO: error tests');
});
