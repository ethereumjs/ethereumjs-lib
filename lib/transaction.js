const bignum = require('bignum'),
  rlp = require('rlp'),
  utils = require('ethereumjs-util'),
  fees = require('./fees.js'),
  ecdsaOps = require('./ecdsaOps');

/**
 * Represents a transaction
 * @constructor
 * @param {Buffer|Array} data raw data, deserialized
 */
var Transaction = module.exports = function(data) {

  //Define Properties
  var fields = [{
    name: 'nonce',
    word: true,
    default: new Buffer([])
  }, {
    name: 'gasPrice',
    word: true,
    default: new Buffer([0])
  }, {
    name: 'gasLimit',
    word: true,
    default: new Buffer([0])
  }, {
    name: 'to',
    empty: true,
    length: 20,
    default: new Buffer([])
  }, {
    name: 'value',
    empty: true,
    word: true,
    default: new Buffer([])
  }, {
    name: 'data',
    empty: true,
    default: new Buffer([0])
  }, {
    name: 'v',
    length: 1,
    default: new Buffer([0x1c])
  }, {
    name: 'r',
    length: 32,
    default: utils.zeros(32)
  }, {
    name: 's',
    length: 32,
    default: utils.zeros(32)
  }];

  utils.defineProperties(this, fields, data);
};

/**
 * Returns the rlp encoding of the transaction
 * @method serialize
 * @return {Buffer}
 */
Transaction.prototype.serialize = function() {
  return rlp.encode(this.raw);
};

/**
 * Computes a sha3-256 hash of the tx
 * @method hash
 * @param {Boolean} [true] signature - whether or not to inculde the signature
 * @return {Buffer}
 */
Transaction.prototype.hash = function(signature) {
  var toHash;

  if (typeof signature === 'undefined') {
    signature = true;
  }

  if (signature) {
    toHash = this.raw;
  } else {
    toHash = this.raw.slice(0, 6);
  }

  //create hash
  return utils.sha3(rlp.encode(toHash));
};

/**
 * gets the senders address
 * @method getSenderAddress
 * @return {Buffer}
 */
Transaction.prototype.getSenderAddress = function() {
  var pubKey = this.getSenderPublicKey();
  return utils.pubToAddress(pubKey);
};

/**
 * gets the senders public key
 * @method getSenderPublicKey
 * @return {Buffer}
 */
Transaction.prototype.getSenderPublicKey = ecdsaOps.txGetSenderPublicKey;

/**
 * @method verifySignature
 * @return {Boolean}
 */
Transaction.prototype.verifySignature = ecdsaOps.txVerifySignature;

/**
 * sign a transaction with a given a private key
 * @method sign
 * @param {Buffer} privateKey
 */
Transaction.prototype.sign = ecdsaOps.txSign;

/**
 * The amount of gas paid for the data in this tx
 * @method getDataFee
 * @return {bignum}
 */
Transaction.prototype.getDataFee = function() {
  var data = this.raw[5];
  var cost = bignum(0);
  for (var i = 0; i < data.length; i++) {
    if (data[i] === 0) {
      cost = cost.add(1);
    } else {
      cost = cost.add(5);
    }
  }

  return cost;
};

/**
 * the base amount of gas it takes to be a valid tx
 * @method getBaseFee
 * @return {bignum}
 */
Transaction.prototype.getBaseFee = function() {
  return this.getDataFee().add(bignum(fees.getFee('TRANSACTION')));
};

/**
 * the up front amount that an account must have for this transaction to be valid
 * @method getUpfrontCost
 * @return {bignum}
 */
Transaction.prototype.getUpfrontCost = function() {
  return bignum.fromBuffer(this.gasLimit)
    .mul(bignum.fromBuffer(this.gasPrice))
    .add(bignum.fromBuffer(this.value));
};

/**
 * validates the signature and checks to see if it has enough gas
 * @method validate
 * @return {Boolean}
 */
Transaction.prototype.validate = function() {
  return this.verifySignature() && (this.getBaseFee().toNumber() <= utils.bufferToInt(this.gasLimit));
};
