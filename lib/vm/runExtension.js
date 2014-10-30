const crypto = require('crypto'),
  bignum = require('bignum');

const sha256 = crypto.createHash('sha256');

module.exports = function(opts) {
  var results = false;

// console.log('to: ', opts.to, 'data: ', opts.data)

  var to = bignum.fromBuffer(opts.to);

  if (to.eq(2)) {
    results.gasUsed = 100;
    results.vm.result = sha256.update(opts.data).digest('hex');
  }

  return results;
}
