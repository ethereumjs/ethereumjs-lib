const genesisData = require('ethereum-tests').basicTests.genesishashestest;
const Trie = require('merkle-patricia-tree/secure.js');
const tape = require('tape');
const Block = require('../lib/block.js');
const VM = require('../lib/vm/index.js');

var trie = new Trie();

tape('[Common]: genesis hashes tests', function(t) {
  t.test('should generate the genesis state correctly', function(st) {
    var vm = new VM(trie);
    vm.generateCanonicalGenesis(function() {
      st.equal(vm.trie.root.toString('hex'), genesisData.genesis_state_root);
      st.end();
    });
  });

  t.test('should generete the genesis correctly', function(st) {
    var blockGenesis = new Block();
    blockGenesis.header.stateRoot = trie.root
    console.log(trie.root.toString('hex'));
    var rlpGenesis = blockGenesis.serialize();
    st.strictEqual(rlpGenesis.toString('hex'),
      genesisData.genesis_rlp_hex, 'rlp hex mismatch');

    st.strictEqual(blockGenesis.hash().toString('hex'), genesisData.genesis_hash);
    st.end();
  });
});
