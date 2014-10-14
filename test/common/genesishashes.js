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

describe('[Common]', function () {
  it('should create a new block chain', function (done) {
    internals.blockchain = new Blockchain(blockDB, detailsDB);
    internals.blockchain.init(done);
  });

  it('should have added the genesis correctly', function () {
    var expected = ["0000000000000000000000000000000000000000000000000000000000000000", "1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347", "0000000000000000000000000000000000000000", "08bf6a98374f333b84e7d063d607696ac7cbbd409bd20fbe6a741c2dfc0eb285", "00", "020000", "00", "00", "0f4240", "00", "00", "00", "04994f67dc55b09e814ab7ffc8df3686b4afb2bb53e60eae97ef043fe03fb829"];
    var zero = '00',
      parentHash = '0000000000000000000000000000000000000000000000000000000000000000',
      unclesHash = utils.emptyRlpHash().toString('hex'),
      coinbase = utils.zero160().toString('hex'),
      stateRoot = genesisData.genesis_state_root,
      transactionTrie = zero,
      difficulty = utils.intToHex(Math.pow(2, 17)),
      number = zero,
      minGasPrice = zero,
      gasLimit = '0f4240', // todo: fix
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

    // nonce = '04994f67dc55b09e814ab7ffc8df3686b4afb2bb53e60eae97ef043fe03fb829'; // todo: remove

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

console.log('genesis: ', genesis)
console.log('expected: ', expected)
    assert(genesis[0].length === expected.length)
    assert.deepEqual(genesis[0], expected)
    internals.blockchain.addBlock(genesis, function() {
      assert(internals.blockchain.meta.genesis === genesisData.genesis_hash);
    });
  });
});
