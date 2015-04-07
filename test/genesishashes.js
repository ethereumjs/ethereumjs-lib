const genesisData = require('ethereum-tests').basicTests.genesishashestest,
  tape = require('tape'),
  Block = require('../lib/block.js'),
  VM = require('../lib/vm/index.js');

tape('[Common]: genesis hashes tests', function(t) {

  // t.test('should generate the genesis state correctly', function(st) {
  //   var vm = new VM(stateDB);
  //   vm.generateGenesis(genesisData.initial_alloc, function() {
  //     st.equal(vm.trie.root.toString('hex'), genesisData.genesis_state_root);
  //     st.end();
  //   });
  // });

  t.test('should generete the genesis correctly', function(st) {
    var blockGenesis = new Block();

    blockGenesis.header.stateRoot = genesisData.genesis_state_root;

    var rlpGenesis = blockGenesis.serialize();
    st.strictEqual(rlpGenesis.toString('hex'),
      genesisData.genesis_rlp_hex, 'rlp hex mismatch');

    st.strictEqual(blockGenesis.hash().toString('hex'), genesisData.genesis_hash);
    st.end();

  });
});
