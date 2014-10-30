const SHA3 = require('sha3'),
  assert = require('assert'),
  rlp = require('rlp'),
  bignum = require('bignum');

//the max interger that this VM can handle
exports.MAX_INTERGER = new bignum('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16);

/**
 * Returns 256 bit buffer filled with 0s
 * @method zero256
 * @return {Buffer}
 */
exports.zero256 = function() {
  var buf = new Buffer(32);
  buf.fill(0);
  return buf;
};

/**
 * Constant: 160 bit filled with 0s
 * @method zero160
 * @return {Buffer} 160 bits of zero hash
 */
exports.zero160 = function() {
  var buf = new Buffer(20);
  buf.fill(0);
  return buf;
};

/**
 * Returns a buffer filled with 0s
 * @method zeros
 * @param {Integer} bytes  the number of bytes the buffer should be
 * @return {Buffer}
 */
exports.zeros = function(bytes){
  var buf = new Buffer(bytes);
  buf.fill(0);
  return buf;
};

/**
 * Returns an SHA3-256 hash of `null`
 * @method emptyHash
 * @return {Buffer}
 */
exports.emptyHash = function() {
  var hash = 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
  return new Buffer(hash, 'hex');
};

/**
 * Return an SHA3-256 hash of the rlp of []
 * @method emptyRlpHash
 */
exports.emptyArrayRlpHash = function() {
  var hash = '1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
  return new Buffer(hash, 'hex');
};

/**
 * Return an SHA3-256 hash of the rlp of `null`
 * @method emptyRlpHash
 */
exports.emptyRlpHash = function() {
  var hash = '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
  return new Buffer(hash, 'hex');
};

exports.sha3 = function(a){
  var h = new SHA3.SHA3Hash(256);
  if (a) {
    h.update(a);
  }
  return new Buffer(h.digest('hex'), 'hex');
};

/**
 * Trims leading zeros from a buffer or an array
 * @method unpad
 * @param {Buffer|Array|String}
 * @return {Buffer|Array|String}
 */
exports.unpad = function(a) {
  var first = a[0];
  while (!first && a.length > 1) {
    a = a.slice(1);
    first = a[0];
  }
  return a;
};

/**
 * pads an array of buffer with leading zeros till it has 256 bits
 * @method pad256
 * @param {Buffer|Array}
 * @return {Buffer|Array}
 */
exports.pad256 = function(array) {
  var buf256 = new Buffer(32);

  if (array.length !== 32) {
    buf256.fill(0);
    for (var i = 0; i < array.length; i++) {
      buf256[32 - array.length + i] = array[i];
    }
  } else {
    buf256 = array;
  }

  return buf256;
};

/**
 *
 * pads an array of buffer with leading zeros till it has 160 bits
 * @method pad160
 * @param {Buffer|Array}
 * @return {Buffer|Array}
 */
exports.pad160 = function(array) {
  var buf160 = new Buffer(20);

  if (array.length !== 20) {
    buf160.fill(0);
    for (var i = 0; i < array.length; i++) {
      buf160[20 - array.length + i] = array[i];
    }
  } else {
    buf160 = array;
  }

  return buf160;
};

/**
 * Converts an integer into a hex string
 * @method intToHex
 * @param {Number}
 * @return {String}
 */
exports.intToHex = function(i) {
  assert(i % 1 === 0, 'number is not a interger');
  assert(i >= 0, 'number must be positive');
  var hex = i.toString(16);
  if (hex.length % 2) {
    hex = '0' + hex;
  }
  return hex;
};

/**
 * Converts an integer to a buffer
 * @method intToBuffer
 * @param {Number}
 * @return {Buffer}
 */
exports.intToBuffer = function(i) {
  var hex = exports.intToHex(i);
  return new Buffer(hex, 'hex');
};

/**
 * Converts a buffer to an Interger
 * @method bufferToInt
 * @param {Buffer}
 * @return {Number}
 */
exports.bufferToInt = function(buf) {
  return parseInt(buf.toString('hex'), 16);
};

/**
 * interpets a buffer as a signed integer and returns a bignum
 * @method fromSigned
 * @param {Buffer} num
 * @return {Bignum}
 */
exports.fromSigned = function(num) {
  if (num.bitLength() === 256) {
    return num.xor(exports.MAX_INTERGER).add(1).mod(256).neg();
  } else {
    return num;
  }
};

/**
 * Converts a bignum to an unsigned interger and returns it as a buffer
 * @method toUnsigned
 * @param {Bignum} num
 * @return {Buffer}
 */
exports.toUnsigned = function(num) {
  if (num.lt(0)) {
    return num.neg().xor(exports.MAX_INTERGER).add(1).mod(256);
  } else {
    return num;
  }
};

/**
 * Returns the ethereum address of a given public key
 * @method pubToAddress
 * @param {Buffer}
 * @return {Buffer}
 */
exports.pubToAddress = function(pubKey) {

  var hash = new SHA3.SHA3Hash(256);

  hash.update(pubKey.slice(1));
  return Buffer(hash.digest('hex').slice(-40), 'hex');
};

/**
 * Generates a new address
 * @method generateAddress
 * @param {Buffer} from the address which is creating this new address
 * @param {Buffer} nonce the nonce of the from account
 */
exports.generateAddress = function(from, nonce) {
  nonce = bignum.fromBuffer(nonce).sub(1).toBuffer();
  var hash = new SHA3.SHA3Hash(256);
  hash.update(rlp.encode([new Buffer(from, 'hex'), nonce]));
  return new Buffer(hash.digest('hex').slice(24), 'hex');
};

/**
 * defines properties on a `Object`
 * @method defineProperties
 * @param {Object} self the `Object` to define properties on
 * @param {Array} fields an array fields to define
 */
exports.defineProperties = function(self, fields) {

  fields.forEach(function(field, i) {
    if (!field.name) {
      field = {
        name: field
      };
    }

    Object.defineProperty(self, field.name, {
      enumerable: true,
      configurable: true,
      get: function() {
        return this.raw[i];
      },
      set: function(v) {
        if (!Buffer.isBuffer(v)) {
          if (typeof v === 'string') {
            v = new Buffer(v, 'hex');
          } else if (v !== null) {
            v = exports.intToBuffer(v);
          }
        }

        if (field.length) {
          assert(field.length === v.length, 'The field ' + field.name + 'must have byte length of ' + field.length);
        }

        this.raw[i] = v;
      }
    });
  });
};

/**
 * Validate defined fields
 * @method validate
 * @param {Array} fields
 * @param {Object} data
 */
exports.validate = function(fields, data) {
  var i = 0;
  fields.forEach(function(f) {
    if (f.name && f.length) {
      assert(data[i].length === f.length, 'invalid data for field: ' + f.name + ' needs length:' + f.length + 'got length: ' + data[i].length);
    }
    i++;
  });
};

/**
 * Print a Buffer Array
 * @method printBA
 * @param {Buffer|Array}
 */
exports.printBA = function(ba) {
  if (Buffer.isBuffer(ba)) {
    if (ba.length === 0) {
      console.log('new Buffer(0)');
    } else {
      console.log('new Buffer(\'' + ba.toString('hex') + '\', \'hex\')');
    }
  } else if (ba instanceof Array) {
    console.log('[');
    for (var i = 0; i < ba.length; i++) {
      exports.printBA(ba[i]);
      console.log(',');
    }
    console.log(']');
  } else {
    console.log(ba);
  }
};

/**
 * converts a buffer array to JSON
 * @method BAToJSON
 * @param {Buffer|Array}
 */
exports.baToJSON = function(ba) {
  if (Buffer.isBuffer(ba)) {
    return ba.toString('hex');
  } else if (ba instanceof Array) {
    var array = [];
    for (var i = 0; i < ba.length; i++) {
      array.push(exports.baToJSON(ba[i]));
    }
    return array;
  }
};
