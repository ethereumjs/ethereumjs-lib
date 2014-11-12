const crypto = require('crypto'),
  bignum = require('bignum'),
  ecdsaOps = require('../ecdsaOps'),
  utils = require('../utils');

const GAS_COST = {
  1: 500,
  2: 100,
  3: 100
};

/**
 * Runs extensions
 * @param  {Object} opts [description]
 * @return {Object|Boolean} - false when no extensions are executed.
 *                            Otherwise an object with the following
 *                            properties:
 *                            gasUsed that will be subtracted by runCode()
 *                            exception - VM status with 1=pass, 0=fail. pushed to stack by runCode()
 *                            returnValue that will be saved to memory by runCode()
 */
module.exports = function(opts) {
  var results = {},
    gasCost,
    to = bignum.fromBuffer(opts.to),
    data,
    sha256,
    ripemd160,
    msgHash, v, r, s, publicKey,
    hashStr,
    buf;

  if (to.gt(3) || to.lt(1)) {
    return false;
  }

  gasCost = GAS_COST[to];
  if (opts.gas.lt(gasCost)) {
    results.gasUsed = opts.gas;
    results.exception = 0;  // 0 means VM fail (in this case because of OOG)
    return results;
  }

  results.gasUsed = gasCost;

  if (to.eq(1)) {
    buf = new Buffer(128);
    buf.fill(0);
    data = Buffer.concat([opts.data, buf]);

    msgHash = data.slice(0, 32);
    v = data.slice(32, 64);
    r = data.slice(64, 96);
    s = data.slice(96, 128);

    publicKey = ecdsaOps.ecrecover(msgHash, v, r, s);

    if (!publicKey) {
      results.exception = 1;  // 1 since there is no VM error
      return results;
    }

    results.exception = 1;
    results.returnValue = utils.pad256(utils.pubToAddress(publicKey));
  }
  else if (to.eq(2)) {
    sha256 = crypto.createHash('SHA256');
    data = new Buffer(opts.data, 'hex');
    hashStr = sha256.update(data).digest('hex');

    results.exception = 1;
    results.returnValue = new Buffer(hashStr, 'hex');
  }
  else if (to.eq(3)) {
    ripemd160 = crypto.createHash('RSA-RIPEMD160');
    data = new Buffer(opts.data, 'hex');
    hashStr = utils.pad256(ripemd160.update(data).digest('bin')); // nb: bin

    results.exception = 1;
    results.returnValue = new Buffer(hashStr, 'hex');
  }

  return results;
};
