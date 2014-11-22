var tests = require('ethereum-tests').keyaddrtests,
  assert = require('assert'),
  utils = require('../../../lib/utils'),
  ecdsa = require('secp256k1'),
  SHA3 = require('sha3');

describe('[Common]', function () {
  it('keyaddr tests', function () {
    tests.forEach(function(data) {
      var hash = new SHA3.SHA3Hash(256);
      hash.update(data.seed);

      var privKey = hash.digest('hex');
      assert(privKey === data.key);

      var pubKey = ecdsa.createPublicKey(new Buffer(privKey, 'hex'));
      var addr = utils.pubToAddress(pubKey).toString('hex');
      assert(addr === data.addr);

      var emptyMsg = new Buffer([0]);
      var sig = ecdsa.signCompact(new Buffer(privKey, 'hex'), emptyMsg);

      var recoveredPubKey = ecdsa.recoverCompact(emptyMsg, sig.signature, sig.recoveryId, false);
      assert(pubKey.toString('hex') === recoveredPubKey.toString('hex'));

      // todo: assert the v, r, s values when secp256k1 module is updated to use deterministicK
    });
  });
});
