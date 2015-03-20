const rlp = require('rlp'),
  utils = require('ethereumjs-util'),
  BN = require('bn.js');

/**
 * Represents a Block Header
 * @constructor
 * @param {Array} data raw data, deserialized
 */
var BlockHeader = module.exports = function(data) {

  var fields = [{
    name: 'parentHash',
    length: 32,
    default: utils.zeros(32)
  }, {
    name: 'uncleHash',
    default: utils.SHA3_RLP_ARRAY
  }, {
    name: 'coinbase',
    length: 20,
    default: utils.zeros(20)
  }, {
    name: 'stateRoot',
    length: 32,
    default: utils.zeros(32)
  }, {
    name: 'transactionsTrie',
    length: 32,
    default: utils.SHA3_RLP
  }, {
    name: 'receiptTrie',
    length: 32,
    default: utils.SHA3_RLP
  }, {
    name: 'bloom',
    default: utils.zeros(256)
      //lenght 256
  }, {
    name: 'difficulty',
    default: new Buffer('020000', 'hex')
  }, {
    name: 'number',
    default: new Buffer([])
  }, {
    name: 'gasLimit',
    default: utils.intToBuffer(1000000)
  }, {
    name: 'gasUsed',
    empty: true,
    default: new Buffer([])
  }, {
    name: 'timestamp',
    default: new Buffer([])
  }, {
    name: 'extraData',
    empty: true,
    default: new Buffer([])
  }, {
    name: 'seedHash',
    default: utils.zeros(32)
      //length: 32		
  } , {
    name: 'mixHash',
    default: utils.zeros(32)
      //length: 32
  }, {
    name: 'nonce',
    default: new Buffer('000000000000002a', 'hex') //sha3(42)
  }];

  utils.defineProperties(this, fields, data);
};

/**
 * @method validatePOW
 */
BlockHeader.prototype.validatePOW = function() {
  var raw = this.raw.slice(0, -1),
    i = utils.sha3(rlp.encode(raw)),
    a = Buffer.concat([i, this.nonce]),
    pow = new BN(utils.sha3(a));
  //2^256
  return pow.cmp(utils.TWO_POW256.div(new BN(this.difficulty))) === -1;
};

BlockHeader.prototype.canonicalDifficulty = function(parentBlock) {
  var blockTs = utils.bufferToInt(this.timestamp),
    parentTs = utils.bufferToInt(parentBlock.header.timestamp),
    parentDif = utils.bufferToInt(parentBlock.header.difficulty),
    dif;

  if (blockTs < parentTs + 8) {
    dif = parentDif + Math.floor(parentDif / 1024);
  } else {
    dif = parentDif - Math.floor(parentDif / 1024);
  }
  return dif;
};

//check the block for the canical difficulty
BlockHeader.prototype.validateDifficulty = function(parentBlock) {
  var dif = this.canonicalDifficulty(parentBlock);
  return dif === utils.bufferToInt(this.difficulty);
};

BlockHeader.prototype.canonicalGaslimit = function(parentBlock) {
  var pGasLim = utils.bufferToInt(parentBlock.header.gasLimit),
    pGasUsed = utils.bufferToInt(parentBlock.header.gasUsed),
    gasLimit = Math.floor((1023 * pGasLim + Math.floor(6 / 5 * pGasUsed)) / 1024);

  if (gasLimit < 125000) {
    gasLimit = 125000;
  }
  return gasLimit;
};

BlockHeader.prototype.validateGasLimit = function(parentBlock) {
  var gasLimit = this.canonicalGaslimit(parentBlock);
  return utils.bufferToInt(this.gasLimit) === gasLimit;
};

/**
 * Validates the entire block headers
 * @method validate
 * @param {Blockchain} blockChain the blockchain that this block is validating against
 * @param {Bignum} [height] if this is an uncle header, this is the height of the block that is including it
 * @param {Function} cb the callback function
 */
BlockHeader.prototype.validate = function(blockchain, height, cb) {

  if (arguments.length === 2) {
    cb = height;
    height = false;
  }

  var self = this;

  //find the blocks parent
  blockchain.getBlock(self.parentHash, function(err, parentBlock) {

    self.parentBlock = parentBlock;

    if (height) {
      var dif = height.sub(new BN(parentBlock.header.number));
      if (!(dif.lt(8) && dif.gt(1))) {
        err = 'uncle block has a parent that is too old or to young';
      }
    }

    if (
      //make sure uncles parents are between 1 and 8 blocks back
      self.validateDifficulty(parentBlock) &&
      self.validateGasLimit(parentBlock) &&
      self.validatePOW() &&
      (utils.bufferToInt(self.timestamp) >= utils.bufferToInt(parentBlock.header.timestamp)) &&
      (self.extraData.length < 1024) && !err) {
      cb();
    } else {
      cb('invalid block blockheader');
    }
  });
};

BlockHeader.prototype.hash = function() {
  return utils.sha3(rlp.encode(this.raw));
};
