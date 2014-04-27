var sec = require('./jsbn/sec'),
    SecureRandom = require('./jsbn/rng'),
    BigInteger = require('./jsbn/jsbn'),
    ECPointFp = require('./jsbn/ec').ECPointFp;

var rng = new SecureRandom(),
    ecparams = sec("secp256k1"),
    convert = require('./convert'),
    util = require('./util');

var P_OVER_FOUR = null;

function implShamirsTrick(P, k, Q, l)
{
  var m = Math.max(k.bitLength(), l.bitLength());
  var Z = P.add2D(Q);
  var R = P.curve.getInfinity();

  for (var i = m - 1; i >= 0; --i) {
    R = R.twice2D();

    R.z = BigInteger.ONE;

    if (k.testBit(i)) {
      if (l.testBit(i)) {
        R = R.add2D(Z);
      } else {
        R = R.add2D(P);
      }
    } else {
      if (l.testBit(i)) {
        R = R.add2D(Q);
      }
    }
  }

  return R;
};

var ECDSA = {
  getBigRandom: function (limit) {
    return new BigInteger(limit.bitLength(), rng)
      .mod(limit.subtract(BigInteger.ONE))
      .add(BigInteger.ONE)
    ;
  },
  deterministicGenerateK: function(hash, key) {
      key = key.toString(16)
      while (key.length < 64) key = '0' + key
      key = convert.hexToBytes(key)
      var v = [];
      var k = [];
      for (var i = 0;i < 32;i++) v.push(1);
      for (var i = 0;i < 32;i++) k.push(0);
      k = util.hmacSha256(v.concat([0]).concat(key).concat(hash),k)
      v = util.hmacSha256(v,k)
      k = util.hmacSha256(v.concat([1]).concat(key).concat(hash),k)
      v = util.hmacSha256(v,k)
      v = util.hmacSha256(v,k)
      return BigInteger(convert.bytesToHex(v),16)
  },
  sign: function (hash, priv) {
    var d = priv;
    var n = ecparams.getN();
    var e = BigInteger.fromByteArrayUnsigned(hash);
    do {
      var k = ECDSA.deterministicGenerateK(hash, priv);
      var G = ecparams.getG();
      var Q = G.multiply(k);
      var r = Q.getX().toBigInteger().mod(n);
      var i = Q.getY().toBigInteger().mod(BigInteger("2"));
    } while (r.compareTo(BigInteger.ZERO) <= 0);

    var s = k.modInverse(n).multiply(e.add(d.multiply(r))).mod(n);

    return [ i.add(BigInteger("27")), r, s ]
  },

  verify: function(sig, hash, pub){
    pub.validate();
    var r = sig[1],
        s = sig[2];
    var n = ecparams.getN();
    var G = ecparams.getG();
    var e = BigInteger.fromByteArrayUnsigned(hash);
    var s_inv = s.modInverse(n).subtract(n);
    var u1 = s_inv.multiply(e).mod(n);
    var u1G = G.multiply(u1);
    var u2 = r.multiply(s_inv).mod(n);
    var u2Q = pub.multiply(u2);
    var sum = u1G.add(u2Q); // can use ShamirsTrick instead ...
    var x = sum.getX()['x'];
    return r.equals(x);
  },

  privToPub: function(priv){
    var d = BigInteger.fromByteArrayUnsigned(priv);
    var G = ecparams.getG();
    var Q = G.multiply(priv);
    return Q;
  },

  /**
   * Recover a public key from a signature.
   *
   * See SEC 1: Elliptic Curve Cryptography, section 4.1.6, "Public
   * Key Recovery Operation".
   *
   * http://www.secg.org/download/aid-780/sec1-v2.pdf
   */
  recoverPubKey: function (sig, hash) {
    var i = sig[0],
        r = sig[1],
        s = sig[2];
    // The recovery parameter i has two bits.
    i = parseInt(i.subtract(BigInteger("27")).toString()) & 3;

    // The less significant bit specifies whether the y coordinate
    // of the compressed point is even or not.
    var isYEven = i & 1;

    // The more significant bit specifies whether we should use the
    // first or second candidate key.
    var isSecondKey = i >> 1;

    var n = ecparams.getN();
    var G = ecparams.getG();
    var curve = ecparams.getCurve();
    var p = curve.getQ();
    var a = curve.getA().toBigInteger();
    var b = curve.getB().toBigInteger();

    // We precalculate (p + 1) / 4 where p is if the field order
    if (!P_OVER_FOUR) {
      P_OVER_FOUR = p.add(BigInteger.ONE).divide(BigInteger.valueOf(4));
    }

    // 1.1 Compute x
    var x = isSecondKey ? r.add(n) : r;

    // 1.3 Convert x to point
    var alpha = x.multiply(x).multiply(x).add(a.multiply(x)).add(b).mod(p);
    var beta = alpha.modPow(P_OVER_FOUR, p);

    var xorOdd = beta.isEven() ? (i % 2) : ((i+1) % 2);
    // If beta is even, but y isn't or vice versa, then convert it,
    // otherwise we're done and y == beta.
    var y = (beta.isEven() ? !isYEven : isYEven) ? beta : p.subtract(beta);

    // 1.4 Check that nR is at infinity
    var R = new ECPointFp(curve,
                          curve.fromBigInteger(x),
                          curve.fromBigInteger(y));
    R.validate();

    // 1.5 Compute e from M
    var e = BigInteger.fromByteArrayUnsigned(hash);
    var eNeg = BigInteger.ZERO.subtract(e).mod(n);

    // 1.6 Compute Q = r^-1 (sR - eG)
    var rInv = r.modInverse(n);
    var Q = implShamirsTrick(R, s, G, eNeg).multiply(rInv);

    Q.validate();
    return Q
  },
};

module.exports = ECDSA;

