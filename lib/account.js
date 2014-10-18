var utils = require('./utils'),
  rlp = require('rlp');

var Account = module.exports = function (data) {
  //if buffer, then maybe its rlp encoded
  if (Buffer.isBuffer(data)) {
    data = rlp.decode(data);
  }

  var self = this,
    fields = ['nonce', 'balance', 'stateRoot', 'codeHash'];

  this.raw = [];

  if (!data) {
    data = [new Buffer([0]), new Buffer([0]), new Buffer([0]), new Buffer([0])];
  }

  //make sure all the items are buffers
  data.forEach(function (d, i) {
    self.raw[i] = typeof d === 'string' ? new Buffer(d, 'hex') : d;
  });

  utils.validate(fields, this.raw);
  utils.defineProperties(this, fields);
};

Account.prototype.serialize = function () {
  return rlp.encode(this.raw);
};

Account.prototype.isContract = function () {
  return (this.codeHash.toString('hex') !== '00');
};

Account.prototype.toJSON = function () {
  return utils.baToJSON(this.raw);
};
