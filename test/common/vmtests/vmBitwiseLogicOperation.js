var vmBitwiseLogicOperationTest = require('ethereum-tests').vmtests.vmBitwiseLogicOperationTest,
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  Trie = require('merkle-patricia-tree');

const bignum=require('bignum')

describe('[Common]: vmBitwiseLogicOperationTest', function () {
  var tests = Object.keys(vmBitwiseLogicOperationTest);
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmBitwiseLogicOperationTest[testKey];

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



vm.onStep = function(info, done) {
  console.log('vm', bignum(info.pc).toString(16) + ' Opcode: ' + info.opcode + ' Gas: ' + info.gasLeft.toString());

  // var stream = vm.trie.createReadStream();
  // stream.on("data", function(data) {
  //   var account = new Account(data.value);
  //   console.log("key: " + data.key.toString("hex"));
  //   //console.log(data.value.toString('hex'));
  //   console.log('decoded:' + bignum.fromBuffer(account.balance).toString() + '\n');
  // });
  // stream.on('end', done);

  info.stack.reverse();
  info.stack.forEach(function (item) {
    console.log('vm', '    ' + item.toString('hex'));
  });
  info.stack.reverse();
  done();
};


      acctData = testData.pre[testData.exec.address];
      account = new Account();
      account.nonce = testUtils.fromDecimal(acctData.nonce);
      account.balance = testUtils.fromDecimal(acctData.balance);

      runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);
      vm.runCode(runCodeData, function(err, results) {
        assert(!err, 'err: ' + err);
        // assert.strictEqual(results.gasUsed.toNumber(),
        //   testData.exec.gas - testData.gas);

        async.series([
          function(cb) {
            account = results.account;
            acctData = testData.post[testData.exec.address];
            testUtils.verifyAccountPostConditions(state, account, acctData, cb);
          },

          function() {
            var keysOfPost = Object.keys(testData.post);
            async.each(keysOfPost, function(key, cb) {
              state.get(new Buffer(key, 'hex'), function(err, raw) {
                assert(!err, 'err: ' + err);

                account = new Account(raw);
                acctData = testData.post[key];

console.log('key: ', key, 'acctData: ', acctData)                

                testUtils.verifyAccountPostConditions(state, account, acctData, cb);
              });
            }, done);
          }
        ]);
      });
    });
  });
});
