const utils = require('./utils'),
  SHA3 = require('sha3'),
  rlp = require('rlp');

var Account = module.exports = function(data) {
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
  data.forEach(function(d, i) {
    self.raw[i] = typeof d === 'string' ? new Buffer(d, 'hex') : d;
  });

  utils.validate(fields, this.raw);
  utils.defineProperties(this, fields);
};

Account.prototype.serialize = function() {
  return rlp.encode(this.raw);
};

Account.prototype.isContract = function() {
  return (this.codeHash.toString('hex') !== '00');
};

Account.prototype.toJSON = function() {
  return utils.baToJSON(this.raw);
};

Account.prototype.getCode = function(state, cb) {
  state.db.get(this.codeHash, {
    encoding: 'binary'
  }, cb);
};

Account.prototype.storeCode = function(state, code, cb) {
  //store code for a new contract
  var hash = new SHA3.SHA3Hash(256);

  hash.update(code);
  var codeHash = this.codeHash = new Buffer(hash.digest('hex'), 'hex');

  state.db.put(codeHash, code, {
    encoding: 'binary'
  }, function(err) {
    cb(err, codeHash);
  });
};
