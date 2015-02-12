const crypto = require('crypto');
const bignum = require('bignum');
const ecdsaOps = require('../ecdsaOps');
const utils = require('ethereumjs-util');

const GAS_COST = {
  1: 500,
  2: 50, //sha3
  3: 50 //RIPEMD160
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
  var results = {};
  var gasCost;
  var to = bignum.fromBuffer(opts.to);
  var data;
  var sha256;
  var ripemd160;
  var msgHash, v, r, s, publicKey;
  var hashStr;
  var buf;

  if (to.gt(3) || to.lt(1)) {
    return false;
  }

  gasCost = GAS_COST[to];
  if (opts.gas.lt(gasCost)) {
    results.gasUsed = opts.gas;
    results.exception = 0; // 0 means VM fail (in this case because of OOG)
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
      results.exception = 1; // 1 since there is no VM error
      return results;
    }

    results.exception = 1;
    results.returnValue = utils.pad(utils.pubToAddress(publicKey), 32);
  } else if (to.eq(2)) {
    sha256 = crypto.createHash('SHA256');
    data = opts.data;
    var dataGas = Math.ceil(data.length / 32) * 50;
    results.gasUsed += dataGas;

    if (opts.gas.lt(gasCost + dataGas)) {
      results.gasUsed = opts.gas;
      results.exception = 0; // 0 means VM fail (in this case because of OOG)
      return results;
    }

    hashStr = sha256.update(data).digest('hex');

    results.exception = 1;
    results.returnValue = new Buffer(hashStr, 'hex');
  } else if (to.eq(3)) {
    ripemd160 = crypto.createHash('RSA-RIPEMD160');
    data = opts.data;

    var dataGas2 = Math.ceil(opts.data.length / 32) * 50;
    // console.log('data: ' + data.toString('hex'));

    if (opts.gas.lt(gasCost + dataGas2)) {
      results.gasUsed = opts.gas;
      results.exception = 0; // 0 means VM fail (in this case because of OOG)
      return results;
    }

    results.gasUsed += dataGas2;

    hashStr = utils.pad(ripemd160.update(data).digest('bin'), 32); // nb: bin

    results.exception = 1;
    results.returnValue = new Buffer(hashStr, 'hex');
  }

  return results;
};
