const rlp = require('rlp'),
  Trie = require('merkle-patricia-tree'),
  async = require('async'),
  utils = require('./utils.js'),
  bignum = require('bignum'),
  BlockHeader = require('./blockHeader'),
  TR = require('../lib/transactionReceipt.js');

/**
 * Represents a block
 * @constructor
 * @param {Array} data raw data, deserialized
 */
var Block = module.exports = function(data) {

  this.transactionReceipts = [];
  this.uncleHeaders = [];
  this._inBlockChain = false;
  this.txTrie = new Trie();

  Object.defineProperty(this, 'raw', {
    get: function() {
      return this.serialize(false);
    }
  });

  //defaults
  if (!data) {
    data = [
      [],
      [],
      []
    ];
  }

  this.header = new BlockHeader(data[0]);

  var rawTransactions = data[1],
    rawUncleHeaders = data[2];

  //parse uncle headers
  for (var i = 0; i < rawUncleHeaders.length; i++) {
    this.uncleHeaders.push(new BlockHeader(rawUncleHeaders[i]));
  }

  //parse transactions
  for (i = 0; i < rawTransactions.length; i++) {
    var tr = new TR(rawTransactions[i]);
    this.transactionReceipts.push(tr);
  }
};

/**
 *Produces a hash the RLP of the block
 *@method hash
 */
Block.prototype.hash = function() {
  return this.header.hash();
};

/**
 * Produces a serialization of the block.
 * @method serialize
 * @param {Boolean} rlpEncode whether to rlp encode the block or not
 */
Block.prototype.serialize = function(rlpEncode) {
  var raw = [this.header.raw, [],
    []
  ];

  //rlpEnode defaults to true
  if (typeof rlpEncode === 'undefined') {
    rlpEncode = true;
  }

  this.transactionReceipts.forEach(function(tr) {
    raw[1].push([tr.transaction.raw, tr.state, tr.gasUsed]);
  });

  this.uncleHeaders.forEach(function(uncle) {
    raw[2].push(uncle.raw);
  });

  return rlpEncode ? rlp.encode(raw) : raw;
};

/**
 * Generate transaction trie. The tx trie must be generated before the block can
 * be validated
 * @method genTxTrie
 * @param {Function} cb
 */
Block.prototype.genTxTrie = function(cb) {
  var i = 0,
    self = this;

  async.eachSeries(this.transactionReceipts, function(tr, done) {
    self.txTrie.put(rlp.encode(i), tr.serialize(), done);
    i++;
  }, cb);
};

/**
 * Validates the transaction trie
 * @method validateTransactionTrie
 * @return {Boolean}
 */
Block.prototype.validateTransactionsTrie = function() {
  var txT = this.header.transactionsTrie.toString('hex');
  if (this.transactionReceipts.length) {
    return txT === this.txTrie.root.toString('hex');
  } else {
    return txT === '00';
  }
};

/**
 * Validates the transactions
 * @method validateTransactions
 * @return {Boolean}
 */
Block.prototype.validateTransactions = function() {
  var validTxs = true;
  this.transactionReceipts.forEach(function(tr) {
    validTxs &= tr.transaction.validate();
  });
  return validTxs;
};

/**
 * Validates the block
 * @method validate
 * @param {BlockChain} blockChain the blockchain that this block wants to be part of
 * @param {Function} cb the callback which is given a `String` if the block is not valid
 */
Block.prototype.validate = function(blockChain, cb) {
  var self = this;

  async.parallel([
    //validate uncles
    self.validateUncles.bind(self, blockChain),
    //validate block
    self.header.validate.bind(self.header, blockChain),
    //generate the transaction trie
    self.genTxTrie.bind(self)
  ], function(err) {
    if (self.validateTransactionsTrie() &&
      self.validateTransactions() && !err) {

      self.parentBlock = self.header.parentBlock;
      cb();

    } else {

      cb(err || 'invalid block');

    }
  });
};

Block.prototype.validateUncles = function(blockChain, cb) {

  var self = this;

  async.each(self.uncleHeaders, function(uncle, cb2) {

    var height = bignum.fromBuffer(self.header.number);

    async.parallel([
      uncle.validate.bind(uncle, blockChain, height),
      //check to make sure the uncle is not already in the blockchain
      function(cb3) {
        blockChain.getBlockInfo(uncle.hash(), function(err, blockInfo) {
          //TODO: remove uncles from BC
          if (blockInfo && blockInfo.uncle) {
            cb3(err || 'uncle already included');
          } else {
            cb3();
          }
        });
      }
    ], cb2);
  }, cb);
};

Block.prototype.toJSON = function() {
  return utils.baToJSON(this.raw);
};
