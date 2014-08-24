require('chai').should();

var block = require('../src/block');
var rlp = require('../src/rlp');
var trie = require('../src/trie');
var util = require('../src/util');
var BigInteger = require('../src/jsbn/jsbn');
var genesisData = require('./jsonData/genesishashestest.json');

describe('block', function(){
  describe('genesis', function(){
    it('should have correct state root', function(){
      var b = block.genesis();
      b.stateRoot().should.eql(genesisData.genesis_state_root);
    });

    it.only('should have correct rlp hex', function(){
      // from pyethereum test/test_chain.py test_genesis_hash
      var genesis = block.genesis();

      var h256 = util.repeat('\00', 32);
      var sr = util.decodeHex(genesisData.genesis_state_root);
      var genesis_block_defaults = [
          ["prevhash", "bin", h256],  // h256()
          ["uncles_hash", "bin", util.sha3(rlp.encode([]))],  // sha3EmptyList
          ["coinbase", "addr", util.repeat("0", 40)],  // h160()
          ["state_root", "trie_root", sr],  // stateRoot
          ["tx_list_root", "trie_root", trie.BLANK_ROOT],  // h256()
          ["difficulty", "int", BigInteger('2').pow(22)],  // c_genesisDifficulty
          ["number", "int", BigInteger.ZERO],  // 0
          ["min_gas_price", "int", BigInteger.ZERO],  // 0
          ["gas_limit", "int", BigInteger('10').pow(6)],  // 10**6 for genesis
          ["gas_used", "int", BigInteger.ZERO],  // 0
          ["timestamp", "int", BigInteger.ZERO],  // 0
          ["extra_data", "bin", ""],  // ""
          ["nonce", "bin", util.sha3(String.fromCharCode(42))],  // sha3(bytes(1, 42));
      ];

      var cpp_genesis_block = rlp.decode(       util.decodeHex(genesisData.genesis_rlp_hex));
      var cpp_genesis_header = cpp_genesis_block[0];

      var name, typ, genesis_default, cpp_exp;
      genesis_block_defaults.forEach(function(val, i) {
        name = val[0];
        typ = val[1];
        genesis_default = val[2];
        cpp_exp = util.decoders[typ](cpp_genesis_header[i]);

        if (typ === 'int') {
          genesis_default.compareTo(cpp_exp).should.equal(0);
        }
        else {
          genesis_default.should.equal(cpp_exp);
        }
      });

      //b.stateRoot().should.eql(genesisData.genesis_rlp_hex);
    });
  });

  describe('#get_balance', function(){
    it('should be correct for a genesis block', function(){
      var b = block.genesis();
      var bal = b.get_balance('51ba59315b3a95761d0863b05ccc7a7f54703d99');
      var exp = BigInteger('2').pow(200);
      bal.compareTo(exp).should.equal(0);
    });
  });

  describe('#transfer_value', function(){
    it('should transfer correctly when balance is sufficient', function(){
      var b = block.genesis();
      var value = BigInteger('42');
      var fromAddr = '51ba59315b3a95761d0863b05ccc7a7f54703d99';
      var toAddr = 'e4157b34ea9615cfbde6b4fda419828124b70c78';
      var balance = BigInteger('2').pow(200);
      var expFromBalance = balance.subtract(value);
      var expToBalance = balance.add(value);

      var bSuccess = b.transfer_value(fromAddr, toAddr, value);
      bSuccess.should.equal(true);
      b.get_balance(fromAddr).compareTo(expFromBalance).should.equal(0);
      b.get_balance(toAddr).compareTo(expToBalance).should.equal(0);
    });

    it('should not transfer when value is larger than balance', function(){
      var b = block.genesis();
      var fromAddr = '51ba59315b3a95761d0863b05ccc7a7f54703d99';
      var toAddr = 'e4157b34ea9615cfbde6b4fda419828124b70c78';
      var balance = BigInteger('2').pow(200);
      var value = balance.add(BigInteger('13'));

      var bSuccess = b.transfer_value(fromAddr, toAddr, value);
      bSuccess.should.equal(false);
      b.get_balance(fromAddr).compareTo(balance).should.equal(0);
      b.get_balance(toAddr).compareTo(balance).should.equal(0);
    });
  });
});
