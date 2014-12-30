var Transaction = require('../transaction.js'),
  Block = require('../block.js'),
  utils = require('../utils.js');

//parses an array of transactions
function parseTxs(payload) {
  var txs = [];
  for (var i = 1; i < payload.length; i++) {
    txs.push(new Transaction(payload[i]));
  }
  return txs;
}

function parseBlocks(payload) {
  //blocks
  var blocks = [];
  for (var i = 1; i < payload.length; i++) {
    blocks.push(new Block(payload[i]));
  }
  return blocks;
}

var meta = exports.meta = {
  name: 'eth',
  version: 49
};

exports.offsets = {
  0x0: 'status',
  0x1: 'getTransactions',
  0x2: 'transactions',
  0x3: 'getBlockHashes',
  0x4: 'blockHashes',
  0x5: 'getBlocks',
  0x6: 'blocks',
  0x7: 'newBlock'
};

//packet sending methods
exports.send = {

  status: function(td, bestHash, genesisHash) {
    var msg = [
      meta.version,
      this.network.networkID,
      td,
      bestHash,
      genesisHash
    ];
    return msg;
  },
  /**
   * Specify (a) transaction(s) that the peer should make sure is included on its
   * transaction queue.
   * @method sendTransactions
   * @param {Array.<Transaction>} transaction
   * @param {Function} cb
   */
  transactions: function(transactions) {
    var msg = [];

    transactions.forEach(function(tx) {
      msg.push(tx.serialize());
    });

    return msg;
  },
  getBlockHashes: function(startHash, max) {
    return [startHash, utils.intToBuffer(max)];
  },
  blockHashes: function(hashes) {
    return hashes;
  },
  getBlocks: function(hashes) {
    hashes = hashes.slice();
    return hashes;
  },
  /**
   * Specify (a) block(s) that the peer should know about.
   * @method sendBlocks
   * @param {Array.<Block>} blocks
   * @param {Function} cb
   */
  blocks: function(blocks) {
    var msg = [];

    blocks.forEach(function(block) {
      msg.push(block.serialize());
    });

    return msg;
  },
  /**
   * Specify (a) block(s) that the peer should know about.
   * @method sendBlocks
   * @param {Array.<Block>} block
   * @param {Number} td tottal difficulty
   * @param {Function} cb
   */
  newBlock: function(block, td) {
    var msg = [block.serialize(false), td];
    return msg;
  }
};

//packet parsing methods
exports.parse = {
  status: function(payload) {
    return {
      ethVersion: payload[1][0],
      networkID: payload[2][0],
      td: payload[3],
      bestHash: payload[4],
      genesisHash: payload[5]
    };
  },
  transactions: function(payload) {
    return parseTxs(payload);
  },
  getBlockHashes: function(payload) {
    return {
      hash: payload[1],
      maxBlocks: payload[2]
    };
  },
  blockHashes: function(payload) {
    return payload.slice(1);
  },
  getBlocks: function(payload) {
    return payload.slice(1);
  },
  blocks: function(payload) {
    return parseBlocks(payload);
  },
  newBlock: function(payload) {
    return {
      'block': new Block(payload[1]),
      'td': payload[2]
    };
  }
};

//short cut methods to attach to networking
exports.methods = {
  /**
   * Request the peer to send all transactions currently in the queue
   * @method sendGetTransactions
   * @param {Function} cb
   */
  fetchTransactions: function(cb) {
    this.once('eth.transaction', cb);
    this.eth.getTransactions();
  },
  fetchBlockHashes: function(startHash, max, cb) {
    this.once('eth.blockHashes', cb);
    this.eth.getBlockHashes(startHash, max);
  },
  fetchBlocks: function(hashes, cb) {
    this.once('eth.blocks', cb);
    this.eth.getBlocks(hashes);
  }
};
