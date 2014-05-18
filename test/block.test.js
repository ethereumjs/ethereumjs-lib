require('chai').should();

var block = require('../src/block');
var BigInteger = require('../src/jsbn/jsbn');

describe('block', function(){
  describe('genesis', function(){
    it('should have correct state root', function(){
      var b = block.genesis();
      b.stateRoot().should.eql('2f4399b08efe68945c1cf90ffe85bbe3ce978959da753f9e649f034015b8817d');
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
