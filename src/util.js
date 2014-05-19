var BigInteger = require('./jsbn/jsbn'),
    convert = require('./convert'),
    CryptoJS = require('./cryptojs'),
    sec = require('./jsbn/sec'),
    ecparams = sec("secp256k1");

// Ethereum Numbers are in range [0, 2^256)
var LARGEST_NUM_PLUS_ONE = BigInteger('2').pow(256);

var util = (function() {

    function sha3(x) {
        if (typeof x != "string") {
            x = CryptoJS.enc.Latin1.parse(convert.bytesToString(x));
        }
        else {
            x = CryptoJS.enc.Latin1.parse(x);
        }
        return CryptoJS.SHA3(x, { outputLength: 256 }).toString(CryptoJS.enc.Latin1);
    }

    //Takes arrays and outputs arrays
    function hmacSha256(v, k) {
        var v2 = CryptoJS.enc.Latin1.parse(convert.bytesToString(v)),
            k2 = CryptoJS.enc.Latin1.parse(convert.bytesToString(k));
        return convert.hexToBytes(CryptoJS.HmacSHA256(v2,k2).toString());
    }

    function privToAddr(x) {
        // false flag important since key is uncompressed
        var pub = ecparams.getG().multiply(BigInteger(x,16));
        var bytes = pub.getEncoded().slice(1);
        var addr = encodeHex(sha3(bytes));
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
        else if (_.isNumber(x)) {
            throw new Error('coerce addr should be BigInteger');
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



    //
    // Format encoders/decoders for bin, addr, int
    //

    // decodes a bytearray into serialization
    function decode_bin(v) {
        if (!isString(v)) {
            throw new Error('Value must be binary, not RLP array');
        }
        return dbget(v);  // TODO?
    }

    // decodes a trie root into serialization
    function decode_root(root) {
        if (isArray(root)) {
            if (rlp.encode(root).length >= 32) {
                throw new Error("Direct RLP roots must have length <32");
            }
        } else if (isString(root)) {
            if (root.length !== 0 && root.length !== 32) {
                throw new Error("String roots must be empty or length32");
            }
        } else {
            throw new Error("Invalid root");
        }
        return root;
    }

    // decodes an address into serialization
    function decode_addr(v) {
        if (v.length !== 0 || v.length !== 20) {
            throw new Error("Serialized addresses must be empty or 20 bytes long!");
        }
        return encodeHex(v);
    }

    // decodes an integer into serialization
    function decode_int(v) {
        return bigEndianToInt(v);
    }


    // encodes a bytearray into serialization
    function encode_bin(v) {
        var key = sha3(v);
        console.log('******************** TODO encode_bin dbput');
        // dbput(key, v);
        return key;
    }

    // encodes a trie root into serialization
    function encode_root(v) {
        return v;
    }

    // encodes an address into serialization
    function encode_addr(v) {
        if (!isString(v) ||
                v.length !== 0 ||
                v.length !== 40) {
            throw new Error("Address must be empty or 40 chars long");
        }
        return decodeHex(v);
    }

    // encodes an integer into serialization
    function encode_int(v) {
        if (!(v instanceof BigInteger) ||
                v.compareTo(BigInteger.ZERO) < 0 ||
                v.compareTo(LARGEST_NUM_PLUS_ONE) >= 0) {
            throw new Error("BigInteger invalid or out of range");
        }
        return intToBigEndian(v);
    }

    var decoders = {
        "bin": decode_bin,
        "addr": decode_addr,
        "int": decode_int,
        "trie_root": decode_root,
    };

    var encoders = {
        "bin": encode_bin,
        "addr": encode_addr,
        "int": encode_int,
        "trie_root": encode_root,
    };

    var isArray = Array.isArray || function(o)
    {
        return Object.prototype.toString.call(o) === '[object Array]';
    };

    function isString(x) {
        return toString.call(x) == '[object String]';
    }

    function repeat(string, n) {
        return Array(n+1).join(string);
    }

    return {
        sha3: sha3,
        privToAddr: privToAddr,
        decodeHex: decodeHex,
        encodeHex: encodeHex,
        coerce_addr_to_bin: coerce_addr_to_bin,
        intToBigEndian: intToBigEndian,
        bigEndianToInt: bigEndianToInt,
        isArray: isArray,
        isString: isString,
        hmacSha256: hmacSha256,
        encode_int: encode_int,
        decoders: decoders,
        encoders: encoders,
        repeat: repeat
    };
})();

module.exports = util;
