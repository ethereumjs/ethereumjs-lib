require('chai').should();

var compiler = require('../../src/serpent/compiler');

describe('compiler', function(){
  describe('#encodeDataList', function(){
    it('should encode list with 1 string', function(){
      var exp = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00harry';
      var res = compiler.encodeDataList(['harry']);
      res.should.equal(exp);
      res.length.should.equal(exp.length);
    })

    it('should encode list with 1 number', function(){
      var exp = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x04\xd2';
      var res = compiler.encodeDataList([1234]);
      res.should.equal(exp);
      res.length.should.equal(exp.length);
    })

    it('should encode list with string and number', function(){
      var exp = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00harry\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00<';
      var res = compiler.encodeDataList(['harry', 60]);
      res.should.equal(exp);
      res.length.should.equal(exp.length);
    })

    it('should encode list with 1 address', function(){
      var exp = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xcd*=\x9f\x93\x8e\x13\xcd\x94~\xc0Z\xbc\x7f\xe74\xdf\x8d\xd8&';
      var res = compiler.encodeDataList(['cd2a3d9f938e13cd947ec05abc7fe734df8dd826']);
      res.should.equal(exp);
      res.length.should.equal(exp.length);
    })

    it('should encode list with address and number', function(){
      var exp = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xcd*=\x9f\x93\x8e\x13\xcd\x94~\xc0Z\xbc\x7f\xe74\xdf\x8d\xd8&\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x03\xe8';
      var res = compiler.encodeDataList(['cd2a3d9f938e13cd947ec05abc7fe734df8dd826', 1000]);
      res.should.equal(exp);
      res.length.should.equal(exp.length);
    })
  })
})
