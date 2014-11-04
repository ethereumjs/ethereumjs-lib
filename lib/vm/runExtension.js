const crypto = require('crypto'),
  bignum = require('bignum'),
  ecdsaOps = require('../ecdsaOps'),
  utils = require('../utils'),
  ERROR = require('./constants.js').ERROR;

const sha256 = crypto.createHash('SHA256');
  ripemd160 = crypto.createHash('RSA-RIPEMD160');

const GAS_COST = {
  1: 500,
  2: 100,
  3: 100
};

module.exports = function(opts) {
  var results = {},
    gasCost;

// console.log('@@RAW to: ', opts.to, 'data: ', opts.data)
// opts.data = new Buffer([1])

  var to = bignum.fromBuffer(opts.to);
  var data = opts.data.toString('hex');

console.log('to: ', to, 'data: ', data)

  if (to.le(3)) {
    gasCost = GAS_COST[to];
    results.gasUsed = gasCost;
    if (opts.gas.lt(gasCost)) {
      results.exception = ERROR.OUT_OF_GAS ;
      return results;
    }
  }

  if (to.eq(1)) {
console.log('ZZZZZZZZZZZZ opts.data: ', opts.data)

    var msgHash = opts.data.slice(0, 32),
      v = opts.data.slice(32, 64),
      r = opts.data.slice(64, 96),
      s = opts.data.slice(96, 128),
      publicKey;

console.log('h: ', msgHash, 'v: ', v, 'r: ', r, 's: ', s)

    publicKey = ecdsaOps.ecrecover(msgHash, v, r, s);
    results.returnValue = utils.pad256(utils.pubToAddress(publicKey));
  }
  else if (to.eq(2)) {
console.log('@@@@@@@@@@@@@@@@@@@@@ SHA256')

    var hashStr = sha256.update(data).digest('hex');
    results.returnValue = new Buffer(hashStr, 'hex');
  }
  else if (to.eq(3)) {
console.log('@@@@@@@@@@@@@@@@@@@@@ RIPEMD160')

    var hashStr = ripemd160.update(opts.data).digest('hex');
    results.returnValue = new Buffer(hashStr, 'hex');
  }
  else {
    results = false;
  }

console.log('results: ', results)
console.log('hex str ret val: ', results.returnValue.toString('hex'))


  return results;
}
