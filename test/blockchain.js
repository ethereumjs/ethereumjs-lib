var assert = require('assert'),
  Blockchain = require('../lib/blockchain.js'),
  levelup = require('levelup'),
  blockFixtures = require('./fixtures/blocks.json').slice(),
  async = require('async');

var blockDB = levelup('', {
  db: require('memdown')
}),
  detailsDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  internals = {};

describe('[Blockchain]: Basic functions', function () {
  it('should create a new block chain', function (done) {
    internals.blockchain = new Blockchain(blockDB, detailsDB);
    internals.blockchain.init(done);
  });

  it('should add blocks', function (done) {
    blockFixtures.reverse();
    async.eachSeries(blockFixtures, function (rawBlock, callback) {
      internals.blockchain.addBlock(rawBlock.block, callback);
    }, done);
  });

  it('should have added the head correctly', function () {
    assert(internals.blockchain.meta.head === blockFixtures[blockFixtures.length - 1].hash);
  });

  it('should have added the genesis correctly', function () {
    assert(internals.blockchain.meta.genesis === blockFixtures[0].hash);
  });

  it('should have added the correct height', function () {
    console.log(internals.blockchain.meta.height);
    assert(internals.blockchain.meta.height === blockFixtures.length - 1);
  });

  it('should fetch hashes from the chain', function (done) {
    internals.blockchain.getBlockHashes(blockFixtures[1].hash, 2, function (errs, hashes) {
      assert(hashes.length === 2);
      assert(blockFixtures[3].hash === hashes[0]);
      assert(blockFixtures[2].hash === hashes[1]);
      done();
    });
  });

  it('should fetch hashes from the chain backwards', function (done) {
    internals.blockchain.getBlockHashes(blockFixtures[4].hash, -2, function (errs, hashes) {
      assert(hashes.length === 2);
      assert(blockFixtures[3].hash === hashes[0]);
      assert(blockFixtures[2].hash === hashes[1]);
      done();
    });
  });

  it('should fetch hashes from the chain backwards', function (done) {
    internals.blockchain.getBlockHashes(blockFixtures[4].hash, -8, function (errs, hashes) {
      assert(hashes.length === 4);
      assert(blockFixtures[3].hash === hashes[0]);
      assert(blockFixtures[2].hash === hashes[1]);
      done();
    });
  });

  it('should retrieve all the blocks in order from newest to oldest', function (done) {
    internals.blockchain.getBlockChain(blockFixtures[0].hash, blockFixtures.length, function (err, results) {
      assert(results.length === blockFixtures.length -1, 'should have correct number of blocks');
      done(err);
    });
  });

});
