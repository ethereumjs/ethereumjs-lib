var assert = require('assert'),
  Block = require('../lib/block.js'),
  Blockchain = require('../lib/blockchain.js'),
  levelup = require('levelup'),
  async = require('async'),
  VM = require('../lib/vm'),
  Trie = require('merkle-patricia-tree');

var trie = new Trie(),
  vm = new VM(trie),
  blockFixtures = require('./fixtures/blocks.json').slice();

var blockDB = levelup('', {
    db: require('memdown')
  }),
  detailsDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  internals = {};

describe('[Blockchain]: Basic functions', function() {
  it('should create a new block chain', function(done) {
    internals.blockchain = new Blockchain(blockDB, detailsDB);
    internals.blockchain.init(done);
  });

  it('should create and add genesis block', function(done) {
    vm.generateGenesis(function() {
      var block = new Block();
      block.header.stateRoot = vm.trie.root;
      internals.blockchain.addBlock(block, done);
    });
  });

  it('should add blocks', function(done) {
    blockFixtures.reverse();
    async.eachSeries(blockFixtures, function(rawBlock, callback) {
      internals.blockchain.addBlock(rawBlock.block, callback);
    }, done);
  });

  it('should have added the head correctly', function() {
    assert(internals.blockchain.meta.head === blockFixtures[blockFixtures.length - 1].hash);
  });

  it('should have added the correct height', function() {
    assert(internals.blockchain.meta.height === blockFixtures.length );
  });

  it('should fetch hashes from the chain', function(done) {
    internals.blockchain.getBlockHashes(blockFixtures[1].hash, 2, function(errs, hashes) {
      assert(hashes.length === 2, 'number of hashes');
      assert(blockFixtures[3].hash === hashes[0]);
      assert(blockFixtures[2].hash === hashes[1]);
      done();
    });
  });

  it('should fetch hashes from the chain backwards', function(done) {
    internals.blockchain.getBlockHashes(blockFixtures[4].hash, -2, function(errs, hashes) {
      assert(hashes.length === 2, 'number of hashes');
      assert(blockFixtures[3].hash === hashes[0]);
      assert(blockFixtures[2].hash === hashes[1]);
      done();
    });
  });

  it('should fetch hashes from the chain backwards even when more blocks are requested then exsist', function(done) {
    internals.blockchain.getBlockHashes(blockFixtures[4].hash, -8, function(errs, hashes) {
      assert(hashes.length === 5);
      assert(blockFixtures[3].hash === hashes[0]);
      assert(blockFixtures[2].hash === hashes[1]);
      done();
    });
  });

  it('it should fetch a block from the DB', function(done) {
    internals.blockchain.getBlock(new Buffer(blockFixtures[4].hash, 'hex'), function(errs, block) {
      assert(blockFixtures[4].hash === block.hash().toString('hex'));
      done();
    });
  });

  it('it should fetch a block from the DB', function(done) {
    internals.blockchain.getBlocks( [new Buffer(blockFixtures[4].hash, 'hex')], function(errs, blocks) {
      assert(blocks.length === 1);
      assert(blockFixtures[4].hash === blocks[0].hash().toString('hex'));
      done();
    });
  });

  it('should retrieve all the blocks in order from newest to oldest', function(done) {
    internals.blockchain.getBlockChain(blockFixtures[0].hash, blockFixtures.length, function(err, results) {
      assert(results.length === blockFixtures.length - 1, 'should have correct number of blocks');
      done(err);
    });
  });

});
