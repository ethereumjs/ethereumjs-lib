var vmIOandFlowOperationsTest = require('../../../../tests/vmtests/vmIOandFlowOperationsTest.json'),
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');


function expectError(testKey, error) {
  if (testKey.match(
    /(^dupAt51doesNotExistAnymore$|^swapAt52doesNotExistAnymore$)/)) {
    assert.strictEqual(error, 'invalid opcode');
    return true;
  } else if (testKey.match(
    /(^jump0$|^jump0_jumpdest1$|^jumpi0$)/)) {
    assert.strictEqual(error, 'jump destination must have be preceded by a JUMPDEST opcode');
    return true;
  } else if (testKey.match(
    /(^pop1$)/)) {
    assert.strictEqual(error, 'stack underflow');
    return true;
  }

  return false;
}

describe('[Common]: vmIOandFlowOperationsTest', function () {
  // var jump0_foreverOutOfGas = vmIOandFlowOperationsTest.jump0_foreverOutOfGas;
  // var mloadOutOfGasError2 = vmIOandFlowOperationsTest.mloadOutOfGasError2;

  delete vmIOandFlowOperationsTest.jump0_foreverOutOfGas;
  delete vmIOandFlowOperationsTest.mloadOutOfGasError2;

  var tests = Object.keys(vmIOandFlowOperationsTest);
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmIOandFlowOperationsTest[testKey];

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
        if (expectError(testKey, err)) {
          done();
          return;
        }

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
            async.each(keysOfPost, function(key, cb) {
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

  it('TODO: out of gas error tests');
});
