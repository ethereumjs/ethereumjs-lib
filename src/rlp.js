var util = require('./util'),
    BigInteger = require('./jsbn/jsbn');

var rlp = (function() {
    var INPUT_LIMIT = BigInteger('2').pow(BigInteger('64'));
    var BI_56 = BigInteger('56');

    function __decode(s, pos) {
        pos = pos || 0;
        //assert pos < len(s), "read beyond end of string in __decode"
        var b, b2, o, obj, pos_end, res;
        var fchar = s[pos].charCodeAt(0);

        if (fchar < 128) {
            return [s[pos], pos + 1];
        }
        else if (fchar < 184) {
            b = fchar - 128;
            return [s.slice(pos + 1,pos + 1 + b), pos + 1 + b];
        }
        else if (fchar < 192) {
            b = fchar - 183;
            b2 = util.bigEndianToInt(s.slice(pos + 1,pos + 1 + b));
            // TODO: may need to AVOID intValue() and also rewrite slice()
            var p1bb2 = BigInteger(''+pos+1+b).add(b2).intValue();
            return [s.slice(pos + 1 + b, p1bb2), p1bb2];
        }
        else if (fchar < 248) {
            o = [];
            pos += 1;
            pos_end = pos + fchar - 192;

            while (pos < pos_end) {
                res = __decode(s, pos);
                obj = res[0]; pos = res[1];
                o.push(obj);
            }
            //assert pos == pos_end, "read beyond list boundary in __decode"
            return [o, pos];
        }
        else {
            b = fchar - 247;
            b2 = util.bigEndianToInt(s.slice(pos + 1,pos + 1 + b));
            o = [];
            pos += 1 + b;
            pos_end = b2.add(BigInteger(''+pos)).intValue();  // TODO: may need to AVOID intValue()
            while (pos < pos_end) {
                res = __decode(s, pos);
                obj = res[0]; pos = res[1];
                o.push(obj);
            }
            //assert pos == pos_end, "read beyond list boundary in __decode"
            return [o, pos];
        }
    }

    function decode(s) {
        if (s) {
            return __decode(s)[0];
        }
    }

    // L is BigInteger
    function encodeLength(L, offset) {
        if (L.compareTo(BI_56) < 0) {
            return String.fromCharCode(L.intValue() + offset);
        }
        else if (L.compareTo(INPUT_LIMIT) < 0) {
            var BL = util.intToBigEndian(L);
            return String.fromCharCode(BL.length + offset + 55) + BL;
        }
        else {
            throw new Error("input too long");
        }
    }

    function encode(s) {
        if (util.isString(s)) {
            if (s.length === 1 && s.charCodeAt(0) < 128) {
                return s;
            }
            else {
                return encodeLength(BigInteger(''+s.length), 128) + s;
            }
        }
        else if (util.isArray(s)) {
            var output = s.reduce(function(output, item) {
                return output += encode(item);
            }, '');
            return encodeLength(BigInteger(''+output.length), 192) + output;
        }
        else if (s instanceof BigInteger) {
            var hex = util.intToBigEndian(s);
            return encode(hex);
        }
        else {
            throw new Error("input must be string, array, or BigInteger");
        }
    }

    return {
        decode: decode,
        encode: encode
    };
})();

module.exports = rlp;
