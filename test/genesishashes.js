const genesisData = require('ethereum-tests').basicTests.genesishashestest;
const Trie = require('merkle-patricia-tree/secure.js');
const tape = require('tape');
const Block = require('../lib/block.js');
const common = require('ethereum-common');
const VM = require('../lib/vm/index.js');

var trie = new Trie();

tape('[Common]: genesis hashes tests', function(t) {
  t.test('should generate the genesis state correctly', function(st) {
    var vm = new VM(trie);
    vm.generateGenesis(common.allotments , function() {
      st.equal(vm.trie.root.toString('hex'), genesisData.genesis_state_root);
      st.end();
    });
  });

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
