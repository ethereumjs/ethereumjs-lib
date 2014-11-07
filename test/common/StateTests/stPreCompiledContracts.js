var stPreCompiledContracts = require('ethereum-tests').StateTests.stPreCompiledContracts,
  async = require('async'),
  VM = require('../../../lib/vm'),
  ERROR = require('../../../lib/vm/constants').ERROR,
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

describe('[Common]: stPreCompiledContracts', function () {
  var tests = Object.keys(stPreCompiledContracts);
  tests = ['CallSha256_0']
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = stPreCompiledContracts[testKey];

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

        async.series([
          function(cb) {
            cb()
            return

            account = results.fromAccount;
            acctData = testData.post[fromAddr];
            testUtils.verifyAccountPostConditions(state, account, acctData, cb);
            console.log('from done')
          },

          function() {
            // validate the postcondition of other accounts
            // delete testData.post[fromAddr];
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
          }
        ]);
      });
    });
  });
});
