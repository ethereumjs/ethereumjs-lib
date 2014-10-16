var vmBlockInfoTest = require('../../../../tests/vmtests/vmBlockInfoTest.json'),
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

describe('[Common]: vmBlockInfoTest', function () {

  describe.skip('number', function () {
    var testData = vmBlockInfoTest.number;

    it('setup the trie', function (done) {
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

    it('run code', function(done) {
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
        assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));

        var keysOfPost = Object.keys(testData.post);
        async.each(keysOfPost, function(key, callback) {
          acctData = testData.post[key];

          var account = results.account;
          assert(testUtils.toDecimal(account.balance) === acctData.balance);
          assert(testUtils.toDecimal(account.nonce) === acctData.nonce);

console.log('root: ', account.stateRoot);
console.log('root hex: ', account.stateRoot.toString('hex'));
          // state.root = account.stateRoot.toString('hex');

          var utils = require('../../../lib/utils');
          state.root = utils.zero256();


          var storageKeys = Object.keys(acctData.storage);
          storageKeys.forEach(function(skey) {
            state.get(testUtils.address(skey), function(err, data) {
              assert(!err);
              assert(rlp.decode(data).toString('hex') === acctData.storage[skey].slice(2));
              callback();
            });
          });
        }, done);
      });
    });
  });

  var tests = Object.keys(vmBlockInfoTest);
  tests.forEach(function(testKey) {
    var testData = vmBlockInfoTest[testKey];

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
        assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));

        var keysOfPost = Object.keys(testData.post);
        async.each(keysOfPost, function(key, callback) {
          acctData = testData.post[key];

          var account = results.account;
          assert(testUtils.toDecimal(account.balance) === acctData.balance);
          assert(testUtils.toDecimal(account.nonce) === acctData.nonce);

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
        }, done);
      });
    });
  });

});
