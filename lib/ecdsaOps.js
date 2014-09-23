var Ecdsa = require('ecdsa-native');

/**
 * @method verifySignature
 * @return {Boolean}
 */
exports.verifySignature = function () {
  var msgHash = this.hash(false),
    pubKey = this.getSenderPublicKey();

  if (pubKey) {
    var sigDER = Ecdsa.rs2DER(this.r, this.s),
      key = new Ecdsa(),
      pubbuf = pubKey.getEncoded();

    key.public = pubbuf;

    return key.verifySignatureSync(msgHash, sigDER);
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
    sig = Ecdsa.signCompressed(msgHash, privateKey);

  this.r = sig.r;
  this.s = sig.s;
  this.v = sig.i + 27;
};
