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
  // tests = ['CallSha256_0']
  tests = tests.filter(function(t) {
    return t.indexOf('CallSha256') >= 0;
  })

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

      vm.runTx(tx, block, function(err, results) {
        assert(!err);
        // assert.strictEqual(results.gasUsed.toNumber(),
        //   testData.exec.gas - testData.gas, 'gas used mismatch');

        delete testData.post[testData.env.currentCoinbase];  // coinbase is only done in runBlock
        var keysOfPost = Object.keys(testData.post);
        async.eachSeries(keysOfPost, function(key, cb) {
          state.get(new Buffer(key, 'hex'), function(err, raw) {
            assert(!err);

            account = new Account(raw);
            acctData = testData.post[key];
      // console.log('bal: ', testUtils.toDecimal(account.balance), 'exp: ', acctData.balance)
            testUtils.verifyAccountPostConditions(state, account, acctData, cb);
          });
        }, done);
      });
    });
  });
});
