require('chai').should();

var block = require('../src/block');

describe('block', function(){
  describe('genesis', function(){
    it('should have correct state root', function(){
      var b = block.genesis();
      b.stateRoot().should.eql('2f4399b08efe68945c1cf90ffe85bbe3ce978959da753f9e649f034015b8817d');
    });
  });
});
