var bignum = require('bignum');

exports.decimal = function (buffer) {
  return bignum(buffer.toString('hex')).toString();
};
