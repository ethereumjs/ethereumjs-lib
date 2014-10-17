var genesisData = require('../../../tests/genesishashestest.json'),
  assert = require('assert'),
  Blockchain = require('../../lib/blockchain.js'),
  Block = require('../../lib/block.js'),
  levelup = require('levelup');

var blockDB = levelup('', {
  db: require('memdown')
}),
  detailsDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  blockchain;

describe('[Common]: genesis hashes tests', function () {
  it('should create a new block chain', function (done) {
    blockchain = new Blockchain(blockDB, detailsDB);
    blockchain.init(done);
  });

  // TODO: activate when test data has the correct genesis hash
  it.skip('should have added the genesis correctly', function () {
    var blockGenesis = new Block(),
      rlpGenesis;
    blockGenesis.header.stateRoot = genesisData.genesis_state_root;

    rlpGenesis = blockGenesis.serialize();
    assert(rlpGenesis.toString('hex') === genesisData.genesis_rlp_hex, 'rlp hex mismatch');

    blockchain.addBlock(blockGenesis, function() {
      assert(blockchain.meta.genesis === genesisData.genesis_hash);
    });
  });
});
