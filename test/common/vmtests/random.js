var testData = require('ethereum-tests').randomTests[201410211705],
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  testUtils = require('../../testUtils'),
  assert = require('assert'),
  levelup = require('levelup'),
  bignum = require('bignum'),
  Trie = require('merkle-patricia-tree');

var internals = {},
  stateDB = levelup('', {
      db: require('memdown')
  });

internals.state = new Trie(stateDB);
testData = testData.random;

describe.skip('[Common]: VM tests', function () {

  describe('random.json', function () {
    it('setup the trie', function (done) {
      var state = internals.state;
      testUtils.setupPreConditions(internals.state, testData, function() {
        // the exec code is not in the pre, so the code needs to be stored for
        // the account at testData.exec.address
        state.get(new Buffer(testData.exec.address, 'hex'), function(err, raw) {
          assert(!err);

          var code = bignum(testData.exec.code.slice(2), 16).toBuffer(),
            account = new Account(raw);
          testUtils.storeCode(state, testData.exec.address, account, code, done);
        });
      });
    });

    it('run call', function(done) {
      var state = internals.state;
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        runData = testUtils.makeRunCallData(testData, block),
        vm = new VM(state);

      //

      vm.runCall(runData, function(err, results) {
        assert(!err);

        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        var suicideTo = results.vm.suicideTo.toString('hex'),
          keysOfPost = Object.keys(testData.post);

        // assert.strictEqual(keysOfPost.length, 1, '#post mismatch');
        // assert.notStrictEqual(suicideTo, keysOfPost[0], 'suicideTo should not exist');

        async.series([
          function(cb) {
            // verify testData.post[keysOfPost[1]]
            state.get(new Buffer(testData.exec.address, 'hex'), function(err, acct) {
              assert(!err);
              assert(!acct, 'suicide account should be gone');
              cb();
            });
          },
          function() {
            // verify testData.post[keysOfPost[0]]
            state.get(new Buffer(suicideTo, 'hex'), function(err, acct) {
              assert(!err);
              var account = new Account(acct),
                acctData = testData.post[keysOfPost[0]];
              testUtils.verifyAccountPostConditions(state, account, acctData, done);
            });
          }
          // TODO verify testData.post[keysOfPost[2]]
        ], done);
      });

      // var env = testData.env,
      //   block = new Block(),
      //   acctData,
      //   account;
      //
      // block.header.timestamp = testUtils.fromDecimal(env.currentTimestamp);
      // block.header.gasLimit = testUtils.fromDecimal(env.currentGasLimit);
      // block.header.parentHash = new Buffer(env.previousHash, 'hex');
      // block.header.coinbase = new Buffer(env.currentCoinbase, 'hex');
      // block.header.difficulty = testUtils.fromDecimal(env.currentDifficulty);
      // block.header.number = testUtils.fromDecimal(env.currentNumber);
      //
      // acctData = testData.pre[testData.exec.address];
      // account = new Account();
      // account.balance = testUtils.fromDecimal(acctData.balance);
      // // we assume runTx has incremented the nonce
      // account.nonce = bignum(acctData.balance).add(1).toBuffer();
      //
      // var vm = new VM(internals.state);
      // vm.runCall({
      //   // since there is no 'to', an address will be generated for the contract
      //   fromAccount: account,
      //   origin: new Buffer(testData.exec.origin, 'hex'),
      //   data:  new Buffer(testData.exec.code.slice(2), 'hex'),  // slice off 0x
      //
      //   // using account.balance instead testData.exec.value to simulate that
      //   // the generated address is the fromAccount
      //   value: bignum.fromBuffer(account.balance),
      //   from: new Buffer(testData.exec.caller, 'hex'),
      //   gas: testData.exec.gas,
      //   block: block
      // }, function(err, results) {
      //   assert(!err);
      //   assert(results.gasUsed.toNumber()
      //     === (testData.exec.gas - testData.gas), 'gas used mismatch');
      //
      //   var suicideTo = results.vm.suicideTo.toString('hex');
      //   assert(Object.keys(testData.post).indexOf(suicideTo) !== -1);
      //
      //   internals.state.get(new Buffer(suicideTo, 'hex'), function(err, acct) {
      //     assert(!err);
      //     var account = new Account(acct);
      //     var expectedSuicideAcct = testData.post[suicideTo];
      //
      //     assert(testUtils.toDecimal(account.balance) === expectedSuicideAcct.balance);
      //     assert(testUtils.toDecimal(account.nonce) === expectedSuicideAcct.nonce);
      //
      //     // we can't check that 7d577a597b2742b498cb5cf0c26cdcd726d39e6e has
      //     // been deleted/hasBalance0 because the generated address doesn't
      //     // match 7d577a597b2742b498cb5cf0c26cdcd726d39e6e
      //     done();
      //   });
    });
  });
});
