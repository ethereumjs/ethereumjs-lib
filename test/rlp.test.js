require('chai').should();

var rlp = require('../src/rlp');
var util = require('../src/util');

describe('rlp', function(){
  describe('#decode', function(){
    it('should decode cat', function(){
      var data = '\x83cat';
      var exp = 'cat';
      var res = rlp.decode(data);
      res.should.equal(exp);
    })
})

