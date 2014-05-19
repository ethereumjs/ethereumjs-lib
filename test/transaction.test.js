require('chai').should();

var transaction = require('../src/transaction');
var util = require('../src/util');
var BigInteger = require('../src/jsbn/jsbn');

describe('transaction', function(){
  describe('#mktx', function(){
    it('should make transaction with data [george,45]', function(){
      var contractAddr = 'da7ce79725418f4f6e13bf5f520c89cec5f6a974';
      var data = '000000000000000000000000000000000000000000000000000067656f726765000000000000000000000000000000000000000000000000000000000000002d';
      var exp = 'f8640185e8d4a5100082271094da7ce79725418f4f6e13bf5f520c89cec5f6a974822710b840000000000000000000000000000000000000000000000000000067656f726765000000000000000000000000000000000000000000000000000000000000002d';
      var res = transaction.mktx(BigInteger.ONE, contractAddr, BigInteger('10000'), data);
      res.should.equal(exp);
    });
  });

  describe('#mkContract', function(){
    it('should make namecoin', function(){
      var code = '600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var exp = 'f8388085e8d4a510008227108080ab600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var res = transaction.mkContract(BigInteger.ZERO, BigInteger.ZERO, code);
      res.should.equal(exp);
    });
  });

  describe('#sign', function(){
    it('should sign a data-less transaction', function(){
      var to = 'cd2a3d9f938e13cd947ec05abc7fe734df8dd826'; // cow
      var key = '0c06818f82e04c564290b32ab86b25676731fc34e9a546108bf109194c8e3aae'; // cow1
      var expTx = 'e18085e8d4a5100082271094cd2a3d9f938e13cd947ec05abc7fe734df8dd8260d80';
      var exp = 'f8648085e8d4a5100082271094cd2a3d9f938e13cd947ec05abc7fe734df8dd8260d801ca0f9ee5ff3ef4c0cab613471732a3ecc0b27181504ddaeae6f0a9892ee4e03c10ba01f5fbfcea3110c93eebf3fd4ccb49c27890f7899b3d7ee3c15fa8ac4c4eb39ab';

      var tx = transaction.mktx(BigInteger.ZERO, to, BigInteger('13'), '');
      tx.should.equal(expTx);
      var parsedTx = transaction.parse(util.decodeHex(tx));
      transaction.sign(parsedTx, key).should.equal(exp);
    });

    it('should sign namecoin contract', function(){
      var namecoin = '600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var key = 'c85ef7d79691fe79573b1a7064c19c1a9819ebdbd1faaab1a8ec92344438aaf4'; // cow's

      var expContract = 'f8388085e8d4a510008227108080ab600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f2';
      var exp = 'f87b8085e8d4a510008227108080ab600035566300000021596020356000355760015b525b54602052f2630000002b5860005b525b54602052f21ca0eb64cfe9c4960e6a029929fc315850b8b6d54d9171bcb36275ba1cae89f6c17ca0e2e160b168c8795d27fef5074bcd20cba51ff1c13f3d4c46f9dae1b649c9ca3f';

      var contract = transaction.mkContract(BigInteger.ZERO, BigInteger.ZERO, namecoin);
      contract.should.equal(expContract);

      var parsedTx = transaction.parse(util.decodeHex(contract));
      parsedTx.data.should.eql(util.decodeHex(namecoin));

      transaction.sign(parsedTx, key).should.equal(exp);
    });

    it('should sign transaction with data [george,45]', function(){
      // from earlier test (above)
      var tx = 'f8640185e8d4a5100082271094da7ce79725418f4f6e13bf5f520c89cec5f6a974822710b840000000000000000000000000000000000000000000000000000067656f726765000000000000000000000000000000000000000000000000000000000000002d';
      var key = 'c85ef7d79691fe79573b1a7064c19c1a9819ebdbd1faaab1a8ec92344438aaf4'; // cow's
      var exp = 'f8a70185e8d4a5100082271094da7ce79725418f4f6e13bf5f520c89cec5f6a974822710b840000000000000000000000000000000000000000000000000000067656f726765000000000000000000000000000000000000000000000000000000000000002d1ba039fd06d7dc1acf6cfcf78ca2c659965a156f0bc9f92bd8441ddddd9562fec7c4a011648e1f351a856032622819751aa6dce6b3a4bf97bf51386adf3aa0cee571ac';

      var parsedTx = transaction.parse(util.decodeHex(tx));
      transaction.sign(parsedTx, key).should.equal(exp);
    });
  });
});

