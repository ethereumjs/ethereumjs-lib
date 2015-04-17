exports.params = {
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
  ACCESSES: 64,
  WORD_BYTES: 4
}

exports.isPrime = function(n) {
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

exports.getCacheSize = function(blockNumber){
  var sz = param.DATASET_BYTES_INIT + param.DATASET_BYTES_GROWTH * (block_number / param.EPOCH_LENGTH);
  sz -= HASH_BYTES;
  while(!isPrime(sz / param.HASH_BYTES )){
    sz -= 2 * param.HASH_BYTES;
  }
  return sz;
}

exports.getFullSize = function(blockNumber){
  var sz = param.CACHE_BYTES_INIT + param.CACHE_BYTES_GROWTH * (block_number / param.EPOCH_LENGTH)
  sz -= param.MIX_BYTES;
  while(!isPrime(sz / params.MIX_BYTES)){
    sz -= 2 * param.HASH_BYTES;
  }
}

var fnv = exports.fnv = function(x, y){
  return (((x * 0x01000000 | 0) + (x * 0x193 | 0)) ^ y ) >>> 0;
}

exports.fnvBuffer = function(a, b){
  var r = new Buffer(a.length);
  for(var i = 0; i < a.length ; i = i + 4){
      r.writeUInt32LE(fnv(a.readUInt32LE(i), b.readUInt32LE(i)), i) ;
  }
  return r;
}

exports.bufReverse = function(a){
  const length = a.length;
  var b = new Buffer(length);
  for(var i = 0; i < length; i++){
    b[i] = a[length - i- 1];
  }
  return b;
}

//fill polyfil
if (!Array.prototype.fill) {
  Array.prototype.fill = function(value) {

    // Steps 1-2.
    if (this == null) {
      throw new TypeError('this is null or not defined');
    }

    var O = Object(this);

    // Steps 3-5.
    var len = O.length >>> 0;

    // Steps 6-7.
    var start = arguments[1];
    var relativeStart = start >> 0;

    // Step 8.
    var k = relativeStart < 0 ?
      Math.max(len + relativeStart, 0) :
      Math.min(relativeStart, len);

    // Steps 9-10.
    var end = arguments[2];
    var relativeEnd = end === undefined ?
      len : end >> 0;

    // Step 11.
    var final = relativeEnd < 0 ?
      Math.max(len + relativeEnd, 0) :
      Math.min(relativeEnd, len);

    // Step 12.
    while (k < final) {
      O[k] = value;
      k++;
    }

    // Step 13.
    return O;
  };
}
