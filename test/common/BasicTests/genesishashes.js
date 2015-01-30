var genesisData = require('ethereum-tests').basicTests.genesishashestest,
  assert = require('assert'),
  Blockchain = require('../../../lib/blockchain.js'),
  Block = require('../../../lib/block.js'),
  VM = require('../../../lib/vm/index.js'),
  levelup = require('levelup');

var blockDB = levelup('', {
  db: require('memdown')
}),
  detailsDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  stateDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  blockchain;

describe('[Common]: genesis hashes tests', function () {
  it('should create a new block chain', function (done) {
    blockchain = new Blockchain(blockDB, detailsDB);
    blockchain.init(done);
  });

  it('should generate the genesis state correctly', function(done){
    var vm = new VM(stateDB);
    vm.generateGenesis(genesisData.initial_alloc, function(){
      assert.equal(vm.trie.root.toString('hex'), genesisData.genesis_state_root);
      done();
    });
  });

  it('should have added the genesis correctly', function () {
    var blockGenesis = new Block(),
      rlpGenesis;
    blockGenesis.header.stateRoot = genesisData.genesis_state_root;

    rlpGenesis = blockGenesis.serialize();

    assert.strictEqual(rlpGenesis.toString('hex'),
      genesisData.genesis_rlp_hex, 'rlp hex mismatch');

    blockchain.addBlock(blockGenesis, function() {
      assert.strictEqual(blockchain.meta.genesis,
        genesisData.genesis_hash, 'genesis hash mismatch');
    });
  });
});
