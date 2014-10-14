var testData = require('../../../../tests/vmtests/random.json'),
  async = require('async'),
  rlp = require('rlp'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
  Block = require('../../../lib/block.js'),
  utils = require('../../../lib/utils.js'),
  Tx = require('../../../lib/transaction.js'),
  assert = require('assert'),
  levelup = require('levelup'),
  Trie = require('merkle-patricia-tree');

var internals = {},
  stateDB = levelup('', {
      db: require('memdown')
  });

internals.state = new Trie(stateDB);

describe('[VM]: Basic functions', function () {
  testData = testData.random;

  it('setup the trie', function (done) {
    var pre,
      account;

    // todo async
    testdata.pre.forEach(function(acctData) {
      pre = [
        acctData.nonce,
        acctData.balance,
        // stateRoot?
        // codeHash?
      ];

      account = new Account(pre);
      // internals.state.put(new Buffer(test.from, 'hex'), account.serialize(), done);
    })

    var block = new Block();
    block.header.timestamp = testData.currentTimestamp;
    block.header.gasLimit = testData.currentGasLimit;
    block.header.parentHash = testData.previousHash;
    block.header.coinbase = testData.currentCoinbase;
    block.header.difficulty = testData.currentDifficulty;
    block.header.number = testData.currentNumber;
  });
});
