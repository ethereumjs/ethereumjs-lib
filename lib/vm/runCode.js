const async = require('async');
const bignum = require('bignum');
const rlp = require('rlp');
const Account = require('../account');
const fees = require('../fees.js');
const opcodes = require('./opcodes.js');
const utils = require('ethereumjs-util');
const constants = require('./constants.js');
const setImmediate = require('timers').setImmediate;

const ERROR = constants.ERROR;

/**
 * Runs EVM code
 * @param opts
 * @param opts.account {Account} the account that the exucuting code belongs to
 * @param opts.address {Buffer}  the address of the account that is exucuting this code
 * @param opts.block {Block} the block that the transaction is part of
 * @param opts.blockchain {Blockchain} needed for BLOCKHASH
 * @param opts.bloom {Buffer}
 * @param opts.caller {Buffer} the address that ran this code
 * @param opts.data {Buffer}  the input data
 * @param opts.gasLimit {Buffer}
 * @param opts.origin {Buffer} the address where the call originated from
 * @param cb {Function}
 */
module.exports = function(opts, cb) {
  var self = this;
  var returnValue = new Buffer([]);
  var stopped = false;
  var suicide = false;
  var vmError = false;
  var suicideTo; //the to address for the remainding balance
  var pc = 0; //programm counter
  var op; //the raw op code
  var opcode; // the opcode
  var gasLeft = bignum(opts.gasLimit); //how much gas we have left
  var memory = []; //memory
  var wordsInMem = 0; //the number of btyes stored in memory
  var stack = []; //The stack of ops
  var depth = 0; //call depth
  var logs = [];
  var validJumps = [];
  var gasRefund = bignum(0);

  this.trie.checkpoint();

  //copy creates a shared cached.
  var storageTrie = this.trie.copy();
  storageTrie.root = opts.account.stateRoot;

  /**
   * Subtracts the amount need for memory usage from `gasLeft`
   * @method subMemUsage
   * @param {Number} offset
   * @param {Number} length
   * @return {String}
   */
  function subMemUsage(offset, length) {

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
  function memStore(offset, val, valOffset, length) {

    //hacky: if the dataOffset is larger than the largest safeInt then just
    //load 0's because if tx.data did have that amount of data then the fee
    //would be high than the maxGasLimit in the block
    if (length < 9007199254740991) {
      if (valOffset > 9007199254740991) {
        val = new Buffer(length);
        val.fill(0);
      } else {
        val = val.slice(valOffset, valOffset + length);
      }
    }

    var err = subMemUsage(offset, length);

    if (err) return err;

    for (var i = 0; i < length; i++) {
      memory[offset + i] = val[i];
    }
  }

  //load the current account
  function loadAccount(done) {
    self.trie.get(opts.address, function(err, raw) {
      opts.account = new Account(raw);
      storageTrie.root = opts.account.stateRoot;
      done(err);
    });
  }

  //find all the invalid jumps and puts them in the `invalidJumps` array
  function preprocessInvalidJumps() {

    for (var i = 0; i < opts.code.length; i++) {
      var curOpCode = opcodes(opts.code[i]);

      //no destinations into the middle of PUSH
      if (curOpCode === 'PUSH') {
        i += opts.code[i] - 0x5f;
      }

      if (curOpCode === 'JUMPDEST') {
        validJumps.push(i);
      }

    }
  }

  //checks if a jump is valid given a destination
  function checkJump(dest) {
    if (validJumps.indexOf(dest) === -1) {
      return false;
    }
    return true;
  }

  //checks to see if we have enough gas left for the memory reads and writes
  //required by the CALLs
  function checkCallMemCost(callOptions, localOpts) {
    //calculates the gase need for reading the input from memory
    callOptions.data = memLoad(localOpts.inOffset, localOpts.inLength);

    //calculates the gas need for saving the output in memory
    if (localOpts.outLength) {
      var err = subMemUsage(localOpts.outOffset, localOpts.outLength);
    }

    if (!callOptions.gas) {
      callOptions.gas = gasLeft;
    }

    if (gasLeft.lt(callOptions.gas) || err === ERROR.OUT_OF_GAS || callOptions.data === ERROR.OUT_OF_GAS) {
      return ERROR.OUT_OF_GAS;
    }
  }

  //sets up and calls runCall
  function makeCall(callOptions, localOpts, done) {

    callOptions.account = opts.account;
    callOptions.caller = opts.address;
    callOptions.origin = opts.origin;
    callOptions.gasPrice = opts.gasPrice;
    callOptions.block = opts.block;

    //increamnet the depth
    callOptions.depth = depth + 1;

    var memErr = checkCallMemCost(callOptions, localOpts);
    if (memErr) {
      done(memErr);
      return;
    }

    //does this account have enought ether?
    if (depth > constants.MAX_CALL_DEPTH || bignum.fromBuffer(opts.account.balance).lt(callOptions.value)) {
      stack.push(new Buffer([0]));
      done();
    } else {

      //if creating a new contract then increament the nonce
      if (!callOptions.to) {
        opts.account.nonce = bignum.fromBuffer(opts.account.nonce).add(1).toBuffer();
      }

      if(callOptions.callcode){
        callOptions.value = bignum(0);
      }

      if(callOptions.callcode && !callOptions.code){
        stack.push(new Buffer([1]));
        done();
        return;
      }

      self.runCall(callOptions, function(err, results) {

        if (err) {
          return done(err);
        }
        //save results to memory
        if (results.vm.returnValue) {
          for (var i = 0; i < localOpts.outLength; i++) {
            memory[localOpts.outOffset + i] = results.vm.returnValue[i];
          }
        }

        //concat the logs
        if (results.vm.logs) {
          logs = logs.concat(results.vm.logs);
        }

        //add gasRefund
        if (results.vm.gasRefund) {
          gasRefund = gasRefund.add(results.vm.gasRefund);
        }

        gasLeft = gasLeft.sub(results.gasUsed);
        if (results.createdAddress) {
          stack.push(results.createdAddress);
        } else {
          if (results.vm.exception === undefined) {
            results.vm.exception = 1;
          }
          stack.push(new Buffer([results.vm.exception]));
        }

        loadAccount(done);
      });
    }
  }

  //set defaults
  if (!opts.origin) {
    opts.origin = opts.caller;
  }

  if (!opts.data) {
    opts.data = new Buffer([0]);
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
          bignum.fromBuffer(stack.pop())
          .add(bignum.fromBuffer(stack.pop())).mod(utils.TWO_POW256)
          .toBuffer()
        );
        done();
      }
    ],
    MUL: [2,
      function(done) {
        stack.push(
          bignum.fromBuffer(stack.pop())
          .mul(bignum.fromBuffer(stack.pop())).mod(utils.TWO_POW256)
          .toBuffer()
        );
        done();
      }
    ],
    SUB: [2,
      function(done) {
        stack.push(
          utils.toUnsigned(
            bignum.fromBuffer(stack.pop())
            .sub(bignum.fromBuffer(stack.pop()))
          )
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
          utils.toUnsigned(
            utils.fromSigned(stack.pop())
            .div(utils.fromSigned(stack.pop())))
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
          utils.toUnsigned(
            utils.fromSigned(stack.pop())
            .mod(utils.fromSigned(stack.pop())))
        );
        done();
      }
    ],
    ADDMOD: [3,
      function(done) {
        stack.push(
          bignum.fromBuffer(stack.pop())
          .add(bignum.fromBuffer(stack.pop()))
          .mod(bignum.fromBuffer(stack.pop())).toBuffer()
        );
        done();
      }
    ],
    MULMOD: [3,
      function(done) {
        stack.push(
          bignum.fromBuffer(stack.pop())
          .mul(bignum.fromBuffer(stack.pop())).mod(bignum.fromBuffer(stack.pop()))
          .toBuffer()
        );
        done();
      }
    ],
    EXP: [2,
      function(done) {
        var base = stack.pop();
        var exponent = utils.unpad(stack.pop());

        if (exponent[0] !== 0) {
          gasLeft = gasLeft.sub(exponent.length);
        }

        stack.push(
          bignum.fromBuffer(base)
          .powm(bignum.fromBuffer(exponent), utils.TWO_POW256)
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
          val = utils.pad(stack.pop(), 32);

          if (val[31 - k] & 0x80) {
            extendOnes = true;
          }

          for (i = 30 - k; i >= 0; i--) { // note 31-k-1 since kth byte shouldn't be modified
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
            utils.fromSigned(stack.pop())
            .lt(utils.fromSigned(stack.pop()))
          ])
        );
        done();
      }
    ],
    SGT: [2,
      function(done) {
        stack.push(
          new Buffer([
            utils.fromSigned(stack.pop())
            .gt(utils.fromSigned(stack.pop()))
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
          byte;

        if (pos < 32) {
          var word = utils.pad(stack.pop(), 32);
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

        //copy fee
        gasLeft = gasLeft.sub(Math.ceil(length / 32) * 10);

        if (data === ERROR.OUT_OF_GAS || gasLeft.lt(0)) {
          return done(ERROR.OUT_OF_GAS);
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
        var address = stack.pop().slice(-20);
        //if check if we want the current running account
        if (address.toString('hex') === opts.address.toString('hex')) {
          stack.push(opts.account.balance);
          return done();
        }

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
        stack.push(opts.caller);
        done();
      }
    ],
    CALLVALUE: [0,
      function(done) {
        stack.push(opts.value.toBuffer());
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

        var dataOffset = utils.bufferToInt(dataOffsetBuf);

        //sub the COPY fee
        gasLeft = gasLeft.sub(Math.ceil(dataLength / 32));
        var err = memStore(memOffset, opts.data, dataOffset, dataLength);

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
        var err = memStore(memOffset, opts.code, codeOffset, length);

        done(err);
      }
    ],
    EXTCODESIZE: [1,
      function(done) {
        var address = stack.pop().slice(-20);
        self.trie.get(address, function(err, raw) {
          var account = new Account(raw);
          account.getCode(self.trie, function(err2, code) {
            stack.push(utils.intToBuffer(code.length));
            done(err | err2);
          });
        });
      }
    ],
    EXTCODECOPY: [4,
      function(done) {

        var address = stack.pop().slice(-20),
          memOffset = utils.bufferToInt(stack.pop()),
          codeOffset = utils.bufferToInt(stack.pop()),
          length = utils.bufferToInt(stack.pop());

        self.trie.get(address, function(err, raw) {
          var account = new Account(raw);

          account.getCode(self.trie, function(err2, code) {
            code = err ? new Buffer([0]) : code;
            //sub the COPY fee
            gasLeft = gasLeft.sub(Math.ceil(length / 32));
            err = memStore(memOffset, code, codeOffset, length);
            done(err | err2);
          });
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
    BLOCKHASH: [1,
      function(done) {
        var number = utils.unpad(stack.pop());
        var diff = utils.bufferToInt(opts.block.header.number) - utils.bufferToInt(number);

        if (diff > 256 || diff <= 0) {
          stack.push(new Buffer([0]));
          return done();
        }

        opts.blockchain.getBlockByNumber(number, function(err, block) {
          stack.push(block.hash());
          done(err);
        });
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
          word = utils.pad(stack.pop(), 32),
          err = memStore(offset, word, 0, 32);

        done(err);
      }
    ],
    MSTORE8: [2,
      function(done) {
        var offset = utils.bufferToInt(stack.pop());
        var byte = stack.pop();
        //grab the last byte
        byte = byte.slice(byte.length - 1);
        memStore(offset, byte, 0, 1);
        done();
      }
    ],
    SLOAD: [1,
      function(done) {
        var key = utils.pad(stack.pop(), 32);

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
        var key = utils.pad(stack.pop(), 32),
          val = utils.unpad(stack.pop());

        storageTrie.get(key, function(err, found) {
          if (val.length === 0) {
            //deleting a value
            val = '';
          } else {
            val = rlp.encode(val);
          }

          if (val === '' && !found) {
            gasLeft = gasLeft.sub(100);
          } else if (val === '' && found) {
            gasRefund = gasRefund.add(100);
          } else if (val !== '' && !found) {
            gasLeft = gasLeft.sub(300);
          } else if (val !== '' && found) {
            gasLeft = gasLeft.sub(100);
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
        var dest = utils.bufferToInt(stack.pop());

        if (!checkJump(dest)) {
          var err = ERROR.INVALID_JUMP;
        }

        pc = dest;

        done(err);
      }
    ],
    JUMPI: [2,
      function(done) {
        var c = utils.bufferToInt(stack.pop()),
          i = utils.bufferToInt(stack.pop());

        var dest = i ? c : pc;

        if (i && !checkJump(dest)) {
          var err = ERROR.INVALID_JUMP;
        }

        pc = dest;

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

        if (stackPos > stack.length) {
          return done(ERROR.STACK_UNDERFLOW);
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
          return done(ERROR.STACK_UNDERFLOW);
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
        topics.push(utils.pad(stack.pop(), 32));
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
          to = utils.pad(stack.pop(), 20),
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
          to = utils.pad(stack.pop(), 20);

        var value = bignum.fromBuffer(stack.pop());

        var inOffset = utils.bufferToInt(stack.pop()),
          inLength = utils.bufferToInt(stack.pop()),
          outOffset = utils.bufferToInt(stack.pop()),
          outLength = utils.bufferToInt(stack.pop()),
          data = memLoad(inOffset, inLength),
          options = {
            gas: gas,
            value: value,
            to: opts.address,
            data: data,
            callcode: true
          },
          localOpts = {
            inOffset: inOffset,
            inLength: inLength,
            outOffset: outOffset,
            outLength: outLength
          };

        //load the code
        self.trie.get(to, function(err, raw) {
          if (raw) {
            var account = new Account(raw);
            account.getCode(self.trie, function(err2, code) {
              if (err) {
                return done(err | err2);
              }
              options.code = code;
              makeCall(options, localOpts, done);
            });
          } else {
            makeCall(options, localOpts, done);
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
        suicideTo = utils.pad(stack.pop(), 20);
        done();
      }
    ]
  };

  storageTrie.root = opts.account.stateRoot;

  preprocessInvalidJumps();

  //iterate throught the give ops untill something breaks or we hit STOP
  async.whilst(function() {

    if (gasLeft.lt(0)) {
      vmError = ERROR.OUT_OF_GAS;
      return false;
    }
    return !stopped && !suicide && pc < opts.code.length;

  }, function(done) {

    op = opts.code[pc];
    opcode = opcodes(op);

    if (!opcode) {
      return done(ERROR.INVALID_OPCODE);
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
              opcode: opcodes(op, true),
              storageTrie: storageTrie,
              stack: stack,
              depth: depth,
              address: opts.address,
              account: opts.account,
              memory: memory
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
        if (stack.length < opFunc[0]) {
          return done2(ERROR.STACK_UNDERFLOW);
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
      gasRefund: gasRefund,
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
