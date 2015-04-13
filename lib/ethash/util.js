// util.js
// Tim Hughes <tim@twistedfury.com>

/*jslint node: true, shadow:true */

const param = {
  DATASET_BYTES_INIT: 1073741824, //2^30  
  DATASET_BYTES_GROWTH: 8388608, //2 ^ 23
  CACHE_BYTES_INIT: 16777216,    // 2**24          # bytes in dataset at genesis
  CACHE_BYTES_GROWTH: 131072,    //   cache growth per epoch
  CACHE_MULTIPLIER: 1024,        // Size of the DAG relative to the cache
  EPOCH_LENGTH : 30000,          // blocks per epoch
  MIX_BYTES: 128,                // width of mix
  HASH_BYTES: 64,                // hash length in bytes
  DATASET_PARENTS: 256,          // number of parents of each dataset element
  CACHE_ROUNDS: 3,               // number of rounds in cache production
  ACCESSES: 64       
}

function nibbleToChar(nibble) {
  return String.fromCharCode((nibble < 10 ? 48 : 87) + nibble);
}

function charToNibble(chr) {
  if (chr >= 48 && chr <= 57) {
    return chr - 48;
  }
  if (chr >= 65 && chr <= 70) {
    return chr - 65 + 10;
  }
  if (chr >= 97 && chr <= 102) {
    return chr - 97 + 10;
  }
  return 0;
}

function stringToBytes(str) {
  var bytes = new Uint8Array(str.length);
  for (var i = 0; i != str.length; ++i) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

function hexStringToBytes(str) {
  var bytes = new Uint8Array(str.length >>> 1);
  for (var i = 0; i != bytes.length; ++i) {
    bytes[i] = charToNibble(str.charCodeAt(i << 1 | 0)) << 4;
    bytes[i] |= charToNibble(str.charCodeAt(i << 1 | 1));
  }
  return bytes;
}

function bytesToHexString(bytes) {
  var str = "";
  for (var i = 0; i != bytes.length; ++i) {
    str += nibbleToChar(bytes[i] >>> 4);
    str += nibbleToChar(bytes[i] & 0xf);
  }
  return str;
}

function wordsToHexString(words) {
  return bytesToHexString(new Uint8Array(words.buffer));
}

function uint32ToHexString(num) {
  var buf = new Uint8Array(4);
  buf[0] = (num >> 24) & 0xff;
  buf[1] = (num >> 16) & 0xff;
  buf[2] = (num >> 8) & 0xff;
  buf[3] = (num >> 0) & 0xff;
  return bytesToHexString(buf);
}

function toWords(input) {
  if (input instanceof Uint32Array) {
    return input;
  } else if (input instanceof Uint8Array) {
    var tmp = new Uint8Array((input.length + 3) & ~3);
    tmp.set(input);
    return new Uint32Array(tmp.buffer);
  } else if (typeof input === typeof "") {
    return toWords(stringToBytes(input));
  }
  return null;
}


function isPrime(n) {
  if (n == 2) {
    return true;
  } else if ((n < 2) || (n % 2 == 0)) {
    return false;
  } else {
    for (var i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i == 0)
        return false;
    }
    return true;
  }
}

function getCacheSize(blockNumber){
  var sz = param.DATASET_BYTES_INIT + param.DATASET_BYTES_GROWTH * (block_number / param.EPOCH_LENGTH);
  sz -= HASH_BYTES;
  while(!isPrime(sz / param.HASH_BYTES )){
    sz -= 2 * param.HASH_BYTES;
  }
  return sz;
}

function getFullSize(blockNumber){
  var sz = param.CACHE_BYTES_INIT + param.CACHE_BYTES_GROWTH * (block_number / param.EPOCH_LENGTH)
  sz -= param.MIX_BYTES;
  while(!isPrime(sz / params.MIX_BYTES)){
    sz -= 2 * param.HASH_BYTES;
  }
}

// def get_cache_size(block_number):
//     sz = CACHE_BYTES_INIT + CACHE_BYTES_GROWTH * (block_number // EPOCH_LENGTH)
//     sz -= HASH_BYTES
//     while not isprime(sz / HASH_BYTES):
//         sz -= 2 * HASH_BYTES
//     return sz

// def get_full_size(block_number):
//     sz = DATASET_BYTES_INIT + DATASET_BYTES_GROWTH * (block_number // EPOCH_LENGTH)
//     sz -= MIX_BYTES
//     while not isprime(sz / MIX_BYTES):
//         sz -= 2 * MIX_BYTES
//     return sz

exports.stringToBytes = stringToBytes;
exports.hexStringToBytes = hexStringToBytes;
exports.bytesToHexString = bytesToHexString;
exports.wordsToHexString = wordsToHexString;
exports.uint32ToHexString = uint32ToHexString;
exports.toWords = toWords;
