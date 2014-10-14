var genesisData = require('../../../tests/genesishashestest.json'),
  assert = require('assert'),
  Blockchain = require('../../lib/blockchain.js'),
  levelup = require('levelup'),
  // async = require('async'),
  utils = require('../../lib/utils'),
  rlp = require('rlp'),
  SHA3 = require('sha3');

var blockDB = levelup('', {
  db: require('memdown')
}),
  detailsDB = levelup('/does/not/matter', {
    db: require('memdown')
  }),
  internals = {};

describe('[Common]: genesis hashes tests', function () {
  it('should create a new block chain', function (done) {
    internals.blockchain = new Blockchain(blockDB, detailsDB);
    internals.blockchain.init(done);
  });

  it('should have added the genesis correctly', function () {
    var zero = '00',
      parentHash = utils.zero256().toString('hex'),
      unclesHash = utils.emptyRlpHash().toString('hex'),
      coinbase = utils.zero160().toString('hex'),
      stateRoot = genesisData.genesis_state_root,
      transactionTrie = zero,
      difficulty = utils.intToHex(Math.pow(2, 17)),
      number = zero,
      minGasPrice = zero,
      gasLimit =  utils.intToHex(1000000),
      gasUsed = zero,
      timestamp = zero,
      extraData = zero,
      nonce,
      uncles = [],
      transactions = [],
      hash;

    hash = new SHA3.SHA3Hash(256);
    hash.update(rlp.encode(42));
    nonce = hash.digest('hex');

    var genesis = [
      [
        parentHash,
        unclesHash,
        coinbase,
        stateRoot,
        transactionTrie,
        difficulty,
        number,
        minGasPrice,
        gasLimit,
        gasUsed,
        timestamp,
        extraData,
        nonce
      ],
      uncles,
      transactions
    ];

    internals.blockchain.addBlock(genesis, function() {
      assert(internals.blockchain.meta.genesis === genesisData.genesis_hash);
    });
  });
});
