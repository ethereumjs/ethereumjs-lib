require('chai').should();

var transaction = require('../src/transaction');
var util = require('../src/util');

describe('transaction', function(){
  describe('#mkContract', function(){
    it('should make namecoin', function(){
      var code = '600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var exp = 'f8388085e8d4a510008227108080ab600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var res = transaction.mkContract(util.bigInt(0), util.bigInt(0), code);
      res.should.equal(exp);
    })
  })

  describe('#sign', function(){
    it('should sign a data-less transaction', function(){
      var to = 'cd2a3d9f938e13cd947ec05abc7fe734df8dd826'; // cow
      var key = '0c06818f82e04c564290b32ab86b25676731fc34e9a546108bf109194c8e3aae' // cow1
      var exp = 'f8648085e8d4a5100082271094cd2a3d9f938e13cd947ec05abc7fe734df8dd8260d801ca0f9ee5ff3ef4c0cab613471732a3ecc0b27181504ddaeae6f0a9892ee4e03c10ba01f5fbfcea3110c93eebf3fd4ccb49c27890f7899b3d7ee3c15fa8ac4c4eb39ab';

      var tx = transaction.mktx(util.bigInt(0), to, util.bigInt(13), '');
      var parsedTx = transaction.parse(util.decodeHex(tx));
      transaction.sign(parsedTx, key).should.equal(exp);
    })
  })
})

