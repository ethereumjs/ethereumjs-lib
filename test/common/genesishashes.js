var genesisData = require('../../../tests/genesishashestest.json'),
  assert = require('assert'),
  Blockchain = require('../../lib/blockchain.js'),
  Block = require('../../lib/block.js'),
  levelup = require('levelup'),
  utils = require('../../lib/utils'),
  rlp = require('rlp'),
  SHA3 = require('sha3');

var blockDB = levelup('', {
  db: require('memdown')
}),
  detailsDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  internals = {};

describe('[Common]: genesis hashes tests', function () {
  it('should create a new block chain', function (done) {
    internals.blockchain = new Blockchain(blockDB, detailsDB);
    internals.blockchain.init(done);
  });

  it('should have added the genesis correctly', function () {
    var blockGenesis = new Block(),
      rlpGenesis;
    blockGenesis.header.stateRoot = genesisData.genesis_state_root;

    rlpGenesis = blockGenesis.serialize();
    assert(rlpGenesis.toString('hex') === genesisData.genesis_rlp_hex, 'rlp hex mismatch');

    internals.blockchain.addBlock(blockGenesis, function() {
      assert(internals.blockchain.meta.genesis === genesisData.genesis_hash);
    });
  });
});
