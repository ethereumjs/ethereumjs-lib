var argv = require('minimist')(process.argv.slice(2));
var bignum = require('bignum');
var vmTests = require('ethereum-tests').vmTests;
//CallToPrecompil
var blacklist = [];

var VM = require('../lib/vm'),
  Account = require('../lib/account.js'),
  blockchain = require('./fakeBlockChain.js'),
  assert = require('assert'),
  testUtils = require('./testUtils'),
  Trie = require('merkle-patricia-tree');

for(var prop in vmTests.randomTest){
 vmTests[prop] = vmTests.randomTest[prop];
}

delete vmTests.RandomTests;
delete vmTests.vmSystemOperationsTest;

//for running a single file
if (argv.file) {
  var i = {};
  i[argv.file] = vmTests[argv.file];
  vmTests = i;
}

for (var test in vmTests) {

  var testDef = vmTests[test];

  //for running a sinlge test
  if (argv.test) {
    var q = {};
    q[argv.test] = testDef[argv.test];
    testDef = q;
  }

  describe('[vm test] file ' + test, function() {
    var tests = Object.keys(testDef);

    tests.forEach(function(testKey) {
      if (blacklist.indexOf(testKey) === -1 ) {
        var state = new Trie();
        var testData = testDef[testKey];

        it(testKey + ' setup the trie', function(done) {
          testUtils.setupPreConditions(state, testData, done);
        });

        it(testKey + ' run code', function(done) {
          var env = testData.env,
            block = testUtils.makeBlockFromEnv(env),
            vm = new VM(state);

          var acctData = testData.pre[testData.exec.address];
          var account = new Account();
          account.nonce = testUtils.fromDecimal(acctData.nonce);
          account.balance = testUtils.fromDecimal(acctData.balance);

          var runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);

          if (argv.vmtrace) {
            var sstream = testUtils.enableVMtracing(vm, argv.vmtrace);
          }

          runCodeData.blockchain = blockchain;

          function postTx(err, results) {
            if (sstream) sstream.end();

            if (testData.out && testData.out.slice(2)) {
              assert.strictEqual(results.returnValue.toString('hex'), testData.out.slice(2), 'invalid return value');
            }

            testUtils.verifyLogs(results.logs, testData);
            if(testData.gas){
              assert.equal(bignum(testData.gas).add(results.gasUsed).toString(), testData.exec.gas );
            }else{
              //OOG
              assert.equal(results.gasUsed.toString(), testData.exec.gas );
            }

            done(err);
          }

          state.get(new Buffer(testData.exec.address, 'hex'), function(err, data){
            var a = new Account(data);
            account.stateRoot = a.stateRoot;
            vm.runCode(runCodeData, function(err2, results) {
              if (argv.dumpstate) {
                testUtils.dumpState(state, function() {
                  postTx(err, results);
                });
              } else {
                postTx(err | err2, results);
              }
            });
          });

        });
      }
    });
  });
}
