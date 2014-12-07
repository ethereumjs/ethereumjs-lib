const async = require('async'),
  bignum = require('bignum'),
  rlp = require('rlp'),
  Account = require('../account'),
  fees = require('../fees.js'),
  opcodes = require('./opcodes.js'),
  utils = require('../utils.js'),
  constants = require('./constants.js');

const ERROR = constants.ERROR;

function castAddress(add) {
  if (add && add.length > 20) {
    add = add.slice(add.length - 20);
  }

  return add;
}

/**
 * Runs EVM code
 * @param {object} opts
 * @param {Block} opts.block the block that the transaction is part of
 * @param {Buffer} opts.gasLimit
 * @param {Account} opts.account the account that the exucuting code belongs to
 * @param {Buffer} opts.address the address of the account that is exucuting this code
 * @param {Buffer} opts.origin the address where the call originated from
 * @param {Buffer} opts.from the address that ran this code
 * @param {Buffer} opts.data the input data
 * @param {Function} cb
 */
module.exports = function(opts, cb) {
  var self = this,
    returnValue = new Buffer([]),
    stopped = false,
    suicide = false,
    vmError = false,
    suicideTo, //the to address for the remainding balance
    pc = 0, //programm counter
    op, //the raw op code
    opcode, // the opcode
    gasLeft = bignum(opts.gasLimit), //how much gas we have left
    memory = [], //memory
    wordsInMem = 0, //the number of btyes stored in memory
    stack = [], //The stack of ops
    depth = 0, //call depth
    jumpTarget, // array of valid destinations for jumps
    logs = [];

  this.trie.checkpoint();
  var storageTrie = this.trie.copy();

  /**
   * Subtracts the amount need for memory usage from `gasLeft`
   * @method subMemUsage
   * @param {Number} offset
   * @param {Number} length
   * @return {String}
   */
  function subMemUsage(offset, length) {
    // Poc6 zero-size memory reads/writes do not lead to a size increase for fee purposes
    if (!length) {
      return undefined;
    }

    var newWords = Math.max(wordsInMem, Math.ceil((offset + length) / 32));

    gasLeft = gasLeft.sub(newWords - wordsInMem);
    if (gasLeft.lt(0)) {
      return ERROR.OUT_OF_GAS;
    }
    wordsInMem = newWords;
  }

  /**
   * Loads bytes from memory and returns them as a buffer. If an error occurs
   * a string is instead returned. The function also subtracts the amount of
   * gas need for memory expansion.
   * @method memLoad
   * @param {Number} offset where to start reading from
   * @param {Number} length how far to read
   * @return {Buffer|String}
   */
  function memLoad(offset, length) {
    //check to see if we have enougth gas for the mem read
    var err = subMemUsage(offset, length);

    if (err) return err;

    var loaded = memory.slice(offset, offset + length);

    //fill the remaining lenth with zeros
    for (var i = loaded.length; i < length; i++) {
      loaded.push(0);
    }

    return new Buffer(loaded);
  }

  /**
   * Stores bytes to memory. If an error occurs a string is instead returned.
   * The function also subtracts the amount of gas need for memory expansion.
   * @method memLoad
   * @param {Number} offset where to start reading from
   * @param {Number} length how far to read
   * @return {Buffer|String}
   */
  function memStore(offset, val) {

    var err = subMemUsage(offset, val.length);

    if (err) return err;

    for (var i = 0; i < val.length; i++) {
      memory[offset + i] = val[i];
    }
  }

  //load the current account
  function loadAccount(done) {
    self.trie.get(opts.address, function(err, raw) {
      opts.account = new Account(raw);
      if (opts.account.stateRoot.toString('hex') === utils.emptyRlpHash().toString('hex')) {
        storageTrie.root = null;
      } else if (opts.account.stateRoot.length !== 32) {
        storageTrie.root = null;
      } else {
        storageTrie.root = opts.account.stateRoot;
      }
      done(err);
    });
  }


  /**
   * preprocessJumps sets the jumpTarget array of valid jump destinations
   * (i) Cannot jump onto a jump
   * (ii) If a jump is preceded by a push, no jumpdest required
   * (iii) jump must be directly onto JUMPDEST
   * (iv) no destinations into the middle of PUSH
   */
  function preprocessJumps() {
    var i = 0,
      currOp,
      lenPush,
      pushData,
      jumpSet = {};

    for (i = 0; i < opts.code.length; i++) {
      currOp = opts.code[i];
      if (opcodes[currOp] === 'JUMPDEST') {
        jumpSet[i] = true;
      } else if (currOp >= 0x60 && currOp <= 0x7f) { // check in range [PUSH1, PUSH32]
        lenPush = currOp - 0x60 + 1;
        pushData = opts.code.slice(i + 1, i + 1 + lenPush);
        i += lenPush;

        currOp = opts.code[i + 1]; // this is the op after the pushed data
        if (opcodes[currOp] === 'JUMP' || opcodes[currOp] === 'JUMPI') {
          jumpSet[pushData[0]] = true;
        }
      }
    }
    jumpTarget = Object.keys(jumpSet).map(function(x) {
      return parseInt(x, 10);
    });
  }

  function makeCall(callOptions, localOpts, done) {
    var err = null;

    callOptions.fromAccount = opts.account;
    callOptions.from = opts.address;
    callOptions.origin = opts.origin;
    callOptions.gasPrice = opts.gasPrice;
    callOptions.block = opts.block;

    //increamnet the depth
    callOptions.depth = depth + 1;
    //calculates the gase need for reading the input from memory
    callOptions.data = memLoad(localOpts.inOffset, localOpts.inLength);

    //calculates the gas need for saving the output in memory
    if (localOpts.outLength) {
      err = subMemUsage(localOpts.outOffset, localOpts.outLength);
    }

    if (depth > constants.MAX_CALL_DEPTH || gasLeft.lt(callOptions.gas) || err === ERROR.OUT_OF_GAS || callOptions.data === ERROR.OUT_OF_GAS) {
      done(ERROR.OUT_OF_GAS);
      return;
    }

    //does this account have enought ether?
    if (bignum.fromBuffer(opts.account.balance).lt(callOptions.value)) {
      stack.push(new Buffer([0]));
      done();
    } else {

      //if creating a new contract then increament the nonce
      if (!callOptions.to) {
        opts.account.nonce = bignum.fromBuffer(opts.account.nonce).add(1).toBuffer();
      }

      self.runCall(callOptions, function(err, results) {
        if (err) {
          done(err);
          return;
        }
        //save results to memory
        if (results.vm.returnValue) {
          for (var i = 0; i < localOpts.outLength; i++) {
            memory[localOpts.outOffset + i] = results.vm.returnValue[i];
          }
        }

        gasLeft = gasLeft.sub(results.gasUsed);
        if (results.createdAddress) {
          stack.push(results.createdAddress);
        } else {
          stack.push(new Buffer([results.vm.exception]));
        }

        loadAccount(done);
      });
    }
  }

  //set defaults
  if (!opts.origin) {
    opts.origin = opts.from;
  }

  if (!opts.data) {
    opts.data = new Buffer([0]);
  }

  if (!opts.value) {
    opts.value = new Buffer([0]);
  }

  if (opts.depth) {
    depth = opts.depth;
  }

  //define the opcode functions
  var opFuncs = {
    STOP: [0,
      function(done) {
        stopped = true;
        done();
      }
    ],
    ADD: [2,
      function(done) {
        stack.push(
          utils.modTT256(
            bignum.fromBuffer(stack.pop())
            .add(bignum.fromBuffer(stack.pop())))
          .toBuffer()
        );
        done();
      }
    ],
    MUL: [2,
      function(done) {
        stack.push(
          utils.modTT256(
            bignum.fromBuffer(stack.pop())
            .mul(bignum.fromBuffer(stack.pop())))
          .toBuffer()
        );
        done();
      }
    ],
    SUB: [2,
      function(done) {
        stack.push(
          utils.modTT256(
            bignum.fromBuffer(stack.pop())
            .sub(bignum.fromBuffer(stack.pop())))
          .toBuffer()
        );
        done();
      }
    ],
    DIV: [2,
      function(done) {
        stack.push(
          bignum.fromBuffer(stack.pop())
          .div(bignum.fromBuffer(stack.pop()))
          .toBuffer()
        );
        done();
      }
    ],
    SDIV: [2,
      function(done) {
        stack.push(
          utils.modTT256(
            utils.fromSigned(bignum.fromBuffer(stack.pop()))
            .div(utils.fromSigned(
              bignum.fromBuffer(stack.pop())
            ))
          ).toBuffer()
        );
        done();
      }
    ],
    MOD: [2,
      function(done) {
        stack.push(
          bignum.fromBuffer(stack.pop())
          .mod(bignum.fromBuffer(stack.pop()))
          .toBuffer()
        );
        done();
      }
    ],
    SMOD: [2,
      function(done) {
        stack.push(
          utils.modTT256(
            utils.fromSigned(bignum.fromBuffer(stack.pop()))
            .mod(utils.fromSigned(
              bignum.fromBuffer(stack.pop())
            ))
          ).toBuffer()
        );
        done();
      }
    ],
    ADDMOD: [3,
      function(done) {
        stack.push(
          utils.mod(
            bignum.fromBuffer(stack.pop())
            .add(bignum.fromBuffer(stack.pop())), bignum.fromBuffer(stack.pop()))
          .toBuffer()
        );
        done();
      }
    ],
    MULMOD: [3,
      function(done) {
        stack.push(
          utils.mod(
            bignum.fromBuffer(stack.pop())
            .mul(bignum.fromBuffer(stack.pop())), bignum.fromBuffer(stack.pop()))
          .toBuffer()
        );
        done();
      }
    ],
    EXP: [2,
      function(done) {
        var base = stack.pop();
        var exponent =  utils.unpad(stack.pop());

        if(exponent[0] !== 0 ){
          gasLeft = gasLeft.sub(exponent.length);
        }

        stack.push(
          bignum.fromBuffer(base)
          .powm(bignum.fromBuffer(exponent), bignum(2).shiftLeft(256))
          .toBuffer()
        );
        done();
      }
    ],
    SIGNEXTEND: [2,
      function(done) {
        var k = bignum.fromBuffer(stack.pop()),
          val,
          extendOnes = false,
          i;

        if (k.le(31)) {
          val = utils.pad256(stack.pop());

          if (val[31 - k] & 0x80) {
            extendOnes = true;
          }

          for (i = 31 - k - 1; i >= 0; i--) { // note 31-k-1 since kth byte shouldn't be modified
            val[i] = extendOnes ? 0xff : 0;
          }

          stack.push(val);
        }

        done();
      }
    ],
    //0x10 range - bit ops
    LT: [2,
      function(done) {
        stack.push(
          new Buffer([
            bignum.fromBuffer(stack.pop())
            .lt(bignum.fromBuffer(stack.pop()))
          ])
        );
        done();
      }
    ],
    GT: [2,
      function(done) {
        stack.push(
          new Buffer([
            bignum.fromBuffer(stack.pop())
            .gt(bignum.fromBuffer(stack.pop()))
          ])
        );
        done();
      }
    ],
    SLT: [2,
      function(done) {
        stack.push(
          new Buffer([
            utils.fromSigned(bignum.fromBuffer(stack.pop()))
            .lt(utils.fromSigned(bignum.fromBuffer(stack.pop())))
          ])
        );
        done();
      }
    ],
    SGT: [2,
      function(done) {
        stack.push(
          new Buffer([
            utils.fromSigned(bignum.fromBuffer(stack.pop()))
            .gt(utils.fromSigned(bignum.fromBuffer(stack.pop())))
          ])
        );
        done();
      }
    ],
    EQ: [2,
      function(done) {
        var a = utils.unpad(stack.pop()),
          b = utils.unpad(stack.pop());

        stack.push(
          new Buffer([a.toString('hex') === b.toString('hex')])
        );
        done();
      }
    ],
    ISZERO: [1,
      function(done) {
        var i = utils.bufferToInt(stack.pop());
        stack.push(new Buffer([!i]));
        done();
      }
    ],
    AND: [2,
      function(done) {
        stack.push(
          (
            bignum.fromBuffer(stack.pop())
            .and(
              bignum.fromBuffer(stack.pop())
            )
          )
          .toBuffer()
        );
        done();
      }
    ],
    OR: [2,
      function(done) {
        stack.push(
          (
            bignum.fromBuffer(stack.pop())
            .or(
              bignum.fromBuffer(stack.pop())
            )
          )
          .toBuffer()
        );
        done();
      }
    ],
    XOR: [2,
      function(done) {
        stack.push(
          (
            bignum.fromBuffer(stack.pop())
            .xor(
              bignum.fromBuffer(stack.pop())
            )
          )
          .toBuffer()
        );
        done();
      }
    ],
    // TODO
    NOT: [1,
      function(done) {
        stack.push(
          utils.TWO_POW256.sub(1).sub(bignum.fromBuffer(stack.pop()))
          .toBuffer()
        );
        done();
      }
    ],
    BYTE: [2,
      function(done) {
        var pos = utils.bufferToInt(stack.pop()),
          word,
          byte;

        if (pos < 32) {
          word = utils.pad256(stack.pop());
          byte = utils.intToBuffer(word[pos]);
        } else {
          byte = new Buffer([0]);
        }

        stack.push(byte);
        done();
      }
    ],
    //0x20 range - crypto
    SHA3: [2,
      function(done) {
        var offset = utils.bufferToInt(stack.pop()),
          length = utils.bufferToInt(stack.pop()),
          data = memLoad(offset, length);

        if (data === ERROR.OUT_OF_GAS) {
          done(ERROR.OUT_OF_GAS);
          return;
        }

        stack.push(utils.sha3(data));
        done();
      }
    ],
    //0x30 range - closure state
    ADDRESS: [0,
      function(done) {
        stack.push(opts.address);
        done();
      }
    ],
    BALANCE: [0,
      function(done) {
        var address = stack.pop();
        self.trie.get(address, function(err, raw) {
          var account = new Account(raw);
          stack.push(account.balance);
          done(err);
        });
      }
    ],
    ORIGIN: [0,
      function(done) {
        stack.push(opts.origin);
        done();
      }
    ],
    CALLER: [0,
      function(done) {
        stack.push(opts.from);
        done();
      }
    ],
    CALLVALUE: [0,
      function(done) {
        stack.push(opts.value);
        done();
      }
    ],
    CALLDATALOAD: [1,
      function(done) {
        var pos = utils.bufferToInt(stack.pop()),
          loaded = opts.data.slice(pos, pos + 32);

        loaded = loaded.length ? loaded : new Buffer([0]);

        //pad end
        if (loaded.length < 32) {
          var dif = 32 - loaded.length;
          var pad = new Buffer(dif);
          pad.fill(0);
          loaded = Buffer.concat([loaded, pad], 32);
        }

        stack.push(loaded);
        done();
      }
    ],
    CALLDATASIZE: [0,
      function(done) {
        if (opts.data.length === 1 && opts.data[0] === 0) {
          stack.push(new Buffer([0]));
        } else {
          stack.push(bignum(opts.data.length).toBuffer());
        }
        done();
      }
    ],
    CALLDATACOPY: [3,
      function(done) {
        var memOffset = utils.bufferToInt(stack.pop());
        var dataOffsetBuf = stack.pop();
        var dataLength = utils.bufferToInt(stack.pop());

        var dataOffset  = utils.bufferToInt(dataOffsetBuf);
        var callData;

        //hacky: if the dataOffset is larger than the largest safeInt then just
        //load 0's because if tx.data did have that amount of data then the fee
        //would be high than the maxGasLimit in the block 
        if(dataOffset > 9007199254740991){
          callData = new Buffer(dataLength);
          callData.fill(0);
        }else{
          callData = opts.data.slice(dataOffset, dataOffset + dataLength);
        }

        //sub the COPY fee
        gasLeft = gasLeft.sub(Math.ceil(dataLength / 32));
        var err = memStore(memOffset, callData );

        done(err);
      }
    ],
    CODESIZE: [0,
      function(done) {
        stack.push(bignum(opts.code.length).toBuffer());
        done();
      }
    ],
    CODECOPY: [3,
      function(done) {
        var memOffset = utils.bufferToInt(stack.pop()),
          codeOffset = utils.bufferToInt(stack.pop()),
          length = utils.bufferToInt(stack.pop());

        //sub the COPY fee
        gasLeft = gasLeft.sub(Math.ceil(length / 32));
        var err = memStore(memOffset, opts.code.slice(codeOffset, codeOffset + length));

        done(err);
      }
    ],
    EXTCODESIZE: [1,
      function(done) {
        var address = castAddress(stack.pop());
        self.trie.get(address, function(err, raw) {
          if (raw) {
            var account = new Account(raw);

            if (account.codeHash.length === 32) {
              self.trie.db.get(account.codeHash, {
                encoding: 'binary'
              }, function(err, code) {
                code = err ? new Buffer([0]) : code;

                stack.push(utils.intToBuffer(code.length));
                done();
              });
            } else {
              stack.push(new Buffer([0]));
              done();
            }

          } else {
            //no code
            stack.push(new Buffer([0]));
            done(err);
          }
        });
      }
    ],
    EXTCODECOPY: [4,
      function(done) {

        var address = castAddress(stack.pop()),
          memOffset = utils.bufferToInt(stack.pop()),
          codeOffset = utils.bufferToInt(stack.pop()),
          length = utils.bufferToInt(stack.pop());

        self.trie.get(address, function(err, raw) {
          if (raw) {
            var account = new Account(raw);

            if (account.codeHash.length === 32) {
              self.trie.db.get(account.codeHash, {
                encoding: 'binary'
              }, function(err, code) {

                code = err ? new Buffer([0]) : code;

                //sub the COPY fee
                gasLeft = gasLeft.sub(Math.ceil(length / 32));
                err = memStore(memOffset, code.slice(codeOffset, codeOffset + length));
                done(err);
              });
            } else {
              stack.push(new Buffer([0]));
              done();
            }
          } else {
            //no code
            done(err);
          }
        });
      }
    ],
    GASPRICE: [0,
      function(done) {
        stack.push(opts.gasPrice);
        done();
      }
    ],
    //'0x40' range - block operations
    PREVHASH: [0,
      function(done) {
        stack.push(opts.block.header.parentHash);
        done();
      }
    ],
    COINBASE: [0,
      function(done) {
        stack.push(opts.block.header.coinbase);
        done();
      }
    ],
    TIMESTAMP: [0,
      function(done) {
        stack.push(opts.block.header.timestamp);
        done();
      }
    ],
    NUMBER: [0,
      function(done) {
        stack.push(opts.block.header.number);
        done();
      }
    ],
    DIFFICULTY: [0,
      function(done) {
        stack.push(opts.block.header.difficulty);
        done();
      }
    ],
    GASLIMIT: [0,
      function(done) {
        stack.push(opts.block.header.gasLimit);
        done();
      }
    ],

    //0x50 range - 'storage' and execution
    POP: [1,
      function(done) {
        stack.pop();
        done();
      }
    ],
    MLOAD: [1,
      function(done) {
        var pos = utils.bufferToInt(stack.pop()),
          loaded = utils.unpad(memLoad(pos, 32));

        stack.push(loaded);
        done();

      }
    ],
    MSTORE: [2,
      function(done) {
        var offset = utils.bufferToInt(stack.pop()),
          word = utils.pad256(stack.pop()),
          err = memStore(offset, word);

        if (err) {
          done(err);
          return;
        }
        done();
      }
    ],
    MSTORE8: [2,
      function(done) {
        var offset = utils.bufferToInt(stack.pop());
        var byte = stack.pop();
        //mod 256
        byte = byte.slice(byte.length - 1);
        memStore(offset, byte);

        done();
      }
    ],
    SLOAD: [1,
      function(done) {
        var key = utils.pad256(stack.pop());

        storageTrie.get(key, function(err, val) {
          var loaded = rlp.decode(val);

          loaded = loaded.length ? loaded : new Buffer([0]);
          stack.push(loaded);
          done(err);
        });
      }
    ],
    SSTORE: [2,
      function(done) {
        //memory.store(stack.pop(), stack.pop());
        var key = utils.pad256(stack.pop()),
          val = utils.unpad(stack.pop());

        // TODO: doesn't seem to be needed. if needed, probably should use bignum
        //       eg val = bignum(val.slice(2), 16).toBuffer();
        // if zero just make zero
        // if (!parseInt(val.toString('hex'), 16)) {
        //   val = new Buffer([0]);
        // }

        storageTrie.get(key, function(err, found) {
          if (val.toString('hex') === '00') {
            //deleting a value
            gasLeft = gasLeft.add(200); // net is 0 here but will be adjusted further below
            val = '';
          } else {
            val = rlp.encode(val);
          }

          if (!found) {
            //creating a new value
            gasLeft = gasLeft.sub(100); // net is -300, but if val was 00 net will be -100
          } else {
            gasLeft = gasLeft.add(100); // net is -100, but if val was 00 net will be +100
          }

          storageTrie.put(key, val, function(err2) {
            //update the stateRoot on the account
            opts.account.stateRoot = storageTrie.root;
            done(err || err2);
          });
        });
      }
    ],
    JUMP: [1,
      function(done) {
        pc = utils.bufferToInt(stack.pop());

        var err;
        if (jumpTarget.indexOf(pc) === -1) {
          err = ERROR.INVALID_JUMP;
        }

        done(err);
      }
    ],
    JUMPI: [2,
      function(done) {
        var c = utils.bufferToInt(stack.pop()),
          i = utils.bufferToInt(stack.pop());

        pc = i ? c : pc;

        var err;
        if (i && jumpTarget.indexOf(pc) === -1) {
          err = ERROR.INVALID_JUMP;
        }

        done(err);
      }
    ],
    PC: [0,
      function(done) {
        stack.push(bignum(pc - 1).toBuffer());
        done();
      }
    ],
    MSIZE: [0,
      function(done) {
        stack.push(bignum(wordsInMem * 32).toBuffer());
        done();
      }
    ],
    GAS: [0,
      function(done) {
        stack.push(gasLeft.toBuffer());
        done();
      }
    ],
    JUMPDEST: [0,
      function(done) {
        done();
      }
    ],

    PUSH: [0,
      function(done) {
        var numToPush = op - 0x5f,
          loaded = utils.unpad(opts.code.slice(pc, pc + numToPush));

        stack.push(loaded);
        pc += numToPush;
        done();
      }
    ],
    DUP: [0,
      function(done) {
        var stackPos = op - 0x7f;

        if(stackPos > stack.length){
          done(ERROR.STACK_UNDERFLOW);
          return;
        }

        stack.push(stack[stack.length - stackPos]);
        done();
      }
    ],
    SWAP: [2,
      function(done) {
        var stackPos = op - 0x8f;

        //check the stack to make sure we have enough items on teh stack
        var swapIndex = stack.length - stackPos - 1;
        if (swapIndex < 0) {
          done(ERROR.STACK_UNDERFLOW);
          return;
        }

        //preform the swap
        var newTop = stack[swapIndex];
        stack[swapIndex] = stack.pop();
        stack.push(newTop);
        done();
      }
    ],
    LOG: [2, function(done) {

      var memOffset = utils.bufferToInt(stack.pop());
      var memLength = utils.bufferToInt(stack.pop());
      var numOfTopics = op - 0xa0;
      var mem = memLoad(memOffset, memLength);

      gasLeft = gasLeft.sub(numOfTopics * 32 + memLength);

      //add address
      var log = [opts.address];

      //add topics
      var topics = [];
      for (var i = 0; i < numOfTopics; i++) {
        topics.push(utils.pad256(stack.pop()));
      }

      log.push(topics);

      //add data
      log.push(mem);
      logs.push(log);

      done();
    }],

    //'0xf0' range - closures
    CREATE: [3,
      function(done) {
        //incerment the nonce

        //set up the option
        var value = bignum.fromBuffer(stack.pop()),
          offset = utils.bufferToInt(stack.pop()),
          length = utils.bufferToInt(stack.pop()),
          options = {
            gas: gasLeft,
            value: value
          },
          localOpts = {
            inOffset: offset,
            inLength: length
          };

        makeCall(options, localOpts, done);
      }
    ],
    CALL: [7,
      function(done) {
        var gas = bignum.fromBuffer(stack.pop()),
          to = utils.pad160(stack.pop()),
          value = bignum.fromBuffer(stack.pop()),
          inOffset = utils.bufferToInt(stack.pop()),
          inLength = utils.bufferToInt(stack.pop()),
          outOffset = utils.bufferToInt(stack.pop()),
          outLength = utils.bufferToInt(stack.pop()),
          data = memLoad(inOffset, inLength),
          options = {
            gas: gas,
            value: value,
            to: to,
            data: data
          },
          localOpts = {
            inOffset: inOffset,
            inLength: inLength,
            outOffset: outOffset,
            outLength: outLength
          };

        makeCall(options, localOpts, done);
      }
    ],
    CALLCODE: [7,
      function(done) {
        var gas = bignum.fromBuffer(stack.pop()),
          to = utils.pad160(stack.pop());

        stack.pop();

        var inOffset = utils.bufferToInt(stack.pop()),
          inLength = utils.bufferToInt(stack.pop()),
          outOffset = utils.bufferToInt(stack.pop()),
          outLength = utils.bufferToInt(stack.pop()),
          data = memLoad(inOffset, inLength),
          options = {
            gas: gas,
            value: bignum(0),
            to: opts.address,
            data: data
          },
          localOpts = {
            inOffset: inOffset,
            inLength: inLength,
            outOffset: outOffset,
            outLength: outLength
          };

        //load the code
        self.trie.get(to, function(err, raw) {
          if (!err && raw) {
            var account = new Account(raw);
            account.getCode(self.trie, function(err, code) {
              if (err) {
                done(err);
                return;
              }
              options.code = code;
              makeCall(options, localOpts, done);
            });
          } else {
            done(err);
          }
        });
      }
    ],
    RETURN: [2,
      function(done) {
        var offset = utils.bufferToInt(stack.pop()),
          length = utils.bufferToInt(stack.pop());

        returnValue = memLoad(offset, length);
        stopped = true;
        done();
      }
    ],
    //'0x70', range - other
    SUICIDE: [0,
      function(done) {
        suicide = true;
        suicideTo = utils.pad160(stack.pop());
        done();
      }
    ]
  };

  storageTrie.root = opts.account.stateRoot.toString('hex') === utils.emptyRlpHash().toString('hex') ? null : opts.account.stateRoot;

  preprocessJumps();

  //iterate throught the give ops untill something breaks or we hit STOP
  async.whilst(function() {

    if (gasLeft.lt(0)) {
      vmError = ERROR.OUT_OF_GAS;
      return false;
    }

    return !stopped && !suicide && pc < opts.code.length;

  }, function(done) {

    op = opts.code[pc];
    opcode = opcodes[op];

    if (!opcode) {
      done(ERROR.INVALID_OPCODE);
      return;
    }

    //get fee, decrment gas left
    var fee = fees.getFee(opcode);


    async.series([
      //run the onStep hook
      function(done2) {
        if (self.onStep) {
          self.onStep({
              pc: pc,
              gasLeft: gasLeft,
              opcode: opcode,
              storageTrie: storageTrie,
              stack: stack,
              depth: depth
            },
            done2);
        } else {
          done2();
        }
      },
      //run the opcode
      function(done2) {

        gasLeft = gasLeft.sub(fee);
        pc++;

        var opFunc = opFuncs[opcode];

        //check for stack underflows
        if(stack.length < opFunc[0]) {
          done2(ERROR.STACK_UNDERFLOW);
          return;
        }

        opFunc[1](done2);
      }
    ], function(err) {
      //gets ride of recursion in async.whilst for opFunc that are not async.
      setImmediate(done.bind(done, err));
    });

  }, function(err) {

    err = vmError ? vmError : err;

    //remove any logs on error
    if (err) {
      logs = [];
    }

    var results = {
      suicide: suicide,
      suicideTo: suicideTo,
      account: opts.account,
      exception: err ? 0 : 1,
      exceptionErr: err,
      logs: logs,
      returnValue: returnValue
    };

    cb = cb.bind(this, err, results);

    //revert the state if there's ANY error
    if (err) {
      results.gasUsed = opts.gasLimit;
      self.trie.revert(cb);
    } else {
      results.gasUsed = bignum(opts.gasLimit).sub(gasLeft);
      self.trie.commit(cb);
    }
  });
};
