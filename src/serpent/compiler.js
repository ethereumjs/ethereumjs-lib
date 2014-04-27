var util = require('../util');
var convert = require('../convert');

module.exports.encodeDataList = function(vals) {
    function enc(n) {
        if (typeof(n) === 'number') {
            return String.fromCharCode.apply(null, convert.numToBytes(n, 32));
        }
        else if (util.isString(n) && n.length === 40) {
            return util.decodeHex(n).lpad('\x00', 32);
        }
        else if (util.isString(n)) {
            return n.lpad('\x00', 32);
        }
        else if (n === true) {
            return 1;
        }
        else if (!n) {
            return 0;
        }
    }
    if (util.isArray(vals)) {
        return vals.map(enc).join('');
    }
    else if (vals === '') {
        return '';
    }
    else {
        throw new Error('TODO encodeDataList');
        // Assume you're getting in numbers or 0x...
        //return ''.join(map(enc, map(numberize, vals.split(' '))));
    }
}

