const utils = require('./utils'),
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
    data = [new Buffer([]), new Buffer([]), utils.SHA3_RLP, utils.SHA3_NULL];
  }

  //make sure all the items are buffers
  data.forEach(function(d, i) {
    self.raw[i] = typeof d === 'string' ? new Buffer(d, 'hex') : d;
  });

  utils.validate(fields, this.raw);
  utils.defineProperties(this, fields);
};

Account.prototype.serialize = function() {
  if(this.balance.toString('hex') === '00'){
    this.balance = null;
  }

  return rlp.encode(this.raw);
};

Account.prototype.isContract = function() {
  return (this.codeHash.toString('hex') !== utils.SHA3_NULL);
};

Account.prototype.toJSON = function() {
  return utils.baToJSON(this.raw);
};

Account.prototype.getCode = function(state, cb) {
  if (this.codeHash.toString('hex') === utils.SHA3_NULL) {
    cb(null, new Buffer([]));
    return;
  }

  state.db.get(this.codeHash, {
    encoding: 'binary'
  }, cb);
};

Account.prototype.storeCode = function(trie, code, cb) {
  //store code for a new contract
  var codeHash = this.codeHash = utils.sha3(code);

  trie.db.put(codeHash, code, {
    encoding: 'binary'
  }, function(err) {
    cb(err, codeHash);
  });
};
