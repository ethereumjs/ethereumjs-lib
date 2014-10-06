var ecdsa = require('secp256k1');
var utils = require('./utils.js');

/**
 * @method verifySignature
 * @return {Boolean}
 */
exports.verifySignature = function () {
  var msgHash = this.hash(false);

  this._senderPubKey = ecdsa.recoverCompact(msgHash, Buffer.concat([this.r, this.s], 64), utils.bufferToInt(this.v) - 27);
  if (this._senderPubKey && this._senderPubKey.toString('hex') !== '') {
    return true;
  } else {
    return false;
  }

};

/**
 * sign a transaction with a given a private key
 * @method sign
 * @param {Buffer} privateKey
 */
exports.sign = function (privateKey) {
  var msgHash = this.hash(false),
    sig = ecdsa.signCompact(privateKey, msgHash);

  this.r = sig.r;
  this.s = sig.s;
  this.v = sig.recoveryId + 27;
};

/**
 * gets the senders public key
 * @method getSenderPublicKey
 * @return {Buffer}
 */
exports.getSenderPublicKey = function () {

  if (!this._senderPubKey) {
    this.verifySignature();
  }

  return this._senderPubKey;
};
