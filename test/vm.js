var async = require('async'),
  rlp = require('rlp'),
  VM = require('../lib/vm'),
  Account = require('../lib/account.js'),
  Block = require('../lib/block.js'),
  utils = require('../lib/utils.js'),
  Tx = require('../lib/transaction.js'),
  assert = require('assert'),
  levelup = require('levelup'),
  Trie = require('merkle-patricia-tree'),
  testUtils = require('./testUtils'),
  vmTests = require('./fixtures/vmTests.json');

var internals = {},
  stateDB = levelup('', {
    db: require('memdown')
  });

internals.state = new Trie(stateDB);

describe('[VM]: Basic functions', function () {

  it('setup the trie', function (done) {
    var test = vmTests.txTest;
    var account = new Account(test.preFromAccount);
    internals.state.put(new Buffer(test.from, 'hex'), account.serialize(), done);
  });

  it('it should run a transaction', function (done) {
    var test = vmTests.txTest;
    var vm = new VM(internals.state);

    vm.runTx(new Tx(test.tx), function (err, results) {
      assert(results.gasUsed.toNumber() === test.gasUsed, 'invalid gasUsed amount');
      assert(results.fromAccount.raw[0].toString('hex') === test.postFromAccount[0], 'invalid nonce on from account');
      assert(results.fromAccount.raw[1].toString('hex') === test.postFromAccount[1], 'invalid balance on from account');
      assert(results.toAccount.raw[1].toString('hex') === test.postToAccount[1], 'invalid balance on to account');
      done(err);
    });
  });


  it('it should run the CALL op code', function (done) {
    var test = require('./fixtures/vm/call.json');
    stateDB = levelup('', {
      db: require('memdown')
    });

    internals.state = new Trie(stateDB);

    async.each(test.preAccounts, function (accountInfo, done) {
      var account = new Account(accountInfo.account);

      async.parallel([
        async.apply(internals.state.put.bind(internals.state), new Buffer(accountInfo.address, 'hex'), account.serialize()),
        function (done2) {
          if (accountInfo.code) {
            internals.state.db.put(account.codeHash, new Buffer(accountInfo.code, 'hex'), {
              encoding: 'binary'
            }, done2);
          } else {
            done2();
          }
        },
        function (done2) {
          var memTrie = new Trie(stateDB);
          if (accountInfo.memory) {
            async.each(accountInfo.memory, function (mem, done3) {
              memTrie.put(new Buffer(mem.key, 'hex'), new Buffer(mem.value, 'hex'), done3);
            }, function () {
              done2();
            });
          } else {
            done2();
          }
        }

      ], done);

    }, function () {

      var vm = new VM(internals.state),
        tx = new Tx(test.tx);

      vm.runTx(tx, function (err, results) {
        assert(results.gasUsed.toNumber() === test.gasUsed, 'invalid gasUsed amount');

        async.each(test.postAccounts, function (accountInfo, done2) {
          var address = new Buffer(accountInfo.address, 'hex');
          internals.state.get(address, function (err, account) {
            var account = new Account(account);
            //console.log(address.toString('hex'));
            assert(account.nonce.toString('hex') === accountInfo.account[0], 'invalid nonce');
            assert(account.balance.toString('hex') === accountInfo.account[1], 'invalid balance');
            assert(account.stateRoot.toString('hex') === accountInfo.account[2], 'invaid state root');
            assert(account.codeHash.toString('hex') === accountInfo.account[3], 'invaid state root');
            done2();
          });
        }, done);
      });
    });
  });


  // from CallToReturn1
  var env = {
    "currentCoinbase" : "2adc25665018aa1fe0e6bc666dac8fc2697ff9ba",
    "currentDifficulty" : "256",
    "currentGasLimit" : "10000000",
    "currentNumber" : "0",
    "currentTimestamp" : "1",
    "previousHash" : "5e20a0453cecd065ea59c37ac63e079ee08998b6045136a8ce6635c7912ec0b6"
  };

  it('t256sha', function (done) {
    stateDB = levelup('', {
      db: require('memdown')
    });

    internals.state = new Trie(stateDB);

    var vm = new VM(internals.state);

    var block = testUtils.makeBlockFromEnv(env);



    // makeRunCodeData = function(exec, account, block)


    var theCode = '0x60016000546020600060206000601360026009f1';

    var account = new Account();
    account.nonce = testUtils.fromDecimal('0');
    account.balance = testUtils.fromDecimal('1000000000000000000');
    account.codeHash = testUtils.toCodeHash(theCode);

    var expSha256Of1 = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';
    var expSha256Of32bitsWith1 = 'c386d8e8d07342f2e39e189c8e6c57bb205bb373fe4e3a6f69404a8bb767b417';

    runCodeData = {
      account: account,
      origin: new Buffer('cd1722f3947def4cf144679da39c4c32bdc35681', 'hex'),
      code: new Buffer(theCode.slice(2), 'hex'), // slice off 0x
      value: testUtils.fromDecimal('13'),
      address: new Buffer('0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6', 'hex'),
      from: new Buffer('cd1722f3947def4cf144679da39c4c32bdc35681', 'hex'),
      data: new Buffer('0x'.slice(2), 'hex'), // slice off 0x
      gasLimit: '10000000000000',
      gasPrice: testUtils.fromDecimal('100000000000000'),
      block: block
    };
    vm.runCode(runCodeData, function(err, results) {
      // TODO
      done();
    });
  });

  it('ecrec', function (done) {
    stateDB = levelup('', {
      db: require('memdown')
    });

    internals.state = new Trie(stateDB);

    var vm = new VM(internals.state);

    // from CallToReturn1
    var block = new Block();
    block.header.timestamp = testUtils.fromDecimal('1');
    block.header.gasLimit = testUtils.fromDecimal('10000000');
    block.header.parentHash = new Buffer('5e20a0453cecd065ea59c37ac63e079ee08998b6045136a8ce6635c7912ec0b6', 'hex');
    block.header.coinbase = new Buffer('2adc25665018aa1fe0e6bc666dac8fc2697ff9ba', 'hex');
    block.header.difficulty = testUtils.fromDecimal('256');
    block.header.number = testUtils.fromDecimal('0');


    var theCode = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6000547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6020547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6040547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6060546020600060806000601360016009f1';

    var account = new Account();
    account.nonce = testUtils.fromDecimal('0');
    account.balance = testUtils.fromDecimal('1000000000000000000');
    account.codeHash = testUtils.toCodeHash(theCode);

    var expSha256Of1 = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';
    var expSha256Of32bitsWith1 = 'c386d8e8d07342f2e39e189c8e6c57bb205bb373fe4e3a6f69404a8bb767b417';

    runCodeData = {
      account: account,
      origin: new Buffer('cd1722f3947def4cf144679da39c4c32bdc35681', 'hex'),
      code: new Buffer(theCode.slice(2), 'hex'), // slice off 0x
      value: testUtils.fromDecimal('13'),
      address: new Buffer('0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6', 'hex'),
      from: new Buffer('cd1722f3947def4cf144679da39c4c32bdc35681', 'hex'),
      data: new Buffer('0x'.slice(2), 'hex'), // slice off 0x
      gasLimit: '10000000000000',
      gasPrice: testUtils.fromDecimal('100000000000000'),
      block: block
    };
    vm.runCode(runCodeData, function(err, results) {
      // TODO
      done();
    });
  });

});
