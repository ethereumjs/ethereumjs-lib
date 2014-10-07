var SHA3 = require('sha3'),
  async = require('async'),
  assert = require('assert'),
  bignum = require('bignum'),
  rlp = require('rlp'),
  Account = require('../account'),
  fees = require('../fees.js'),
  opcodes = require('./opcodes.js'),
  utils = require('../utils.js');

/**
 * Runs EVM code
 * @param {object} opts
 * @param {Block} opts.block the block that the transaction is part of
 * @param {Buffer} opts.gasLimit
 * @param {Account} opts.account the account that the exucuting code belongs to
 * @param {Buffer} opts.address the address of the account that is exucuting this code
 * @param {Buffer} opts.origin the address where the call originated from
 * @param {Buffer} opts.from the address that ran this code
 * @param {Function} cb
 */
module.exports = function (opts, cb) {
  var self = this,
    returnValue = new Buffer([]),
    stopped = false,
    suicide = false,
    //programm counter
    pc = 0,
    //the raw op code
    op,
    // the opcode add an memonic
    opcode,
    //how much gas we have left
    gasLeft = bignum(opts.gasLimit),
    //memory
    memory = [],
    //the number of btyes stored in memory
    wordsInMem = 0,
    //The stack of ops
    stack = [];

  /**
   * Subtracts the amount need for memory usage from `gasLeft`
   * @method subMemUsage
   * @param {Number} offset
   * @param {Number} length
   * @return {String}
   */
  function subMemUsage(offset, length) {
    var newWords = Math.max(wordsInMem, Math.ceil((offset + length) / 32));
    gasLeft = gasLeft.sub(newWords - wordsInMem);
    if (gasLeft.lt(0)) {
      return 'out of gas';
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
    var err = subMemUsage(offset, length);

    if (err) return err;

    var loaded = new Buffer(memory.slice(offset, offset + length));
    loaded = loaded.length ? loaded : new Buffer([0]);
    return loaded;
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
    self.trie.get(opts.address, function (err, raw) {
      opts.account = new Account(raw);
      done(err);
    });
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

  this.trie.checkpoint();
  var storageTrie = this.trie.copy(),
    //define the opcode functions
    opFuncs = {
      STOP: [0,
        function (done) {
          stopped = true;
          done();
        }
      ],
      ADD: [2,
        function (done) {
          stack.push(
            bignum.fromBuffer(stack.pop())
            .add(bignum.fromBuffer(stack.pop()))
            .toBuffer()
          );
          done();
        }
      ],
      MUL: [2,
        function (done) {
          stack.push(
            bignum.fromBuffer(stack.pop())
            .mul(bignum.fromBuffer(stack.pop()))
            .toBuffer()
          );
          done();
        }
      ],
      SUB: [2,
        function (done) {
          stack.push(
            utils.toUnsigned(
              bignum.fromBuffer(stack.pop())
              .sub(bignum.fromBuffer(stack.pop()))
            )
            .toBuffer()
          );
          done();
        }
      ],
      DIV: [2,
        function (done) {
          stack.push(
            bignum.fromBuffer(stack.pop())
            .div(bignum.fromBuffer(stack.pop()))
            .toBuffer()
          );
          done();
        }
      ],
      SDIV: [2,
        function (done) {
          stack.push(
            utils.toUnsigned(
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
        function (done) {
          stack.push(
            bignum.fromBuffer(stack.pop())
            .mod(bignum.fromBuffer(stack.pop()))
            .toBuffer()
          );
          done();
        }
      ],
      SMOD: [2,
        function (done) {
          stack.push(
            utils.toUnsigned(
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
        function (done) {
          stack.push(
            bignum.fromBuffer(stack.pop())
            .pow(bignum.fromBuffer(stack.pop()))
            .toBuffer()
          );
          done();
        }
      ],
      NEG: [1,
        function (done) {
          stack.push(
            utils.toUnsigned(
              utils.fromSigned(bignum.fromBuffer(stack.pop()))
              .neg()
            ).toBuffer()
          );
          done();
        }
      ],
      LT: [2,
        function (done) {
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
        function (done) {
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
        function (done) {
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
        function (done) {
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
        function (done) {
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
        function (done) {
          var i = utils.bufferToInt(stack.pop());
          stack.push(new Buffer([!i]));
          done();
        }
      ],
      //0x10 range - bit ops
      AND: [2,
        function (done) {
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
        function (done) {
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
        function (done) {
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
        function (done) {
          var pos = utils.bufferToInt(stack.pop()),
            word = stack.pop(),
            byte = word[pos];

          if (!byte) {
            byte = new Buffer([0]);
          }

          stack.push(byte);
          done();
        }
      ],
      //0x20 range - crypto
      SHA3: [2,
        function (done) {
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
        function (done) {
          stack.push(opts.address);
          done();
        }
      ],
      BALANCE: [0,
        function (done) {
          stack.push(opts.account.balance);
          done();
        }
      ],
      ORIGIN: [0,
        function (done) {
          stack.push(opts.origin);
          done();
        }
      ],
      CALLER: [0,
        function (done) {
          stack.push(opts.from);
          done();
        }
      ],
      CALLVALUE: [0,
        function (done) {
          stack.push(opts.value);
          done();
        }
      ],
      CALLDATALOAD: [1,
        function (done) {
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
        function (done) {
          if (opts.data.length === 1 && opts.data[0] === 0) {
            stack.push(new Buffer([0]));
          } else {
            stack.push(bignum(opts.data.length).toBuffer());
          }
          done();
        }
      ],
      CALLDATACOPY: [3,
        function (done) {
          var memOffset = utils.bufferToInt(stack.pop()),
            dataOffset = utils.bufferToInt(stack.pop()),
            length = utils.bufferToInt(stack.pop()),
            err = memStore(memOffset, opts.code.slice(memOffset, dataOffset + length));

          if (err) {
            done(err);
            return;
          }

          done();
        }
      ],
      CODESIZE: [0,
        function (done) {
          stack.push(bignum(opts.code.length).toBuffer());
          done();
        }
      ],
      CODECOPY: [3,
        function (done) {
          var memOffset = utils.bufferToInt(stack.pop()),
            codeOffset = utils.bufferToInt(stack.pop()),
            length = utils.bufferToInt(stack.pop()),
            err = memStore(memOffset, opts.code.slice(codeOffset, codeOffset + length));

          if (err) {
            done(err);
            return;
          }

          done();
        }
      ],
      GASPRICE: [0,
        function (done) {
          stack.push(opts.gasPrice);
          done();
        }
      ],
      //'0x40' range - block operations
      PREVHASH: [0,
        function (done) {
          stack.push(opts.block.header.parentHash);
          done();
        }
      ],
      COINBASE: [0,
        function (done) {
          stack.push(opts.block.header.coinbase);
          done();
        }
      ],
      TIMESTAMP: [0,
        function (done) {
          stack.push(opts.block.header.timestamp);
          done();
        }
      ],
      NUMBER: [0,
        function (done) {
          stack.push(opts.block.header.number);
          done();
        }
      ],
      DIFFICULTY: [0,
        function (done) {
          stack.push(opts.block.header.difficulty);
          done();
        }
      ],
      GASLIMIT: [0,
        function (done) {
          stack.push(opts.block.header.gasLimit);
          done();
        }
      ],

      //0x50 range - 'storage' and execution
      POP: [1,
        function (done) {
          stack.pop();
          done();
        }
      ],
      DUP: [0,
        function (done) {
          var stackPos = op - 0x7f;
          stack.push(stack[stack.length - stackPos]);
          done();
        }
      ],
      SWAP: [2,
        function (done) {
          var stackPos = op - 0x8f,
            one = stack.pop(),
            two = stack[stack.length - stackPos];

          stack.push(two);
          stack[stackPos] = one;

          done();
        }
      ],
      MLOAD: [1,
        function (done) {
          var pos = utils.bufferToInt(stack.pop()),
            loaded = utils.unpad(memLoad(pos, 32));

          if (loaded === 'out of gas') {
            done(loaded);
            return;
          }

          stack.push(loaded);
          done();

        }
      ],
      MSTORE: [2,
        function (done) {
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
        function (done) {
          var offset = utils.bufferToInt(stack.pop());
          var byte = stack.pop();
          //mod 256
          byte = byte.slice(byte.length - 1);
          memStore(offset, byte);

          done();
        }
      ],
      SLOAD: [1,
        function (done) {
          var key = utils.pad256(stack.pop());

          storageTrie.get(key, function (err, val) {
            var loaded = rlp.decode(val);

            loaded = loaded.length ? loaded : new Buffer([0]);
            stack.push(loaded);
            done(err);
          });
        }
      ],
      SSTORE: [2,
        function (done) {
          //memory.store(stack.pop(), stack.pop());
          var key = utils.pad256(stack.pop()),
            val = stack.pop();

          //if zero just make zero
          if (!parseInt(val.toString('hex'), 16)) {
            val = new Buffer([0]);
          }

          storageTrie.get(key, function (err, found) {
            if (val.toString('hex') === '00') {
              //deleting a value
              gasLeft = gasLeft.add(100);
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

            storageTrie.put(key, val, done);
          });
        }
      ],
      JUMP: [1,
        function (done) {
          pc = utils.bufferToInt(stack.pop());
          done();
        }
      ],
      JUMPI: [2,
        function (done) {
          var c = utils.bufferToInt(stack.pop()),
            i = utils.bufferToInt(stack.pop());

          pc = i ? c : pc;
          done();
        }
      ],
      PC: [0,
        function (done) {
          stack.push(bignum(pc).toBuffer());
          done();
        }
      ],
      MSIZE: [0,
        function (done) {
          stack.push(bignum(wordsInMem * 32).toBuffer());
          done();
        }
      ],
      GAS: [0,
        function (done) {
          stack.push(gasLeft.toBuffer());
          done();
        }
      ],
      PUSH: [0,
        function (done) {
          var numToPush = op - 0x5f,
            loaded = utils.unpad(opts.code.slice(pc, pc + numToPush));

          stack.push(loaded);
          pc += numToPush;
          done();
        }
      ],
      //'0xf0' range - closures
      CREATE: [3,
        function (done) {
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
              data: data
            };

          if (data === 'out of gas') {
            done(data);
            return;
          }

          if (bignum.fromBuffer(opts.account.balance).lt(value)) {
            done();
          } else {
            opts.account.nonce = bignum.fromBuffer(opts.account.nonce).add(1).toBuffer();

            async.series([
              //save the current account
              async.apply(self.trie.put.bind(self.trie), opts.address, opts.account.serialize()),
              //runs the call
              function (done2) {
                self.runCall(options, function (err, results) {
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
        function (done) {
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
              data: data
            },
            err = subMemUsage(outOffset, outLength);

          if (err === 'out of gas' || data === 'out of gas') {
            done('out of gas');
            return;
          }

          //does this account have enought ether?
          if (bignum.fromBuffer(opts.account.balance).lt(value)) {
            done();
          } else {
            async.series([
              //save the current account
              async.apply(self.trie.put.bind(self.trie), opts.address, opts.account.serialize()),
              function (done2) {
                self.runCall(options, function (err, results) {
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
      RETURN: [2,
        function (done) {
          var offset = utils.bufferToInt(stack.pop()),
            length = utils.bufferToInt(stack.pop());

          returnValue = memLoad(offset, length);
          stopped = true;
          done();
        }
      ],
      //'0x70', range - other
      SUICIDE: [0,
        function (done) {
          suicide = true;
          done();
        }
      ]
    };

  storageTrie.root = opts.account.stateRoot.length === 1 ? null : opts.account.stateRoot;

  //iterate throught the give ops untill something breaks or we hit STOP
  async.whilst(function () {
    return !stopped && pc < opts.code.length;
  }, function (done) {

    op = opts.code[pc];
    opcode = opcodes[op];
    //get fee, decrment gas left
    var fee = fees.getFee(opcode);

    async.series([
      //run the onStep hook
      function (done2) {
        if (self.onStep) {
          self.onStep({
              pc: pc,
              gasLeft: gasLeft,
              opcode: opcode,
              storageTrie: storageTrie,
              stack: stack
            },
            done2);
        } else {
          done2();
        }
      },
      //run the opcode
      function (done2) {

        gasLeft = gasLeft.sub(fee);
        pc++;

        if (!opcode) {
          done2('invalid opcode');
          return;
        }

        var match = opcode.match(/^(PUSH?|SWAP?|DUP)/);
        if (match) {
          opcode = match[0];
        }

        //do we still have gas?
        if (gasLeft.lt(0)) {
          done2('out of gas');
          return;
        }

        var opFunc = opFuncs[opcode];
        if ((opcode === 'SWAP' && op - 0x8f > stack.length) ||
          (opcode === 'DUP' && op - 0x7f > stack.length) ||
          (stack.length < opFunc[0])) {
          done2('stack underflow');
          return;
        }

        opFunc[1](done2);
      }
    ], done);

  }, function (err) {
    var gasUsed = bignum(opts.gasLimit).sub(gasLeft);
    if (err === 'out of gas') {
      gasUsed = opts.gasLimit;
    }

    //update the stateRoot on the account
    opts.account.stateRoot = storageTrie.root ? storageTrie.root : new Buffer([0]);

    var results = {
      gasUsed: gasUsed,
      suicide: suicide,
      account: opts.account,
      exception: err ? 0 : 1,
      exceptionErr: err,
      returnValue: returnValue
    };

    cb = cb.bind(this, err, results);

    if (err === 'out of gas') {
      self.trie.revert(cb);
    } else {
      self.trie.commit(cb);
    }
  });
};
