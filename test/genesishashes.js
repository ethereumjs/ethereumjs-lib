const genesisData = require('ethereum-tests').basicTests.genesishashestest,
  tape = require('tape'),
  Blockchain = require('../lib/blockchain.js'),
  Block = require('../lib/block.js'),
  VM = require('../lib/vm/index.js'),
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

tape('[Common]: genesis hashes tests', function(t) {
  t.test('should create a new block chain', function(st) {
    blockchain = new Blockchain(blockDB, detailsDB);
    blockchain.init(function() {
      st.end();
    });
  });

  t.test('should generate the genesis state correctly', function(st) {
    var vm = new VM(stateDB);
    vm.generateGenesis(genesisData.initial_alloc, function() {
      st.equal(vm.trie.root.toString('hex'), genesisData.genesis_state_root);
      st.end();
    });
  });

  t.test('should have added the genesis correctly', function(st) {
    var blockGenesis = new Block(),
      rlpGenesis;
    blockGenesis.header.stateRoot = genesisData.genesis_state_root;

    rlpGenesis = blockGenesis.serialize();

    st.strictEqual(rlpGenesis.toString('hex'),
      genesisData.genesis_rlp_hex, 'rlp hex mismatch');

    blockchain.addBlock(blockGenesis, function() {
      st.strictEqual(blockchain.meta.genesis,
        genesisData.genesis_hash, 'genesis hash mismatch');

      st.end();
    });
  });
});
