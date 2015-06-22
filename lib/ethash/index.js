const ethUtil = require('ethereumjs-util');
const ethHashUtil = require('./util.js');
const xor = require('bitwise-xor');
const BN = require('bn.js');
const rlp = require('rlp');

var Ethash = module.exports = function() {
  this.cacheSeeds = [ethUtil.zeros(32)];
};

Ethash.prototype.mkcache = function(cacheSize, seed) {
  const n = Math.floor(cacheSize / ethHashUtil.params.HASH_BYTES);
  var o = [ethUtil.sha3(seed, 512)];

  for (var i = 1; i < n; i++) {
    o.push(ethUtil.sha3(o[o.length - 1], 512));
  }

  for (var _ = 0; _ < ethHashUtil.params.CACHE_ROUNDS; _++) {
    for (var i = 0; i < n; i++) {
      var v = o[i].readUInt32LE(0) % n;
      o[i] = ethUtil.sha3(xor(o[(i - 1 + n) % n], o[v]), 512);
    }
  }

  return this.cache = o;
}

Ethash.prototype.calcDatasetItem = function(i) {
  const n = this.cache.length;
  const r = Math.floor(ethHashUtil.params.HASH_BYTES / ethHashUtil.params.WORD_BYTES);
  var mix = new Buffer(this.cache[i % n]);
  mix.writeInt32LE(mix.readUInt32LE(0) ^ i);
  mix = ethUtil.sha3(mix, 512);
  for (var j = 0; j < ethHashUtil.params.DATASET_PARENTS; j++) {
    var cacheIndex = ethHashUtil.fnv(i ^ j, mix.readUInt32LE(j % r * 4));
    mix = ethHashUtil.fnvBuffer(mix, this.cache[cacheIndex % n]);
  }
  return ethUtil.sha3(mix, 512);
}

Ethash.prototype.hashimoto = function(header, nonce, fullSize) {
  const n = Math.floor(fullSize / ethHashUtil.params.HASH_BYTES);
  const w = Math.floor(ethHashUtil.params.MIX_BYTES / ethHashUtil.params.WORD_BYTES);
  const s = ethUtil.sha3(Buffer.concat([header, ethHashUtil.bufReverse(nonce)]), 512);
  const mixhashes = Math.floor(ethHashUtil.params.MIX_BYTES / ethHashUtil.params.HASH_BYTES);
  var mix = Buffer.concat(Array(mixhashes).fill(s));

  for (var i = 0; i < ethHashUtil.params.ACCESSES; i++) {
    var p = ethHashUtil.fnv(i ^ s.readUInt32LE(0), mix.readUInt32LE(i % w * 4)) % Math.floor(n / mixhashes) * mixhashes;
    var newdata = [];
    for (var j = 0; j < mixhashes; j++) {
      newdata.push(this.calcDatasetItem(p + j))
    }

    newdata = Buffer.concat(newdata);
    mix = ethHashUtil.fnvBuffer(mix, newdata);
  }

  var cmix = new Buffer(mix.length / 4);
  for (var i = 0; i < mix.length / 4; i = i + 4) {
    var a = ethHashUtil.fnv(mix.readUInt32LE(i * 4), mix.readUInt32LE((i + 1) * 4));
    var b = ethHashUtil.fnv(a, mix.readUInt32LE((i + 2) * 4));
    var c = ethHashUtil.fnv(b, mix.readUInt32LE((i + 3) * 4));
    cmix.writeUInt32LE(c, i);
  }

  return {
    mix: cmix,
    result: ethUtil.sha3(Buffer.concat([s, cmix])).toString('hex')
  }
}

Ethash.prototype.hash = function() {
  return ethUtil.sha3(Buffer.concat(this.cache));
}

Ethash.prototype.headerHash = function(header){
  return ethUtil.sha3(rlp.encode(header.slice(0, -2)));
}
