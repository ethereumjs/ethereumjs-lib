const Ethash = require('./ethash.js');
const util = require('./util.js');
const assert = require('assert');
const rlp = require('rlp');
const BN = require('bn.js');

var first = {
  "nonce": "4242424242424242",
  "mixhash": "58f759ede17a706c93f13030328bcea40c1d1341fb26f2facd21ceb0dae57017",
  "header": "f901f3a00000000000000000000000000000000000000000000000000000000000000000a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347940000000000000000000000000000000000000000a09178d0f23c965d81f0834a4c72c6253ce6830f4022b1359aaebfc1ecba442d4ea056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008302000080830f4240808080a058f759ede17a706c93f13030328bcea40c1d1341fb26f2facd21ceb0dae57017884242424242424242",
  "seed": "0000000000000000000000000000000000000000000000000000000000000000",
  "result": "dd47fd2d98db51078356852d7c4014e6a5d6c387c35f40e2875b74a256ed7906",
  "cache_size": 16776896,
  "full_size": 1073739904,
  "header_hash": "2a8de2adf89af77358250bf908bf04ba94a6e8c3ba87775564a41d269a05e4ce",
  "cache_hash": "35ded12eecf2ce2e8da2e15c06d463aae9b84cb2530a00b932e4bbc484cde353"
};

var e = new Ethash();
e.mkcache( first.cache_size, new Buffer(first.seed, 'hex'))
console.log(e.hash().toString('hex'));
assert(e.hash().toString('hex')=== first.cache_hash);

var r = e.hashimoto(new Buffer(first.header_hash, 'hex'), new Buffer(first.nonce, 'hex'), first.full_size)
console.log('result  ' + r.result.toString('hex') );
console.log('mix: ' + r.mix.toString('hex') );

// e.mkcache(2048, new Buffer("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
// console.log('cache hash: ' + e.hash().toString('hex'));
// var node = e.calcDatasetItem(5);
// console.log(node.toString('hex'));

// var r = e.hashimoto(new Buffer("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"), new Buffer('a~'), 2048 )

// console.log('Ethash cache hash: ' + r.result.toString('hex') );
// var hash = hasher.hash(first.hash, first.nonce);
// console.log(hash);

// console.log(ethash.calcSeed(new Buffer([0])).toString('hex') )
// console.log(new Buffer(ethash.calcSeed(70000)).toString('hex'))
