var tests = require('../../../tests/keyaddrtest.json'),
  assert = require('assert'),
  utils = require('../../lib/utils'),
  ecdsa = require('secp256k1'),
  SHA3 = require('sha3');

it('keyaddr tests', function () {
  tests.forEach(function(data) {
    var hash = new SHA3.SHA3Hash(256);
    hash.update(data.seed);

    var privKey = hash.digest('hex');
    assert(privKey === data.key);

    var pubKey = ecdsa.createPublicKey(new Buffer(privKey, 'hex'));
    var addr = utils.pubToAddress(pubKey).toString('hex');
    assert(addr === data.addr)
  });
});
