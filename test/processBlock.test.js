require('chai').should();

var block = require('../src/block');
var BigInteger = require('../src/jsbn/jsbn');
var transaction = require('../src/transaction');
var processBlock = require('../src/processBlock');

describe('process block', function(){
    it('should throw on UnsignedTransaction', function(){
    var b = block.genesis();

    var to = 'cd2a3d9f938e13cd947ec05abc7fe734df8dd826'; // cow
    var key = '0c06818f82e04c564290b32ab86b25676731fc34e9a546108bf109194c8e3aae'; // cow1
    var expTx = 'e18085e8d4a5100082271094cd2a3d9f938e13cd947ec05abc7fe734df8dd8260d80';

    var tx = transaction.mktx(BigInteger.ZERO, to, BigInteger('13'), '');
    tx.should.equal(expTx);

    (function() {
        processBlock.apply_transaction(b, tx);
    }).should.throw().property('name', 'UnsignedTransaction');
//    NB: bunch of time spent and
//    should.throw(processBlock.UnsignedTransaction) was not actually verifying the type of UnsignedTransaction
  });

  it('should transfer ether and validate nonce', function(){
    var cow1alloc = {
    "7986b3df570230288501eea3d890bd66948c9b79": BigInteger("1606938044258990275541962092341162602522202993782792835301376")
    };

    var b = block.genesis(cow1alloc);

    var to = 'cd2a3d9f938e13cd947ec05abc7fe734df8dd826'; // cow
    var key = '0c06818f82e04c564290b32ab86b25676731fc34e9a546108bf109194c8e3aae'; // cow1
    var expTx = 'e18085e8d4a5100082271094cd2a3d9f938e13cd947ec05abc7fe734df8dd8260d80';
    var exp = 'f8648085e8d4a5100082271094cd2a3d9f938e13cd947ec05abc7fe734df8dd8260d801ca0f9ee5ff3ef4c0cab613471732a3ecc0b27181504ddaeae6f0a9892ee4e03c10ba01f5fbfcea3110c93eebf3fd4ccb49c27890f7899b3d7ee3c15fa8ac4c4eb39ab';

    var tx = transaction.mktx(BigInteger.ZERO, to, BigInteger('13'), '');
    tx.should.equal(expTx);
    var parsedTx = transaction.hex_deserialize(tx);
    var signedTx = transaction.sign(parsedTx, key);
    transaction.hex_serialize(signedTx).should.equal(exp);

    var result = processBlock.apply_transaction(b, signedTx);
    result.success.should.equal(true);

    // validate that replaying tx throws
    (function() {
        processBlock.apply_transaction(b, signedTx);
    }).should.throw().property('name', 'InvalidNonce');
  });
});
