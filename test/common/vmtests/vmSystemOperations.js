var vmSystemOperationsTest = require('../../../../tests/vmtests/vmSystemOperationsTest.json'),
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  bignum = require('bignum'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: vmSystemOperationsTest', function () {
  var tests = Object.keys(vmSystemOperationsTest);
  // TODO add tests
  tests = [];
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function (done) {
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
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        async.series([
          function(cb) {
            // cb()
            // return

            account = results.account;
            acctData = testData.post[testData.exec.address];
            testUtils.verifyAccountPostConditions(state, account, acctData, cb);
          },

          function() {
            // validate the postcondition of other accounts
            delete testData.post[testData.exec.address];
            var keysOfPost = Object.keys(testData.post);
            async.each(keysOfPost, function(key, cb) {
              state.get(new Buffer(key, 'hex'), function(err, raw) {
                assert(!err);

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

  describe('.', function() {
    var testKey = 'suicideNotExistingAccount';
    var state = new Trie();
    var testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        acctData,
        account,
        runCodeData,
        vm = new VM(state);

      // acctData = testData.pre[testData.exec.address];
      acctData = testData.pre[testData.exec.caller];
      account = new Account();
      account.nonce = testUtils.fromDecimal(acctData.nonce);
      account.balance = testUtils.fromDecimal(acctData.balance);
      // account.balance = testUtils.fromDecimal(testData.exec.gas);

      // runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);

      runCodeData = {
        fromAccount: account,
        origin: new Buffer(testData.exec.origin, 'hex'),
        data:  new Buffer(testData.exec.code.slice(2), 'hex'),  // slice off 0x
        value: bignum(testData.exec.value),
        from: new Buffer(testData.exec.caller, 'hex'),
        to: new Buffer(testData.exec.address, 'hex'),
        gas: testData.exec.gas,
        block: block
      };

      vm.runCall(runCodeData, function(err, results) {
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        async.series([
          function(cb) {
            state.get(new Buffer(testData.exec.address, 'hex'), function(err, raw) {
              assert(!err);
              assert(!raw, 'contract should have been deleted by SUICIDE');
              cb();
            });
          },

          function() {
            // validate the postcondition of other accounts
            // delete testData.post[testData.exec.address];
            var keysOfPost = Object.keys(testData.post);

            var suicideCreated = testData.exec.code.substr(4, 20 * 2);
            assert(keysOfPost.indexOf(suicideCreated) !== -1, 'suicideCreated not in post');

            async.each(keysOfPost, function(key, cb) {
              state.get(new Buffer(key, 'hex'), function(err, raw) {
                assert(!err);

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

  describe('.', function() {
    var testKey = 'suicide0';
    var state = new Trie();
    var testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        runData = testUtils.makeRunCallData(testData, block),
        vm = new VM(state);

      vm.runCall(runData, function(err, results) {
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        var suicideTo = results.vm.suicideTo.toString('hex'),
          keysOfPost = Object.keys(testData.post);
        assert.strictEqual(keysOfPost.length, 1, '#post mismatch');
        assert.strictEqual(suicideTo, keysOfPost[0], 'suicideTo mismatch');

        state.get(new Buffer(suicideTo, 'hex'), function(err, acct) {
          assert(!err);
          var account = new Account(acct),
            acctData = testData.post[suicideTo];
          testUtils.verifyAccountPostConditions(state, account, acctData, done);
        });
      });
    });
  });

  describe('.', function() {
    var testKey = 'suicideSendEtherToMe';
    var state = new Trie();
    var testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function (done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run call', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        runData = testUtils.makeRunCallData(testData, block),
        vm = new VM(state);

      vm.runCall(runData, function(err, results) {
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        var suicideTo = results.vm.suicideTo.toString('hex'),
          keysOfPost = Object.keys(testData.post);
        assert.strictEqual(keysOfPost.length, 1, '#post mismatch');
        assert.notStrictEqual(suicideTo, keysOfPost[0], 'suicideTo should not exist');

        async.series([
          function(cb) {
            state.get(new Buffer(suicideTo, 'hex'), function(err, acct) {
              assert(!err);
              assert(!acct, 'suicide account should be gone');
              cb();
            });
          },
          function() {
            state.get(new Buffer(keysOfPost[0], 'hex'), function(err, acct) {
              assert(!err);
              var account = new Account(acct),
                acctData = testData.post[keysOfPost[0]];
              testUtils.verifyAccountPostConditions(state, account, acctData, done);
            });
          }
        ], done);
      });
    });
  });
});
