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
});
