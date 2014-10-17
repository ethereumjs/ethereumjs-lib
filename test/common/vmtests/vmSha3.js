var vmSha3Test = require('../../../../tests/vmtests/vmSha3Test.json'),
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  rlp = require('rlp'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: vmSha3', function () {

  var tests = Object.keys(vmSha3Test);
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmSha3Test[testKey];

    it(testKey + ' setup the trie', function (done) {
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
        if (testKey === 'sha3_3') {
          assert(err === 'out of gas');
          done();
          return;
        }

        assert(!err);
        assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));

        async.series([
          function(cb) {
            // validate the postcondition of account
            acctData = testData.post[testData.exec.address];
            account = results.account;
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
                  cb();
                });
              });
            } else {
              cb();
            }
          },

          function(cb) {
            // validate the postcondition of other accounts
            delete testData.post[testData.exec.address];
            var keysOfPost = Object.keys(testData.post);
            async.each(keysOfPost, function(key, callback) {
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
          }
        ]);
      });
    });
  });

});
