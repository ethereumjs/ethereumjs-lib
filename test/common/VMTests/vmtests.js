var vmtests = require('ethereum-tests').VMTests.vmtests,
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: vmtests', function () {
  var tests = Object.keys(vmtests);
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmtests[testKey],
      account;

    it(testKey + ' setup the pre', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' setup the exec account', function (done) {
      testUtils.makeExecAccount(state, testData, function(err, execAcct) {
        assert(!err);
        account = execAcct;
        done();
      });
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        runCodeData,
        vm = new VM(state);

      runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);
      vm.runCode(runCodeData, function(err, results) {
        assert(!err, 'err: ' + err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        async.series([
          function(cb) {
            var account = results.account,
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

                var account = new Account(raw),
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
