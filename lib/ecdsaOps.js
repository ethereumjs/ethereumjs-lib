const ecdsa = require('secp256k1'),
  utils = require('./utils.js');

/**
 * @method verifySignature
 * @return {Boolean}
 */
exports.txVerifySignature = function() {
  var msgHash = this.hash(false);

  var sig = Buffer.concat([utils.pad256(this.r), utils.pad256(this.s)], 64);

  this._senderPubKey = ecdsa.recoverCompact(msgHash, sig, utils.bufferToInt(this.v) - 27);
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
exports.txSign = function(privateKey) {
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
exports.txGetSenderPublicKey = function() {

  if (!this._senderPubKey || !this._senderPubKey.length) {
    this.verifySignature();
  }

  return this._senderPubKey;
};

/**
 * ecrecover
 * @param  {[type]} msgHash [description]
 * @param  {[type]} v       [description]
 * @param  {[type]} r       [description]
 * @param  {[type]} s       [description]
 * @return {[type]}         public key otherwise null
 */
exports.ecrecover = function(msgHash, v, r, s) {
  var sig = Buffer.concat([utils.pad256(r), utils.pad256(s)], 64),
    senderPubKey = ecdsa.recoverCompact(msgHash, sig, utils.bufferToInt(v) - 27);
  if (senderPubKey && senderPubKey.toString('hex') !== '') {
    return senderPubKey;
  } else {
    return null;
  }
}
