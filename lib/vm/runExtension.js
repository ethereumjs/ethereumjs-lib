const crypto = require('crypto'),
  bignum = require('bignum'),
  ecdsaOps = require('../ecdsaOps');

const sha256 = crypto.createHash('SHA256');
  ripemd160 = crypto.createHash('RSA-RIPEMD160');

module.exports = function(opts) {
  var results;

// console.log('@@RAW to: ', opts.to, 'data: ', opts.data)
// opts.data = new Buffer([1])

  var to = bignum.fromBuffer(opts.to);
  var data = opts.data.toString('hex');

console.log('to: ', to, 'data: ', data)

  if (to.eq(1)) {
console.log('ZZZZZZZZZZZZ opts.data: ', opts.data)

    var msgHash = opts.data.slice(0, 32),
      v = opts.data.slice(32, 64),
      r = opts.data.slice(64, 96),
      s = opts.data.slice(96, 128);

console.log('h: ', msgHash, 'v: ', v, 'r: ', r, 's: ', s)

    results = {
    };
    results.gasUsed = 500;



    results.returnValue = ecdsaOps.ecrecover(msgHash, v, r, s);
  }
  else if (to.eq(2)) {
console.log('@@@@@@@@@@@@@@@@@@@@@ SHA256')
    results = {
    };
    results.gasUsed = 100;
    var hashStr = sha256.update(data).digest('hex');
    results.returnValue = new Buffer(hashStr, 'hex');
  }
  else if (to.eq(3)) {
console.log('@@@@@@@@@@@@@@@@@@@@@ RIPEMD160')
    results = {
    };
    results.gasUsed = 100;
    var hashStr = ripemd160.update(opts.data).digest('hex');
    results.returnValue = new Buffer(hashStr, 'hex');
  }
  else {
    results = false;
  }

console.log('results: ', results)
// console.log('hex str ret val: ', results.returnValue.toString('hex'))


  return results;
}
