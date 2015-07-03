/**
 * NOTES
 * block details are child block, parent block and tottal difficulty
 * block details are stored to key  'detail'+<blockhash>
 */

const async = require('async')
const rlp = require('rlp')
const Block = require('./block.js')
const utils = require('ethereumjs-util')

var Blockchain = module.exports = function(db) {
  this.db = db
  this._initDone = false
  this._pendingSaves = []
  this._pendingGets = []
  this._init()
}

/**
 * Fetches the meta info about the blockchain from the db. Meta info contains
 * the hash of the head block and the hash of the genisis block
 * @method _init
 */
Blockchain.prototype._init = function() {
  var self = this

  function onHeadFound() {
    self._initDone = true
      //run the pending save operations
    async.eachSeries(self._pendingSaves, function(ops, cb) {
      self._addBlock(ops[0], function() {
        ops[1]()
        cb()
      })
    }, function() {
      delete self._pendingSaves
    })

    //run the pending getHead
    self._pendingGets.forEach(function(cb) {
      self.getHead(cb)
    })
  }

  this.db.get('meta', {
      valueEncoding: 'json'
    },
    function(err, meta) {
      if (!err && meta) {
        self.meta = meta
        self.genesisHash = meta.genesis
        self.db.get(meta.head,  {
          valueEncoding: 'binary'
        }, function(err, head) {
          if (head)
            self.head = new Block(rlp.decode(head))
          onHeadFound()
        })
      } else {
        self.meta = {}
        onHeadFound()
      }
    })
}

/**
 * Returns that head block
 * @method getHead
 * @param cb Function the callback
 */
Blockchain.prototype.getHead = function(cb) {
  if (!this._initDone)
    this._pendingGets.push(cb)
  else
    cb(null, this.head)
}

/**
 * Adds a block to the blockchain
 * @method addBlock
 * @param {object} block -the block to be added to the block chain
 * @param {function} cb - a callback function
 */
Blockchain.prototype.addBlock = function(block, cb) {
  if (!this._initDone)
    this._pendingSaves.push([block, cb])
  else
    this._addBlock(block, cb)
}

Blockchain.prototype._addBlock = function(block, cb) {
  var self = this
  var blockHash = block.hash().toString('hex')

  if (block.constructor !== Block)
    block = new Block(block)

  if (!self.head)
    this.meta.genesis = blockHash

  async.auto({
    //look up the parent meta info
    parentInfo: function(cb2) {
      //if genesis block
      if (block.isGenisis())
        return cb2()

      self.getDetails(block.header.parentHash.toString('hex'), function(err, pd) {
        if (!err && pd)
          cb2(null, pd)
        else
          cb2('parent hash not found')
      })
    },
    //store the block
    storeBlock: function(cb2) {
      self.db.put(blockHash, block.serialize(), {
        valueEncoding: 'binary'
      }, cb2)
    },
    //update and store the details
    storeParentDetails: ['parentInfo',
      function(cb2, results) {
        //calculate the total difficulty for this block
        var td = utils.bufferToInt(block.header.difficulty)
        var parentDetails = results.parentInfo
        var dbOps = []

        //add this block as a child to the parent's block details
        if (parentDetails)
          td += parentDetails.td

        //store the block details
        var blockDetails = {
          type: 'put',
          key: 'detail' + blockHash,
          valueEncoding: 'json',
          value: {
            parent: block.header.parentHash.toString('hex'),
            td: td,
            number: utils.bufferToInt(block.header.number),
            child: null
          }
        }

        //save the block details
        dbOps.push(blockDetails)

        //store the head block if this block has a bigger difficulty
        //than the prevous block
        if (td > self.meta.td || !self.head) {
          if (parentDetails) {
            parentDetails.child = blockHash

            //save parent details
            dbOps.push({
              type: 'put',
              key: 'detail' + block.header.parentHash.toString('hex'),
              valueEncoding: 'json',
              value: parentDetails
            })
          }

          self.meta.head = blockHash
          self.meta.height = utils.bufferToInt(block.header.number)
          self.meta.td = td

          //update meta
          dbOps.push({
            type: 'put',
            key: 'meta',
            valueEncoding: 'json',
            value: self.meta
          })

          if (self.head)
            self.parentHead = self.head

          self.head = block
        }

        self.db.batch(dbOps, cb2)
      }
    ]
  }, cb)
}

/**
 *Gets a block by its hash
 * @method getBlock
 * @param {String|Buffer} hash - the sha256 hash of the rlp encoding of the block
 * @param {Function} cb - the callback function
 */
Blockchain.prototype.getBlock = function(hash, cb) {
  this.db.get(hash.toString('hex'), {
    valueEncoding: 'binary'
  }, function(err, value) {
    //run callback
    var block
    if (!err)
      block = new Block(rlp.decode(value))

    cb(err, block)
  })
}

/**
 *Gets a block by its number
 * @method getBlockByNumber
 * @param {Number} number
 * @param {Function} cb - the callback function
 */
Blockchain.prototype.getBlockByNumber = function(number, cb) {
  var self = this
  this.db.get(number, function(err, hash) {
    if (err)
      return cb(err)

    self.db.get(hash, function(err, block) {
      //run callback
      var block
      if (!err)
        block = new Block(rlp.decode(value))

      cb(err, block)
    })
  })
}

/**
 * fetches blocks from the db
 * @method getBlocks
 * @param {Array.<Buffer>} hashes
 * @param {Function} cb
 * @return {Array.<Block>}
 */
Blockchain.prototype.getBlocks = function(hashes, cb) {
  var self = this

  async.mapSeries(hashes, function(hash, done) {
    self.getBlock(hash, done)
  }, cb)
}

/**
 * Gets a block by its hash
 * @method getBlockInfo
 * @param {String} hash - the sha256 hash of the rlp encoding of the block
 * @param {Function} cb - the callback function
 */
Blockchain.prototype.getDetails = function(hash, cb) {
  this.db.get('detail' + hash.toString('hex'), {
    valueEncoding: 'json'
  }, cb)
}

/**
 * Gets a block by its hash
 * @method getBlockInfo
 * @param {String} hash - the sha256 hash of the rlp encoding of the block
 * @param {Function} cb - the callback function
 */
Blockchain.prototype.putDetails = function(hash, cb) {
  this.db.put('detail' + hash.toString('hex'), {
    valueEncoding: 'json'
  }, cb)
}

/**
 * Gets a segment of the blockchain given the parent hash and `count `
 * returns the hashes of the blocks
 * @method getBlockChain
 * @param {Buffer} parentHash - an array of parents hashes to start from
 * @param {Interger} count the number of blocks to return
 * @param {Function} cb - the callback which is passed any errors and the blocks
 * @return {Array}
 * The resulting block hashes are ordered newest to oldest.
 */
Blockchain.prototype.getBlockHashes = function(parentHash, count, cb) {
  var self = this

  //find the parent
  self.getDetails(parentHash.toString('hex'), function(err, foundParent) {
    if (foundParent && !err) {
      var hashsFound = []
      if (count > 0) {
        //find the children
        async.whilst(function() {
          return hashsFound.length < count && foundParent.children[0]
        }, function(done) {
          self.getBlockInfo(foundParent.children[0].hash, function(err, value) {
            if (!err) {
              hashsFound.unshift(foundParent.children[0].hash)
              foundParent = value
            }
            done(err)
          })
        }, function(err) {
          cb(err, hashsFound)
        })
      } else if (count < 0) {
        //find the children
        async.whilst(function() {
          return hashsFound.length < -count && foundParent.parent !== utils.zeros(32).toString('hex')
        }, function(done) {
          self.getDetails(foundParent.parent, function(err, value) {
            if (!err) {
              hashsFound.push(foundParent.parent)
              foundParent = value
            }
            done(err)
          })
        }, function(err) {
          cb(err, hashsFound)
        })
      } else {
        //count === 0
        cb(null, null)
      }
    } else {
      //n initail parent found or err finding parent
      cb(err, null)
    }
  })
}


/**
 * Finds `count` number blocks starting with the child of the first found block
 * @method getBlockChain
 * @param {Array} parentHashes - an array of parent hashs, starting with the newest block hash
 * @param {Interger} count - the number of blocks to return
 * @param {Function} cb
 */
Blockchain.prototype.getBlockChain = function(parentHashes, count, cb) {
  //parentHashes should be ordered newest first
  var self = this
  var foundHashes = false
  var foundBlocks = []

  parentHashes = Array.isArray(parentHashes) ? parentHashes : [parentHashes]

  async.whilst(function() {
      return !foundHashes && (parentHashes.length !== 0)
    }, function(done) {
      //try and find one of the parent hashes
      var ph = parentHashes.shift()
      self.getBlockHashes(ph, count, function(err, hashes) {
        if (!err && hashes) {
          foundHashes = hashes
        }
        done()
      })
    },
    function(err) {
      if (foundHashes) {
        async.each(foundHashes, function(hash, done) {
          self.getBlock(hash, function(err, block) {
            if (block) {
              foundBlocks.push(block)
              done(err)
            }
          })
        }, function() {
          cb(err, foundBlocks)
        })
      } else {
        cb('no blocks found', null)
      }
    })
}

/**
 * Given an ordered array, returns to the callback an array of hashes that are
 * not in the blockchain yet
 * @method selectNeededHashes
 * @param {Array} hashes
 * @param {function} cb the callback
 */
Blockchain.prototype.selectNeededHashes = function(hashes, cb) {
  var max, mid, min
  var self = this

  max = hashes.length - 1
  mid = min = 0

  async.whilst(function() {
      return max >= min
    },
    function(cb2) {
      self.getBlockInfo(hashes[mid], function(err, hash) {
        if (!err && hash) {
          min = mid + 1
        } else {
          max = mid - 1
        }

        mid = Math.floor((min + max) / 2)
        cb2()
      })
    },
    function(err) {
      cb(err, hashes.slice(min))
    })
}

Blockchain.prototype.saveLastProcessedBlock = function(block, cb) {
  this.meta.lastProcessed = block.hash().toString('hex')
  this.db.put('meta', {
    valueEncoding: 'json'
  }, this.meta, cb)
}

// builds the chain double link list.
// TODO: eleminate wierd side effects 
Blockchain.prototype._buildBlockChain = function(hash, childHash, cb) {
  var self = this
  var details
  var staleDetails
  var staleHash
  var last

  async.series([
    function getDetails(done) {
      self.getDetails(hash.toString('hex'), function(err, d) {
        details = d
        if (details.mined)
          //reset block mined if we mined past a fork
          self.meta.lastImported = hash

        if (details.child === childHash)
          //short circut async
          return done('complete')

        details.child = childHash
        cb(err)
      })
    },
    function loadNumberIndex(done) {
      self.db.get(details.number, {
        valueEncoding: 'binary'
      }, function(err, blockHash) {
        staleHash = blockHash
        cb(err)
      })
    },
    function saveNumberIndex(done) {
      self.db.put(details.number, hash, done)
    },
    function saveDetails(done) {
      self.setDetails(hash, details, {
        valueEncoding: 'json'
      }, done.bind(this, null, details))
    },
    function loadStaleDetails(done) {
      self.getDetails(staleHash, function(err, d) {
        staleDetails = d
        staleDetails.child = null
        done(err)
      })
    },
    function saveStaleDetails(done) {
      self.setDetails(staleHash, staleDetails, done)
    },
  ], function(err) {
    if (err === 'complete')
      return cb(null)
    else if (err)
      return cb(err)

    self._buildUnprocessedBlockChain(details.parentHash, hash, cb)
  })
}

//TODO mover these functions to an overlay
//startNumber is the next block Number to processes
Blockchain.prototype.setMined = function(hash, cb) {
  var self = this
  this.getDetails(hash, function(err, details) {
    details.lastImported = true
    self.detailsDB.put(hash, details, cb)
  })
}
