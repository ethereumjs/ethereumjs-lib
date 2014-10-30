const crypto = require('crypto'),
  bignum = require('bignum');

const sha256 = crypto.createHash('sha256');

module.exports = function(opts) {
  var results;

console.log('to: ', opts.to, 'data: ', opts.data)

  var to = bignum.fromBuffer(opts.to);

  if (to.eq(2)) {
    results = {
      vm: {}
      // vm: {
      //   returnValue: null
      // }
    };
    results.gasUsed = 100;
    var hashStr = sha256.update(opts.data).digest('hex');
    results.vm.returnValue = new Buffer(hashStr, 'hex');
  }
  else {
    results = false;
  }

console.log('results: ', results)

  return results;
}
