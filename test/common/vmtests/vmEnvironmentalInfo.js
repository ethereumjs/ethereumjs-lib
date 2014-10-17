var vmEnvironmentalInfoTest = require('../../../../tests/vmtests/vmEnvironmentalInfoTest.json'),
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  assert = require('assert'),
  levelup = require('levelup'),
  testUtils = require('../../testUtils'),
  rlp = require('rlp'),
  Trie = require('merkle-patricia-tree');

var stateDB = levelup('', {
      db: require('memdown')
  }),
  state = new Trie(stateDB);

describe('[Common]: vmEnvironmentalInfoTest', function () {
  var tests = Object.keys(vmEnvironmentalInfoTest);
  // tests.forEach(function(testKey) {
  testKey = 'balance0'
    var testData = vmEnvironmentalInfoTest[testKey];

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
        assert(!err);

console.log('gasUsed: ', results.gasUsed.toNumber())
console.log('exp gasUsed: ', testData.exec.gas - testData.gas)

        // assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));

        var account = results.account;
        assert(testUtils.toDecimal(account.balance) === acctData.balance);
        assert(testUtils.toDecimal(account.nonce) === acctData.nonce);

        var keysOfPost = Object.keys(testData.post);
        var indexOfExecAddress = keysOfPost.indexOf(testData.exec.address);
console.log('indexOfExecAddress: ', indexOfExecAddress)
        if (indexOfExecAddress !== -1) {
          keysOfPost.splice(indexOfExecAddress, 1);
        }

        async.each(keysOfPost, function(key, callback) {
          acctData = testData.post[key];

          state.get(new Buffer(key, 'hex'), function(err, raw) {
            //assert(!err)
            // if (err) {
            //   assert(err)
            //   return;
            // }
            //
            console.log('key: ', key, 'raw: ', raw)
            var account = new Account(raw);

            console.log('bal: ', testUtils.toDecimal(account.balance))
            console.log('acctData: ', acctData, 'exp bal: ', acctData.balance)
            assert(testUtils.toDecimal(account.balance) === acctData.balance);
            assert(testUtils.toDecimal(account.nonce) === acctData.nonce);
            callback();
          });


          // var storageKeys = Object.keys(acctData.storage);
          // if (storageKeys.length > 0) {
          //   state.root = account.stateRoot.toString('hex');
          //   storageKeys.forEach(function(skey) {
          //     state.get(testUtils.address(skey), function(err, data) {
          //       assert(!err);
          //       assert(rlp.decode(data).toString('hex') === acctData.storage[skey].slice(2));
          //       callback();
          //     });
          //   });
          // } else {
          //   callback();
          // }
        }, done);
      });
    });
  // });

});
