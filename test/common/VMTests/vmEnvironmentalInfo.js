var vmEnvironmentalInfoTest = require('ethereum-tests').VMTests.vmEnvironmentalInfoTest,
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  rlp = require('rlp'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: vmEnvironmentalInfoTest', function () {
  // this test needs to use runCall, since balances are only updated in runCall
  var balance1test = vmEnvironmentalInfoTest.balance1;
  delete vmEnvironmentalInfoTest.balance1;

  var tests = Object.keys(vmEnvironmentalInfoTest);
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmEnvironmentalInfoTest[testKey];

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

  // TODO: tried with runCall and doesn't work
  describe.skip('balance1 test', function() {
    var state = new Trie();
    var testData = balance1test;

    it('setup the pre', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it('run code', function(done) {
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
        assert(!err);
        assert(results.gasUsed.toNumber()
          === (testData.exec.gas - testData.gas), 'gas used mismatch');

        // validate the postcondition of account
        acctData = testData.post[testData.exec.address];
        account = results.account;
        assert(testUtils.toDecimal(account.balance) === acctData.balance);
        assert(testUtils.toDecimal(account.nonce) === acctData.nonce);

        // validate the postcondition of other accounts
        delete testData.post[testData.exec.address];
        var keysOfPost = Object.keys(testData.post);
        async.eachSeries(keysOfPost, function(key, callback) {
          acctData = testData.post[key];

          state.get(new Buffer(key, 'hex'), function(err, raw) {
            assert(!err);

            account = new Account(raw);
            assert(testUtils.toDecimal(account.balance) === acctData.balance);
            assert(testUtils.toDecimal(account.nonce) === acctData.nonce);

            // validate storage
            var storageKeys = Object.keys(acctData.storage);
            if (storageKeys.length > 0) {
              state.root = account.stateRoot.toString('hex');
              storageKeys.forEach(function(skey) {
                state.get(testUtils.address(skey), function(err, data) {
                  assert(!err);
                  assert(rlp.decode(data).toString('hex') === acctData.storage[skey].slice(2));
                  callback();
                });
              });
            } else {
              callback();
            }
          });
        }, done);
      });
    });
  });

});
