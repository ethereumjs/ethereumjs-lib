var BigInteger = require('./jsbn/jsbn'),
    convert = require('./convert'),
    CryptoJS = require('./cryptojs'),
    sec = require('./jsbn/sec'),
    ecparams = sec("secp256k1");
    
// depends on CryptoJS and BitcoinJS

var util = (function() {

    function sha3(x) {
        if (typeof x != "string") {
            x = CryptoJS.enc.Latin1.parse(convert.bytesToString(x))
        }
        else {
            x = CryptoJS.enc.Latin1.parse(x)
        }
        return CryptoJS.SHA3(x, { outputLength: 256 }).toString();
    }

    //Takes arrays and outputs arrays
    function hmacSha256(v, k) {
        var v2 = CryptoJS.enc.Latin1.parse(convert.bytesToString(v)),
            k2 = CryptoJS.enc.Latin1.parse(convert.bytesToString(k))
        return convert.hexToBytes(CryptoJS.HmacSHA256(v2,k2).toString())
    }

    function privToAddr(x) {
        // false flag important since key is uncompressed
        var pub = ecparams.getG().multiply(BigInteger(x,16))
        var bytes = pub.getEncoded().slice(1);
        var addr = util.sha3(bytes);
        return addr.substr(24);
    }

    function decodeHex(s) {
        return s ?
            convert.bytesToString(convert.hexToBytes(s)) : '';
    }

    function encodeHex(s) {
        return convert.bytesToHex(convert.stringToBytes(s));
    }

    function zpad(x, l) {
        var s = '';
        var repeat = Math.max(0, l - x.length);
        for (var i=0; i < repeat; i++) {
            s += '\x00';
        }
        return s + x;
    }

    function coerce_addr_to_bin(x) {
        // TODO isNumber case?
        if (x instanceof BigInteger) {
            return encodeHex(zpad(intToBigEndian(x), 20));
        }
        else if (x.length === 40 || x.length === 0) {
            return decodeHex(x);
        }
        else {
            return zpad(x, 20).slice(-20);
        }
    }

    // bi is BigInteger
    function intToBigEndian(bi) {
        // 0 is a special case, treated same as ''
        if (bi.equals(BigInteger.ZERO)) {
            return '';
        }
        var s = bi.toRadix(16);
        if (s.length & 1) {
            s = '0' + s;
        }
        return decodeHex(s);
    }

    function bigEndianToInt(string) {
        // convert a big endian binary string to BigInteger
        // '' is a special case, treated same as 0
        string = string || '\x00';
        var s = encodeHex(string);
        return BigInteger(s,16);
    }

    function bigInt(n) {
        return BigInteger(''+n)
    }

    var isArray = Array.isArray || function(o)
    {
        return Object.prototype.toString.call(o) === '[object Array]';
    }

    function isString(x) {
        return toString.call(x) == '[object String]';
    }

    return {
        sha3: sha3,
        privToAddr: privToAddr,
        decodeHex: decodeHex,
        encodeHex: encodeHex,
        coerce_addr_to_bin: coerce_addr_to_bin,
        bigInt: bigInt,
        intToBigEndian: intToBigEndian,
        bigEndianToInt: bigEndianToInt,
        isArray: isArray,
        isString: isString,
        hmacSha256: hmacSha256
    }
})();

module.exports = util;
