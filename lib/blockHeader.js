const rlp = require('rlp')
const utils = require('ethereumjs-util')
const BN = require('bn.js')
const params = require('ethereum-common').fees 
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
    noZero: true,
    default: new Buffer([])
  }, {
    name: 'gasLimit',
    default: new Buffer('2fefd8', 'hex')
  }, {
    name: 'gasUsed',
    noZero: true,
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
    name: 'mixHash',
    default: utils.zeros(32)
      //length: 32
  }, {
    name: 'nonce',
    default: new Buffer('000000000000002a', 'hex') //sha3(42)
  }]

  utils.defineProperties(this, fields, data)
}

/**
 * @method validatePOW
 */
BlockHeader.prototype.validatePOW = function() {
  // var raw = this.raw.slice(0, -1),
  //   i = utils.sha3(rlp.encode(raw)),
  //   a = Buffer.concat([i, this.nonce]),
  //   pow = new BN(utils.sha3(a))
  // //2^256
  // return pow.cmp(utils.TWO_POW256.div(new BN(this.difficulty))) === -1
}

BlockHeader.prototype.canonicalDifficulty = function(parentBlock) {
  const blockTs = utils.bufferToInt(this.timestamp)
  const parentTs = utils.bufferToInt(parentBlock.header.timestamp)
  const parentDif = utils.bufferToInt(parentBlock.header.difficulty)
  
  var dif

  if (blockTs < parentTs + params.durationLimit.v) 
    dif = parentDif + Math.floor(parentDif / params.gasLimitBoundDivisor.v)
  else 
    dif = Math.max(parentDif,  utils.bufferToInt(this.difficulty))

  return dif
}

//check the block for the canical difficulty
BlockHeader.prototype.validateDifficulty = function(parentBlock) {
  const dif = this.canonicalDifficulty(parentBlock)
  return dif === utils.bufferToInt(this.difficulty)
}

BlockHeader.prototype.validateGasLimit = function(parentBlock) {
  const pGasLimit = utils.bufferToInt(parentBlock.header.gasLimit)
  const gasLimit = utils.bufferToInt(this.gasLimit)
  const a = Math.floor(pGasLimit / params.gasLimitBoundDivisor.v)
  const maxGasLimit = pGasLimit + a
  const minGasLimit = pGasLimit - a

  return maxGasLimit > gasLimit && minGasLimit < gasLimit && params.minGasLimit.v < gasLimit;
}

/**
 * Validates the entire block headers
 * @method validate
 * @param {Blockchain} blockChain the blockchain that this block is validating against
 * @param {Bignum} [height] if this is an uncle header, this is the height of the block that is including it
 * @param {Function} cb the callback function
 */
BlockHeader.prototype.validate = function(blockchain, height, cb) {

  if (arguments.length === 2) {
    cb = height
    height = false
  }

  var self = this

  //find the blocks parent
  blockchain.getBlock(self.parentHash, function(err, parentBlock) {

    self.parentBlock = parentBlock

    if (height) {
      var dif = height.sub(new BN(parentBlock.header.number))
      if (!(dif.lt(8) && dif.gt(1))) {
        err = 'uncle block has a parent that is too old or to young'
      }
    }

    if (
      //make sure uncles parents are between 1 and 8 blocks back
      self.validateDifficulty(parentBlock) &&
      self.validateGasLimit(parentBlock) &&
      self.validatePOW() &&
      (utils.bufferToInt(self.timestamp) >= utils.bufferToInt(parentBlock.header.timestamp)) &&
      (self.extraData.length < 1024) && !err) {
      cb()
    } else {
      cb('invalid block blockheader')
    }
  })
}

BlockHeader.prototype.hash = function() {
  return utils.sha3(rlp.encode(this.raw))
}
