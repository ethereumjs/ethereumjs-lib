const Transaction = require('./transaction.js'),
  rlp = require('rlp');

/**
 * Represents a transaction receipt
 * @constructor
 * @param {Array} data raw data, deserialized
 */
var TransactionReceipt = module.exports = function(data) {
  this.transaction = new Transaction(data[0]);

  if (!Buffer.isBuffer(data[1])) {
    data[1] = new Buffer(data[1], 'hex');
  }

  if (!Buffer.isBuffer(data[2])) {
    data[2] = new Buffer(data[2], 'hex');
  }

  this.state = data[1];
  this.gasUsed = data[2];
};

/**
 * RLP serializes the transaction receipt
 * @method serialize
 */
TransactionReceipt.prototype.serialize = function() {
  return rlp.encode([
    this.transaction.raw,
    this.state,
    this.gasUsed
  ]);
};

/**
 * Returns a JSON representation of the transaction receipt
 * @method toJSON
 * @return {Object}
 */
TransactionReceipt.prototype.toJSON = function() {
  return {
    tx: this.transaction.toJSON(),
    state: this.state.toString('hex'),
    gasUsed: this.gasUsed.toString('hex')
  };
};
