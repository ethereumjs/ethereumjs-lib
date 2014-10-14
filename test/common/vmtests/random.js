var testData = require('../../../../tests/vmtests/random.json'),
  async = require('async'),
  rlp = require('rlp'),
  VM = require('../../../lib/vm'),
  Account = require('../../../lib/account.js'),
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
  it('setup the trie', function (done) {
      // var test = vmTests.txTest;
      // var account = new Account(test.preFromAccount);
      // internals.state.put(new Buffer(test.from, 'hex'), account.serialize(), done);
  });
});
