var vmEnvironmentalInfoTest = require('ethereum-tests').VMTests.vmEnvironmentalInfoTest,
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: vmEnvironmentalInfoTest', function() {
  var tests = Object.keys(vmEnvironmentalInfoTest);

  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmEnvironmentalInfoTest[testKey];

    it(testKey + ' setup the pre', function(done) {
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

        var gasAmount = testData.exec.gas - testData.gas;
        assert(!err, 'err: ' + err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch, wanted : ' + gasAmount + ' got:' + results.gasUsed.toNumber());

        async.series([
          function(cb) {
            // validate the toAccount's postcondition.
            // toAccount is the account executing the code, ie testData.exec.address.
            // accounts are only saved in runCall(), so to check the toAccount,
            // results.account has to be used.  (results.account would have
            // been saved if runCall() had been called)
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
});
