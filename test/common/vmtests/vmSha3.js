var vmSha3Test = require('../../../../tests/vmtests/vmSha3Test.json'),
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

describe('[Common]: vmSha3', function () {

  var tests = Object.keys(vmSha3Test);
  tests.forEach(function(testKey) {
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


      var bignum = require('bignum')
      var log = { info: console.log }
      vm.onStep = function (info, done) {
        log.info('vm', bignum(info.pc).toString(16) + ' Opcode: ' + info.opcode + ' Gas: ' + info.gasLeft.toString());

        info.stack.reverse();
        info.stack.forEach(function (item) {
          log.info('vm', '    ' + item.toString('hex'));
        });
        info.stack.reverse();

        done();
      };


      runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);
      vm.runCode(runCodeData, function(err, results) {
        if (testKey === 'sha3_3') {
          assert(err)
          console.log('err: ', err)
          done();
          return;
        }

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
