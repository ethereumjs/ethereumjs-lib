const Ethash = require('../lib/ethash');
const Header = require('../lib/blockHeader.js');
const tape = require('tape');
const powTests = require('ethereum-tests').powTests.ethash_tests;
const async = require('async');

var tests = Object.keys(powTests);

tape('POW tests', function(t) {
  tests.forEach(function(key) {
    var test = powTests[key];
    var ethash = new Ethash();
    var header = new Header(new Buffer(test.header, 'hex'));
    var headerHash = ethash.headerHash(header.raw);
    t.equal(headerHash.toString('hex'), test.header_hash, 'generate header hash')

    ethash.mkcache(test.cache_size, new Buffer(test.seed, 'hex'))
    t.equal(ethash.hash().toString('hex'), test.cache_hash, 'generate cache');

    var r = ethash.hashimoto(headerHash, new Buffer(test.nonce, 'hex'), test.full_size)
    t.equal(r.result.toString('hex'), test.result, 'generate result');
    t.equal(r.mix.toString('hex'), test.mixhash, 'generate mix hash');

  });
  t.end();
});
