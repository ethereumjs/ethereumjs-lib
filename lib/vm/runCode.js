const SHA3 = require('sha3'),
  async = require('async'),
  bignum = require('bignum'),
  rlp = require('rlp'),
  Account = require('../account'),
  fees = require('../fees.js'),
  opcodes = require('./opcodes.js'),
  utils = require('../utils.js'),
  constants = require('./constants.js');

const ERROR = constants.ERROR,
  TT256 = bignum('2').pow(256);

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
    suicideTo, //the to address for the remainding balance
    pc = 0, //programm counter
    op, //the raw op code
    opcode, // the opcode
    gasLeft = bignum(opts.gasLimit), //how much gas we have left
    memory = [], //memory
    wordsInMem = 0, //the number of btyes stored in memory
    stack = [], //The stack of ops
    depth = 0; //call depth


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
      done(err);
    });
  }

  /**
   * mod - computes x modulo y based on
   * http://stackoverflow.com/questions/4467539/javascript-modulo-not-behaving
   * @param  {bignum} x
   * @param  {bignum} y
   * @return {bignum}
   */
  function mod(x, y) {
    return (x.mod(y)).add(y).mod(y);
  }

  /**
   * modTT256 returns n % 2^256
   * @param {bignum} n
   * @return {bignum}
   */
  function modTT256(n) {
    return mod(n, TT256);
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

  this.trie.checkpoint();
  var storageTrie = this.trie.copy(),
    //define the opcode functions
    opFuncs = {
      STOP: [0,
        function(done) {
          stopped = true;
          done();
        }
      ],
      ADD: [2,
        function(done) {
          stack.push(
            modTT256(
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
            modTT256(
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
            modTT256(
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
            modTT256(
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
            modTT256(
              utils.fromSigned(bignum.fromBuffer(stack.pop()))
              .mod(utils.fromSigned(
                bignum.fromBuffer(stack.pop())
              ))
            ).toBuffer()
          );
          done();
        }
      ],
      EXP: [2,
        function(done) {
          stack.push(
            bignum.fromBuffer(stack.pop())
            .powm(bignum.fromBuffer(stack.pop()), bignum(2).shiftLeft(256))
            .toBuffer()
          );
          done();
        }
      ],
      BNOT: [1,
        function(done) {
          stack.push(
            TT256.sub(1).sub(bignum.fromBuffer(stack.pop()))
              .toBuffer()
          );
          done();
        }
      ],
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
          //todo: use buffer.equal
          stack.push(
            new Buffer([a.toString('hex') === b.toString('hex')])
          );
          done();
        }
      ],
      NOT: [1,
        function(done) {
          var i = utils.bufferToInt(stack.pop());
          stack.push(new Buffer([!i]));
          done();
        }
      ],
      //0x10 range - bit ops
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
      ADDMOD: [3,
        function(done) {
          stack.push(
            mod(
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
            mod(
              bignum.fromBuffer(stack.pop())
              .mul(bignum.fromBuffer(stack.pop())), bignum.fromBuffer(stack.pop()))
            .toBuffer()
          );
          done();
        }
      ],
      //0x20 range - crypto
      SHA3: [2,
        function(done) {
          var offset = utils.bufferToInt(stack.pop()),
            length = utils.bufferToInt(stack.pop()),
            data = memLoad(offset, length),
            hash = new SHA3.SHA3Hash(256);

          hash.update(data);
          stack.push(new Buffer(hash.digest('hex'), 'hex'));
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

          //loaded = utils.unpad(loaded);
          //pad begining
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
          var memOffset = utils.bufferToInt(stack.pop()),
            dataOffset = utils.bufferToInt(stack.pop()),
            length = utils.bufferToInt(stack.pop()),
            err = memStore(memOffset, opts.data.slice(dataOffset, dataOffset + length));

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
            length = utils.bufferToInt(stack.pop()),
            err = memStore(memOffset, opts.code.slice(codeOffset, codeOffset + length));

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
      DUP: [0,
        function(done) {
          var stackPos = op - 0x7f;
          stack.push(stack[stack.length - stackPos]);
          done();
        }
      ],
      SWAP: [2,
        function(done) {
          var stackPos = op - 0x8f,
            one = stack.pop(),
            two = stack[stack.length - stackPos];

          stack.push(two);
          stack[stack.length - stackPos - 1] = one;

          done();
        }
      ],
      MLOAD: [1,
        function(done) {
          var pos = utils.bufferToInt(stack.pop()),
            loaded = utils.unpad(memLoad(pos, 32));

          if (loaded === ERROR.OUT_OF_GAS) {
            done(loaded);
            return;
          }

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
              gasLeft = gasLeft.add(200);
              val = '';
            } else {
              val = rlp.encode(val);
            }

            if (!found) {
              //creating a new value
              gasLeft = gasLeft.sub(100);
              if (gasLeft.lt(0)) {
                done(err);
                return;
              }
            }

            storageTrie.put(key, val, function(){
              //update the stateRoot on the account
              opts.account.stateRoot = storageTrie.root ? storageTrie.root : new Buffer([0]);
              done();
            });
          });
        }
      ],
      JUMP: [1,
        function(done) {
          pc = utils.bufferToInt(stack.pop());

          var pop = opts.code[pc - 1],
            popcode = opcodes[pop],
            err;

          if (popcode !== 'JUMPDEST') {
            err = ERROR.MISSING_JUMPDEST;
          }

          done(err);
        }
      ],
      JUMPI: [2,
        function(done) {
          var c = utils.bufferToInt(stack.pop()),
            i = utils.bufferToInt(stack.pop());

          pc = i ? c : pc;

          var pop = opts.code[pc - 1],
            popcode = opcodes[pop],
            err;

          if (i && popcode !== 'JUMPDEST') {
            err = ERROR.MISSING_JUMPDEST;
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
      //'0xf0' range - closures
      CREATE: [3,
        function(done) {
          var value = bignum.fromBuffer(stack.pop()),
            offset = utils.bufferToInt(stack.pop()),
            length = utils.bufferToInt(stack.pop()),
            data = memLoad(offset, length),
            options = {
              gas: gasLeft,
              fromAccount: opts.account,
              from: opts.address,
              origin: opts.origin,
              gasPrice: opts.gasPrice,
              value: value,
              block: opts.block,
              data: data
            };

          if (data === ERROR.OUT_OF_GAS) {
            done(data);
            return;
          }

          if (bignum.fromBuffer(opts.account.balance).lt(value)) {
            done();
          } else {
            opts.account.nonce = bignum.fromBuffer(opts.account.nonce).add(1).toBuffer();

            async.series([
              //runs the call
              function(done2) {
                self.runCall(options, function(err, results) {
                  gasLeft = gasLeft.sub(results.gasUsed);

                  if (!results.vm.exception) {
                    stack.push(new Buffer([results.vm.exception]));
                  } else {
                    stack.push(results.createdAddress);
                  }

                  done2(err);
                });
              },
              //load the current account
              loadAccount
            ], done);
          }
        }
      ],
      CALL: [7,
        function(done) {
          var gas = bignum.fromBuffer(stack.pop()),
            to = utils.unpad(stack.pop()),
            value = bignum.fromBuffer(stack.pop()),
            inOffset = utils.bufferToInt(stack.pop()),
            inLength = utils.bufferToInt(stack.pop()),
            outOffset = utils.bufferToInt(stack.pop()),
            outLength = utils.bufferToInt(stack.pop()),
            data = memLoad(inOffset, inLength),
            options = {
              gas: gas,
              fromAccount: opts.account,
              from: opts.address,
              origin: opts.origin,
              gasPrice: opts.gasPrice,
              value: value,
              to: to,
              block: opts.block,
              data: data,
              depth: ++depth
            },
            err = subMemUsage(outOffset, outLength);

          if (depth >= constants.MAX_CALL_DEPTH || gasLeft.lt(gas)
              || err === ERROR.OUT_OF_GAS || data === ERROR.OUT_OF_GAS) {
            stack.push(new Buffer([0]));
            done(ERROR.OUT_OF_GAS);
            return;
          }

          //does this account have enought ether?
          if (bignum.fromBuffer(opts.account.balance).lt(value)) {
            stack.push(new Buffer([0]));
            done();
          } else {
            async.series([
              function(done2) {
                self.runCall(options, function(err, results) {
                  //save results to memory
                  for (var i = 0; i < outLength; i++) {
                    memory[outOffset + i] = results.vm.returnValue[i];
                  }

                  gasLeft = gasLeft.sub(results.gasUsed);
                  stack.push(new Buffer([results.vm.exception]));
                  done2(err);
                });
              },
              loadAccount
            ], done);
          }
        }
      ],
      CALLCODE: [1,
        function(done){
          var to = utils.unpad(stack.pop());
          self.trie.get(to, function(err, raw){
            if(!err && raw){
              var account = new Account(raw);
              account.getCode(function(err, code){
                if(++depth <= constants.MAX_CALL_DEPTH){
                  done(ERROR.OUT_OF_GAS);
                } else if(!err && code){
                  //inject code
                  opts.code = Buffer.concat([opts.code.slice(0 ,pc), code, opts.code.slice(pc)]);
                }
                done();
              });
            }else{
              done();
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

  storageTrie.root = opts.account.stateRoot.length === 1 ? null : opts.account.stateRoot;

  //iterate throught the give ops untill something breaks or we hit STOP
  async.whilst(function() {
    return !stopped && pc < opts.code.length && !suicide;
  }, function(done) {

    op = opts.code[pc];
    opcode = opcodes[op];
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

        if (!opcode) {
          done2(ERROR.INVALID_OPCODE);
          return;
        }

        var match = opcode.match(/^(PUSH?|SWAP?|DUP)/);
        if (match) {
          opcode = match[0];
        }

        //do we still have gas?
        if (gasLeft.lt(0)) {
          done2(ERROR.OUT_OF_GAS);
          return;
        }

        var opFunc = opFuncs[opcode];
        if ((opcode === 'SWAP' && op - 0x8f > stack.length) ||
          (opcode === 'DUP' && op - 0x7f > stack.length) ||
          (stack.length < opFunc[0])) {
          done2(ERROR.STACK_UNDERFLOW);
          return;
        }

        opFunc[1](done2);
      }
    ], done);

  }, function(err) {
    var gasUsed = bignum(opts.gasLimit).sub(gasLeft);
    if (err === ERROR.OUT_OF_GAS) {
      gasUsed = opts.gasLimit;
    }


    var results = {
      gasUsed: gasUsed,
      suicide: suicide,
      suicideTo: suicideTo,
      account: opts.account,
      exception: err ? 0 : 1,
      exceptionErr: err,
      returnValue: returnValue
    };

    cb = cb.bind(this, err, results);

    if (err === ERROR.OUT_OF_GAS) {
      self.trie.revert(cb);
    } else {
      self.trie.commit(cb);
    }
  });
};
