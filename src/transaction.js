var util = require('./util'),
    rlp = require('./rlp'),
    BigInteger = require('./jsbn/jsbn'),
    convert = require('./convert'),
    ecdsa = require('./ecdsa');

var tx_structure = [
    ["nonce", "int", 0],
    ["gasprice", "int", 0],
    ["startgas", "int", 0],
    ["to", "addr", ''],
    ["value", "int", 0],
    ["data", "bin", ''],
    ["v", "int", 0],
    ["r", "int", 0],
    ["s", "int", 0],
];

var transaction = (function() {
    var decode_int = util.bigEndianToInt;

    function mktx(nonce, to, value, data) {
        var opts = {
            nonce: nonce,
            gasprice: BigInteger('10').pow(12),
            startgas: BigInteger('10000'),
            to: to,
            value: value,
            data: util.decodeHex(data)
        };

        return util.encodeHex(
                serialize(makeTransaction(opts), false));
    }

    function mkContract(nonce, value, data) {
        var opts = {
            nonce: nonce,
            gasprice: BigInteger('10').pow(12),
            startgas: BigInteger('10000'),
            value: value,
            data: util.decodeHex(data)
        };

        return util.encodeHex(
                serialize(makeContract(opts), false));
    }

    function serialize(tx, isSigned) {
        var o = [];
        tx_structure.forEach(function(v, i) {
            var name = v[0];
            var typ = v[1];
            var defaul = v[2];
            o.push(util.encoders[typ](tx[name]));
        });
        var forRlp = isSigned ? o : o.slice(0, o.length-3);
        return rlp.encode(forRlp);
    }

    // 'constructor'
    function makeTransaction(opts) {
//        TODO handle when a signature exists
//        if (_.key(opts).length > 7) {
//            throw new Error('TODO makeTransaction');
//        }
        return {
            nonce: opts.nonce,
            gasprice: opts.gasprice,
            startgas: opts.startgas,
            to: opts.to,
            value: opts.value,
            data: opts.data,

            v: BigInteger.ZERO || opts.v,  // TODO
            r: BigInteger.ZERO || opts.r,
            s: BigInteger.ZERO || opts.s,
            sender: 0
        };
    }

    // 'constructor'
    function makeContract(opts) {
        var tx = makeTransaction({
                nonce: opts.nonce,
                gasprice: opts.gasprice,
                startgas: opts.startgas,
                to: '',
                value: opts.value,
                data: opts.data
            });

        tx.v = opts.v || BigInteger.ZERO;
        tx.r = opts.r || BigInteger.ZERO;
        tx.s = opts.s || BigInteger.ZERO;

        return tx;
    }

    function sign(tx, key) {
        return util.encodeHex(serialize(__sign(tx, key), true));
    }

    function __sign(tx, key) {
        var rawData = serialize(tx, false);
        var rawhash = convert.stringToBytes(util.sha3(rawData));

        // false flag important since key is uncompressed
        var ecKey = BigInteger(key, 16);
        var sig = ecdsa.sign(rawhash, ecKey);
        tx.v = sig[0];
        tx.r = sig[1];
        tx.s = sig[2];
        tx.sender = util.privToAddr(key);

        return tx;
    }

    function parse(data) {
        if (data.match(/^[0-9a-fA-F]*$/)) {
            data = util.decodeHex(data);
        }

        var o = rlp.decode(data).concat(['','','']);

        var opts = {
            nonce: decode_int(o[0]),
            gasprice: decode_int(o[1]),
            startgas: decode_int(o[2]),
            to: decode_addr(o[3]),
            value: decode_int(o[4]),
            data: o[5],
            v: decode_int(o[6]),
            r: decode_int(o[7]),
            s: decode_int(o[8])
        };

        return makeTransaction(opts);
    }

    return {
        mktx: mktx,
        mkContract: mkContract,
        sign: sign,
        parse: parse,
        serialize: serialize
    };
})();

module.exports = transaction;
