require('chai').should();

var rlp = require('../src/rlp');
var util = require('../src/util');

describe('rlp', function(){
  describe('#encode', function(){
    it('should encode dog', function(){
      var data = 'dog';
      var exp = '\x83dog';
      var res = rlp.encode(data);
      res.should.equal(exp);
    })

    it('should encode [cat, dog]', function(){
      var data = ['cat', 'dog'];
      var exp = '\xc8\x83cat\x83dog';
      var res = rlp.encode(data);
      res.should.equal(exp);
    })

    it('should encode empty string', function(){
      var data = '';
      var exp = '\x80';
      var res = rlp.encode(data);
      res.should.equal(exp);
    })

    it('should encode empty []', function(){
      var data = [];
      var exp = '\xc0';
      var res = rlp.encode(data);
      res.should.equal(exp);
    })

    it.skip('should encode integer 15', function(){
      var data = 15;
      var exp = '\x0f';
      var res = rlp.encode(data);
      res.should.equal(exp);
    })

    it('should encode set theoretical representation of two', function(){
      var data = [ [], [[]], [ [], [[]] ] ];
      var exp = '\xc7\xc0\xc1\xc0\xc3\xc0\xc1\xc0';
      var res = rlp.encode(data);
      res.should.equal(exp);
    })

    it('should encode string', function(){
      var data = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit';
      var exp = '\xb88Lorem ipsum dolor sit amet, consectetur adipisicing elit';
      var res = rlp.encode(data);
      res.should.equal(exp);
    })

    it('should encode namecoin', function(){
      var namecoinHex = 'f8388085e8d4a510008227108080ab600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var data = util.decodeHex(namecoinHex);
      var exp = "\xb8:\xf88\x80\x85\xe8\xd4\xa5\x10\x00\x82'\x10\x80\x80\xab`\x005Vc\x00\x00\x00!Y` 5`\x005W`\x01[R[T` R\xf2c\x00\x00\x00+X`\x00[R[T` R\xf2";
      var res = rlp.encode(data);
      res.should.equal(exp);
    })
  })

  describe('#decode', function(){
    it('should decode cat', function(){
      var data = '\x83cat';
      var exp = 'cat';
      var res = rlp.decode(data);
      res.should.equal(exp);
    })

    it('should decode namecoin', function(){
      var namecoinRlp = "\xb8:\xf88\x80\x85\xe8\xd4\xa5\x10\x00\x82'\x10\x80\x80\xab`\x005Vc\x00\x00\x00!Y` 5`\x005W`\x01[R[T` R\xf2c\x00\x00\x00+X`\x00[R[T` R\xf2";
      var namecoinHex = 'f8388085e8d4a510008227108080ab600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var exp = "\xf88\x80\x85\xe8\xd4\xa5\x10\x00\x82'\x10\x80\x80\xab`\x005Vc\x00\x00\x00!Y` 5`\x005W`\x01[R[T` R\xf2c\x00\x00\x00+X`\x00[R[T` R\xf2";

      var res = rlp.decode(namecoinRlp);
      res.should.equal(exp);
      util.encodeHex(res).should.equal(namecoinHex);
    })
  })
})

