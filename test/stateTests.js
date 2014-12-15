var argv = require('minimist')(process.argv.slice(2));

var stateTests = require('ethereum-tests').StateTests;

var  async = require('async'),
  VM = require('../lib/vm'),
  Account = require('../lib/account.js'),
  assert = require('assert'),
  testUtils = require('./testUtils'),
  Trie = require('merkle-patricia-tree');

//for running a single file
if(argv.file){
  var i = {};
  i[argv.file] = stateTests[argv.file];
  stateTests = i;
}


for(var test in stateTests){

  var testDef = stateTests[test];
  
  //for running a sinlge test
  if(argv.test){
    var q = {};
    q[argv.test] = testDef[argv.test];
    testDef = q;
  }

  describe('[state test]: file ' + test, function() {
    var tests = Object.keys(testDef);

    tests.forEach(function(testKey) {
      var state = new Trie();
      var testData = testDef[testKey];

      it(testKey + ' setup the trie', function(done) {
        testUtils.setupPreConditions(state, testData, done);
      });

      it(testKey + ' run code', function(done) {
        var env = testData.env,
          block = testUtils.makeBlockFromEnv(env),
          acctData,
          account,
          vm = new VM(state),
          tx = testUtils.makeTx(testData.transaction);

        if(argv.vmtrace){
          testUtils.enableVMtracing(vm, argv.vmtrace);
        }

        vm.runTx(tx, block, function(err, results) {

          if(err) console.log('error: ' + err);


          if (testData.out.slice(2)) {
            assert.strictEqual(results.vm.returnValue.toString('hex'), testData.out.slice(2), 'invalid return value');
          }

          testUtils.verifyGas(results, testData);

          delete testData.post[testData.env.currentCoinbase]; // coinbase is only done in runBlock

          var keysOfPost = Object.keys(testData.post);
          async.eachSeries(keysOfPost, function(key, cb) {
            state.get(new Buffer(key, 'hex'), function(err, raw) {
              assert(!err);

              account = new Account(raw);
              acctData = testData.post[key];
              testUtils.verifyAccountPostConditions(state, account, acctData, cb);
            });
          }, done);
        });
      });
    });
  });
}
