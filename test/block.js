var Block = require('../lib/block.js'),
  blockFixtures = require('./fixtures/blocks.json').slice().reverse(),
  async = require('async'),
  assert = require('assert'),
  Blockchain = require('../lib/blockchain.js'),
  levelup = require('levelup');

var blockDB = levelup('', {
  db: require('memdown')
}),
  detailsDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  blockchain = new Blockchain(blockDB, detailsDB);

describe('[Block]: Basic functions', function () {
  var blocks = [];

  it('should create a new block chain', function (done) {
    blockchain.init(done);
  });

  it('should add blocks', function (done) {
    async.eachSeries(blockFixtures, function (rawBlock, callback) {
      blockchain.addBlock(rawBlock.block, callback);
    }, done);
  });

  it('should parse a block', function (done) {
    async.eachSeries(blockFixtures, function (rawBlock, cb) {
      var block = new Block(rawBlock.block);
      blocks.push(block);
      block.genTxTrie(cb);
    }, done);
  });

  it('should validate POW', function () {
    //the genesis block does not have a valid POW
    blocks.shift();
    blocks.forEach(function (block) {
      assert(block.header.validatePOW());
    });
  });

  it('should validate the transaction trie', function () {
    //the genesis block does not have a valid POW
    blocks.forEach(function (block) {
      assert(block.validateTransactionsTrie());
    });
  });

  it('should validate the block', function (done) {
    async.each(blocks, function(block, cb){
      block.validate(blockchain, cb);
    }, done);
    //the genesis block does not have a valid POW
  });
});
