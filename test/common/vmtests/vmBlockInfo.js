var testData = require('../../../../tests/vmtests/vmBlockInfoTest.json'),
  async = require('async'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  Block = require('../../../lib/block.js'),
  utils = require('../../../lib/utils.js'),
  assert = require('assert'),
  levelup = require('levelup'),
  testUtils = require('../../testUtils'),
  rlp = require('rlp'),
  Trie = require('merkle-patricia-tree');

var internals = {},
  stateDB = levelup('', {
      db: require('memdown')
  });

internals.state = new Trie(stateDB);

describe('[Common]: vmBlockInfoTest', function () {

  describe('coinbase', function () {
    testData = testData.coinbase;

    it('setup the trie', function (done) {
      var keysOfPre = Object.keys(testData.pre),
        acctData,
        account;

      async.each(keysOfPre, function(key, callback) {
        acctData = testData.pre[key];

        account = new Account();
console.log('***** typeof ', typeof acctData.nonce)
        account.nonce = utils.intToBuffer(acctData.nonce);
        account.balance = utils.intToBuffer(acctData.balance);
        internals.state.put(new Buffer(key, 'hex'), account.serialize(), callback);
      }, done);
    });

    it('run code', function(done) {
      var env = testData.env,
        block = new Block(),
        acctData,
        account;

      block.header.timestamp = testUtils.fromDecimal(env.currentTimestamp);
      block.header.gasLimit = testUtils.fromDecimal(env.currentGasLimit);
      block.header.parentHash = new Buffer(env.previousHash, 'hex');
      block.header.coinbase = new Buffer(env.currentCoinbase, 'hex');
      block.header.difficulty = testUtils.fromDecimal(env.currentDifficulty);
      block.header.number = testUtils.fromDecimal(env.currentNumber);

      acctData = testData.pre[testData.exec.address];
      account = new Account();
      account.nonce = utils.intToBuffer(acctData.nonce);
      account.balance = utils.intToBuffer(acctData.balance);

      var vm = new VM(internals.state);
      vm.runCode({
        account: account,
        origin: new Buffer(testData.exec.origin, 'hex'),
        code:  new Buffer(testData.exec.code.slice(2), 'hex'),  // slice off 0x
        value: utils.intToBuffer(testData.exec.value),
        address: new Buffer(testData.exec.address, 'hex'),
        from: new Buffer(testData.exec.caller, 'hex'),
        data:  new Buffer(testData.exec.data.slice(2), 'hex'),  // slice off 0x
        gasLimit: testData.exec.gas,
        block: block
      }, function(err, results) {
        assert(!err);
        assert(results.gasUsed.toNumber() === (testData.exec.gas - testData.gas));

        var keysOfPost = Object.keys(testData.post);
        async.each(keysOfPost, function(key, callback) {
          acctData = testData.post[key];

          console.log('results.account: ', results.account)

          var account = results.account;   // new Account(results.account);


          // console.log('codeHash: ', account.codeHash.toString('hex'))
console.log('bal: ', account.balance.toString('hex'))
console.log('exbal: ', acctData.balance)

console.log('nonce: ', account.nonce.toString('hex'))

          // console.log('account.stateRoot hex: ', account.stateRoot.toString('hex'))


          assert(testUtils.toDecimal(account.balance) === acctData.balance);
          assert(testUtils.toDecimal(account.nonce) === acctData.nonce);

          internals.state.root = account.stateRoot.toString('hex');

          var storageKeys = Object.keys(acctData.storage);
          storageKeys.forEach(function(skey) {
            var address = !parseInt(skey, 16) ? utils.zero256() : skey;
            internals.state.get(address, function(err, data) {
              console.log('storage data: ', rlp.decode(data).toString('hex'))

              assert(rlp.decode(data).toString('hex') === acctData.storage['0x'].slice(2))
              callback();
            });

          });

          // internals.state.get(new Buffer([0]), function(err, data) {


          // internals.state.get(new Buffer(key, 'hex'), function(err, acct) {
          //   console.log('acct: ', acct)


            // console.log('data: ', account.balance.toString('hex'), 'expected: ', acctData.balance)
            // assert(account.balance.toString('hex') === acctData.balance)


            //console.log('data: ', account.stateRoot.toString('hex'), 'expected: ', acctData.storage)
            // assert(account.balance.toString('hex') === acctData.balance)


            // console.log('data: ', account.balance.toString('hex'))
          // })

          // account = new Account();
          // account.nonce = utils.intToBuffer(acctData.nonce);
          // account.balance = utils.intToBuffer(acctData.balance);
          // internals.state.put(new Buffer(key, 'hex'), account.serialize(), callback);
        }, done);


        // internals.state.get(new Buffer('7d577a597b2742b498cb5cf0c26cdcd726d39e6e', 'hex'), function(err, acct) {
        //
        //   var account = new Account(acct);
        //
        //   console.log('data: ', account.balance.toString('hex'))
        // })

        // done();
      });
    });
  });
});
