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
      var bal = b.get_balance('8a40bfaa73256b60764c1bf40675a99083efb075');
      var exp = BigInteger('2').pow(200);
      bal.compareTo(exp).should.equal(0);
    });
  });

  describe('#transfer_value', function(){
    it('should transfer correctly', function(){
      var b = block.genesis();
      var value = BigInteger('42');
      var fromAddr = '8a40bfaa73256b60764c1bf40675a99083efb075';
      var toAddr = 'e4157b34ea9615cfbde6b4fda419828124b70c78';
      var balance = BigInteger('2').pow(200);
      var expFromBalance = balance.subtract(value);
      var expToBalance = balance.add(value);

      var bSuccess = b.transfer_value(fromAddr, toAddr, value);
      bSuccess.should.equal(true);
      b.get_balance(fromAddr).compareTo(expFromBalance).should.equal(0);
      b.get_balance(toAddr).compareTo(expToBalance).should.equal(0);
    });
  });
});
