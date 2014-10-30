const rlp = require('rlp'),
  SHA3 = require('sha3'),
  utils = require('./utils.js'),
  bignum = require('bignum');

/**
 * Represents a Block Header
 * @constructor
 * @param {Array} data raw data, deserialized
 */
var BlockHeader = module.exports = function(data) {
  var self = this,
    fields = [{
        name: 'parentHash',
        length: 32
      },
      'uncleHash', {
        name: 'coinbase',
        length: 20
      }, {
        name: 'stateRoot',
        length: 32
      },
      'transactionsTrie',
      'receiptTrie',
      'bloom',
      'difficulty',
      'number',
      'minGasPrice',
      'gasLimit',
      'gasUsed',
      'timestamp',
      'extraData', {
        name: 'nonce',
        length: 32
      }
    ];

  this.raw = [];

  if (!data || data.length === 0) {
    //set defaults
    this.raw = [
      utils.zeros(32), //parent
      utils.emptyHash(), //uncles
      utils.zeros(20), //coinbase
      utils.zeros(32), //state root
      utils.emptyRlpHash(), //trasacntionsTrie Root
      utils.emptyRlpHash(), //RecieptTrie Root
      utils.zeros(64), //bloom
      new Buffer('020000', 'hex'), //difficulty
      new Buffer([0]), //number
      new Buffer([0]), //minGasPrice
      utils.intToBuffer(1000000), //gasLimit
      new Buffer([0]), //gasUsed
      new Buffer([0]), //timestamp
      new Buffer([0]), //extraData
      utils.sha3(new Buffer([42])) //nonce
    ];
  } else {
    //make sure all the items are buffers
    data.forEach(function(d, i) {
      self.raw[i] = typeof d === 'string' ? new Buffer(d, 'hex') : d;
    });
  }

  utils.validate(fields, this.raw);
  utils.defineProperties(this, fields);
};

BlockHeader.prototype.validatePOW = function() {
  var raw = this.raw.slice(0, -1),
    hash = new SHA3.SHA3Hash(256),
    hash2 = new SHA3.SHA3Hash(256);

  hash.update(rlp.encode(raw));
  var i = new Buffer(hash.digest('hex'), 'hex');
  var a = Buffer.concat([i, this.raw[12]]);
  hash2.update(a);

  var pow = bignum(hash2.digest('hex'), 16);

  //2^256
  var twoPow256 = '115792089237316195423570985008687907853269984665640564039457584007913129639936';
  return pow.lt(bignum(twoPow256).div(bignum.fromBuffer(this.difficulty)));
};

BlockHeader.prototype.canonicalDifficulty = function(parentBlock) {
  var blockTs = utils.bufferToInt(this.timestamp),
    parentTs = utils.bufferToInt(parentBlock.header.timestamp),
    parentDif = utils.bufferToInt(parentBlock.header.difficulty),
    dif;

  if (blockTs < parentTs + 5) {
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
      var dif = height.sub(bignum.fromBuffer(parentBlock.header.number));
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
      cb('invalid block');
    }
  });

};

BlockHeader.prototype.hash = function() {
  var hash = new SHA3.SHA3Hash(256);
  hash.update(rlp.encode(this.raw));
  return new Buffer(hash.digest('hex'), 'hex');
};
