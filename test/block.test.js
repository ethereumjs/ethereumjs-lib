require('chai').should();

var block = require('../src/block');
var BigInteger = require('../src/jsbn/jsbn');
var genesisData = require('./jsonData/genesishashestest.json');

describe('block', function(){
  describe('genesis', function(){
    it('should have correct state root', function(){
      var b = block.genesis();
      b.stateRoot().should.eql(genesisData.genesis_state_root);
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
