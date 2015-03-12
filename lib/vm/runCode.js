const async = require('async');
const BN = require('bn.js');
const rlp = require('rlp');
const Account = require('../account');
// const fees = require('../fees.js');
const fees = require('ethereum-common').fees;
const opcodes = require('./opcodes.js');
const utils = require('ethereumjs-util');
const constants = require('./constants.js');
const logTable = require('./logTable.js');

const setImmediate = require('timers').setImmediate;

const ERROR = constants.ERROR;

/**
 * Runs EVM code
 * @param opts
 * @param opts.account {Account} the account that the exucuting code belongs to
 * @param opts.address {Buffer}  the address of the account that is exucuting this code
 * @param opts.block {Block} the block that the transaction is part of
 * @param opts.bloom {Buffer}
 * @param opts.caller {Buffer} the address that ran this code
 * @param opts.data {Buffer}  the input data
 * @param opts.gasLimit {Buffer}
 * @param opts.origin {Buffer} the address where the call originated from
 * @param cb {Function}
 */
module.exports = function(opts, cb) {

  const MAX_INT = 9007199254740991;

  var self = this;
  var returnValue = new Buffer([]);
  var stopped = false;
  var suicide = false;
  var suicides = [];
  var vmError = false;
  var suicideTo; //the to address for the remainding balance
  var pc = 0; //programm counter
  var op; //the raw op code
  var opcode; // the opcode
  var gasLeft = new BN(opts.gasLimit); //how much gas we have left
  var memory = []; //memory
  var wordsInMem = 0; //the number of btyes stored in memory
  var stack = []; //The stack of ops
  var depth = 0; //call depth
  var logs = [];
  var validJumps = [];
  var gasRefund = new BN(0);

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

    //hacky: if the dataOffset is larger than the largest safeInt then just
    //load 0's because if tx.data did have that amount of data then the fee
    //would be high than the maxGasLimit in the block
    if (offset > MAX_INT || length > MAX_INT) {
      return ERROR.OUT_OF_GAS;
    }

    var newWords = Math.max(wordsInMem, Math.ceil((offset + length) / 32)) - wordsInMem;
    wordsInMem += newWords;
    //TODO: review the use of toString here on number larger than MAX_INT
    var gnNewWords = new BN(newWords).mul(new BN(fees.memoryGas.v));

    var quadCost = new BN(newWords).sqr().div(new BN(fees.quadCoeffDiv.v));

    gasLeft = gasLeft.sub(gnNewWords).sub(quadCost);
    if (gasLeft.cmp(new BN(0)) === -1) {
      return ERROR.OUT_OF_GAS;
    }
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

    var err = subMemUsage(offset, length);

    if (err) return err;

    for (var i = 0; i < length; i++) {
      memory[offset + i] = val[valOffset + i];
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
      var curOpCode = opcodes(opts.code[i]).opcode;

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

    if (!callOptions.gasLimit) {
      callOptions.gasLimit = gasLeft;
    }

    if (gasLeft.cmp(callOptions.gasLimit) === -1 || err === ERROR.OUT_OF_GAS || callOptions.data === ERROR.OUT_OF_GAS) {
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
    if (depth > constants.MAX_CALL_DEPTH || new BN(opts.account.balance).cmp(callOptions.value) === -1) {
      stack.push(new Buffer([0]));
      done();
    } else {

      //if creating a new contract then increament the nonce
      if (!callOptions.to) {
        opts.account.nonce = new Buffer(new BN(opts.account.nonce).add(new BN(1)).toArray());
      }

      if (callOptions.callcode) {
        callOptions.value = new BN(0);
      }

      if (callOptions.callcode && !callOptions.code) {
        stack.push(new Buffer([1]));
        done();
        return;
      }

      self.runCall(callOptions, function(err, results) {

        if (err) {
          return done(err);
        }

        //concat the logs
        if (results.vm.logs) {
          logs = logs.concat(results.vm.logs);
        }

        //concat the suicides
        if (results.vm.suicides) {
          suicides = suicides.concat(results.vm.suicides);
        }
        //add gasRefund
        if (results.vm.gasRefund) {
          gasRefund = gasRefund.add(results.vm.gasRefund);
        }

        gasLeft = gasLeft.sub(new BN(results.gasUsed));

        if (results.vm.exception === undefined) {
          results.vm.exception = 1;
        }

        if (!results.vm.exceptionErr) {
          //save results to memory
          if (results.vm.returnValue) {
            for (var i = 0; i < localOpts.outLength; i++) {
              memory[localOpts.outOffset + i] = results.vm.returnValue[i];
            }
          }

          if (results.createdAddress) {
            stack.push(results.createdAddress);
          } else {

            stack.push(new Buffer([results.vm.exception]));
          }
          loadAccount(done);
        } else {
          stack.push(new Buffer([results.vm.exception]));
          if (results.vm.createdAddress) {
            opts.account.nonce = new Buffer(new BN(opts.account.nonce).sub(new BN(1)).toArray());
          }
          done();
        }
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
          new Buffer(
            new BN(stack.pop())
            .add(new BN(stack.pop())).mod(utils.TWO_POW256)
            .toArray())
        );
        done();
      }
    ],
    MUL: [2,
      function(done) {
        stack.push(
          new Buffer(
            new BN(stack.pop())
            .mul(new BN(stack.pop())).mod(utils.TWO_POW256)
            .toArray()
          ));
        done();
      }
    ],
    SUB: [2,
      function(done) {
        stack.push(
          utils.toUnsigned(
            new BN(stack.pop())
            .sub(new BN(stack.pop()))
          )
        );
        done();
      }
    ],
    DIV: [2,
      function(done) {
        const a = new BN(stack.pop());
        const b = new BN(stack.pop());
        var r;
        if (b.toString() === '0') {
          r = [0];
        } else {
          r = a.div(b).toArray();
        }
        stack.push(
          new Buffer(r)
        );
        done();
      }
    ],
    SDIV: [2,
      function(done) {

        const a = utils.fromSigned(stack.pop());
        const b = utils.fromSigned(stack.pop());

        var r;
        if (b.toString() === '0') {
          r = new Buffer([0]);
        } else {
          r = utils.toUnsigned(a.div(b));
        }
        stack.push(r);
        done();
      }
    ],
    MOD: [2,
      function(done) {

        const a = new BN(stack.pop());
        const b = new BN(stack.pop());
        var r;

        if (b.toString() === '0') {
          r = [0];
        } else {
          r = a.mod(b).toArray();
        }

        stack.push(
          new Buffer(r)
        );

        done();
      }
    ],
    SMOD: [2,
      function(done) {
        const a = utils.fromSigned(stack.pop());
        const b = utils.fromSigned(stack.pop());
        var r;

        if (b.toString() === '0') {
          r = new Buffer([0]);
        } else {
          r = utils.toUnsigned(a.mod(b));
        }

        stack.push(r);

        done();
      }
    ],
    ADDMOD: [3,
      function(done) {
        const a = new BN(stack.pop()).add(new BN(stack.pop()))
        const b = new BN(stack.pop())
        var r;

        if (b.toString() === '0') {
          r = [0];
        } else {
          r = a.mod(b).toArray();
        }

        stack.push(
          new Buffer(r)
        );
        done();
      }
    ],
    MULMOD: [3,
      function(done) {
        const a = new BN(stack.pop()).mul(new BN(stack.pop()))
        const b = new BN(stack.pop())
        var r;

        if (b.toString() === '0') {
          r = [0];
        } else {
          r = a.mod(b).toArray();
        }

        stack.push(
          new Buffer(r)
        );
        done();
      }
    ],
    EXP: [2,
      function(done) {
        var base = new BN(stack.pop());
        var exponent = new BN(stack.pop());
        var m = BN.red(utils.TWO_POW256);
        base = base.toRed(m)

        var result;
        if (exponent.cmp(new BN(0)) !== 0) {
          var bytes = 1 + logTable(exponent);
          gasLeft = gasLeft.sub(new BN(bytes).mul(new BN(fees.expByteGas.v)));
          // gasLeft = gasLeft.sub(new BN(exponent.byteLength()).mul(new BN(fees.expByteGas.v)));
          result = new Buffer(base.redPow(exponent).toArray());
        } else {
          result = new Buffer([1]);
        }


        stack.push(
          result
        );
        done();
      }
    ],
    SIGNEXTEND: [2,
      function(done) {
        var k = new BN(stack.pop()),
          val,
          extendOnes = false,
          i;

        if (k.cmp(new BN(31)) <= 0) {
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
            new BN(stack.pop())
            .cmp(new BN(stack.pop())) === -1
          ])
        );
        done();
      }
    ],
    GT: [2,
      function(done) {
        stack.push(
          new Buffer([
            new BN(stack.pop())
            .cmp(new BN(stack.pop())) === 1
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
            .cmp(utils.fromSigned(stack.pop())) === -1
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
            .cmp(utils.fromSigned(stack.pop())) === 1
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
          new Buffer((
              new BN(stack.pop())
              .and(
                new BN(stack.pop())
              )
            )
            .toArray())
        );
        done();
      }
    ],
    OR: [2,
      function(done) {
        stack.push(
          new Buffer((
              new BN(stack.pop())
              .or(
                new BN(stack.pop())
              )
            )
            .toArray())
        );
        done();
      }
    ],
    XOR: [2,
      function(done) {
        stack.push(
          (
            new BN(stack.pop())
            .xor(
              new BN(stack.pop())
            )
          )
          .toArray()
        );
        done();
      }
    ],
    NOT: [1,
      function(done) {
        stack.push(
          new Buffer(utils.TWO_POW256.sub(new BN(1)).sub(new BN(stack.pop()))
            .toArray())
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
        var offset = utils.bufferToInt(stack.pop());
        var length = utils.bufferToInt(stack.pop());
        var data = memLoad(offset, length);

        //copy fee
        gasLeft = gasLeft.sub(new BN(Math.ceil(length / 32) * 10));

        if (data === ERROR.OUT_OF_GAS || gasLeft.cmp(new BN(0)) === -1) {
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
        stack.push(new Buffer(opts.value.toArray()));
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
          stack.push(utils.intToBuffer(opts.data.length));
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

        //sub copy fee
        gasLeft = gasLeft.sub(new BN(Number(fees.copyGas.v) * Math.ceil(dataLength / 32)));
        var err = memStore(memOffset, opts.data, dataOffset, dataLength);

        done(err);
      }
    ],
    CODESIZE: [0,
      function(done) {
        stack.push(utils.intToBuffer(opts.code.length));
        done();
      }
    ],
    CODECOPY: [3,
      function(done) {
        var memOffset = utils.bufferToInt(stack.pop()),
          codeOffset = utils.bufferToInt(stack.pop()),
          length = utils.bufferToInt(stack.pop());

        //sub the COPY fee
        gasLeft = gasLeft.sub(new BN(Number(fees.copyGas.v) * Math.ceil(length / 32)));
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
            done(err || err2);
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
            gasLeft = gasLeft.sub(new BN(Number(fees.copyGas.v) * Math.ceil(length / 32)));
            err = memStore(memOffset, code, codeOffset, length);
            done(err || err2);
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

        self.blockchain.getBlockByNumber(number, function(err, block) {
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

        if(loaded === ERROR.OUT_OF_GAS){
          done(loaded);
          return
        }

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
        var err = memStore(offset, byte, 0, 1);
        done(err);
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
            gasLeft = gasLeft.sub(new BN(fees.sstoreResetGas.v));
          } else if (val === '' && found) {
            gasLeft = gasLeft.sub(new BN(fees.sstoreClearGas.v));
            gasRefund = gasRefund.add(new BN(fees.sstoreRefundGas.v));
          } else if (val !== '' && !found) {
            gasLeft = gasLeft.sub(new BN(fees.sstoreSetGas.v));
          } else if (val !== '' && found) {
            gasLeft = gasLeft.sub(new BN(fees.sstoreResetGas.v));
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
        stack.push(utils.intToBuffer(pc - 1));
        done();
      }
    ],
    MSIZE: [0,
      function(done) {
        stack.push(utils.intToBuffer(wordsInMem * 32));
        done();
      }
    ],
    GAS: [0,
      function(done) {
        stack.push(new Buffer(gasLeft.toArray()));
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

      gasLeft = gasLeft.sub(new BN(numOfTopics * 32 + memLength));

      if(mem === ERROR.OUT_OF_GAS){
        done(mem);
        return;
      }

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
        var value = new BN(stack.pop()),
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
        var gasLimit = new BN(stack.pop()),
          to = utils.pad(stack.pop(), 20),
          value = new BN(stack.pop()),
          inOffset = utils.bufferToInt(stack.pop()),
          inLength = utils.bufferToInt(stack.pop()),
          outOffset = utils.bufferToInt(stack.pop()),
          outLength = utils.bufferToInt(stack.pop()),
          data = memLoad(inOffset, inLength),
          options = {
            gasLimit: gasLimit,
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
        var gas = new BN(stack.pop()),
          to = utils.pad(stack.pop(), 20);

        var value = new BN(stack.pop());

        var inOffset = utils.bufferToInt(stack.pop()),
          inLength = utils.bufferToInt(stack.pop()),
          outOffset = utils.bufferToInt(stack.pop()),
          outLength = utils.bufferToInt(stack.pop()),
          data = memLoad(inOffset, inLength),
          options = {
            gasLimit: gas,
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
        if(returnValue === ERROR.OUT_OF_GAS){
          done(returnValue);
          return
        }

        stopped = true;
        done();
      }
    ],
    //'0x70', range - other
    SUICIDE: [0,
      function(done) {
        suicide = true;
        suicideTo = utils.pad(stack.pop(), 20);
        suicides.push({
          account: opts.address,
          to: suicideTo
        });
        done();
      }
    ]
  };

  storageTrie.root = opts.account.stateRoot;

  preprocessInvalidJumps();

  //iterate throught the give ops untill something breaks or we hit STOP
  async.whilst(function() {

    if (gasLeft.cmp(new BN(0)) === -1) {
      vmError = ERROR.OUT_OF_GAS;
      return false;
    }
    return !stopped && !suicide && pc < opts.code.length;

  }, function(done) {

    op = opts.code[pc];
    var codePrice = opcodes(op);
    opcode = codePrice.opcode;

    if (!opcode) {
      return done(ERROR.INVALID_OPCODE);
    }

    //get fee, decrment gas left
    var fee = codePrice.fee;

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

        gasLeft = gasLeft.sub(new BN(fee));
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
      suicides: suicides,
      suicideTo: suicideTo,
      gasRefund: gasRefund,
      account: opts.account,
      exception: err ? 0 : 1,
      exceptionErr: err,
      logs: logs,
      returnValue: returnValue
    };

    if (results.exceptionErr === 'out of gas') {
      delete results.gasRefund;
    }

    cb = cb.bind(this, err, results);

    //revert the state if there's ANY error
    if (err) {
      results.gasUsed = opts.gasLimit;
      self.trie.revert(cb);
    } else {
      results.gasUsed = new BN(opts.gasLimit).sub(gasLeft);
      self.trie.commit(cb);
    }
  });
};
