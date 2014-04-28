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
})

