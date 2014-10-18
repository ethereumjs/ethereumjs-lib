var SHA3 = require('sha3'),
  async = require('async'),
  bignum = require('bignum'),
  rlp = require('rlp'),
  Account = require('../account'),
  Trie = require('merkle-patricia-tree');

/**
 * @constructor
 */
var VM = module.exports = function (trie) {

  if (trie.constructor !== Trie) {
    trie = new Trie(trie);
  }

  this.trie = trie;
};

VM.prototype.runCode = require('./runCode.js');
VM.prototype.runBlock = require('./runBlock.js');
VM.prototype.runTx = require('./runTx.js');

/**
 * runs a CALL operation
 * @method runCall
 * @param opts
 * @param opts.to {Buffer}
 * @param opts.from {Buffer}
 * @param opts.origin {Buffer} []
 * @param opts.fromAccount {Account}
 * @param opts.value {Bignum}
 * @param opts.gasPrice {Bignum}
 * @param opts.gas {Bignum}
 * @param opts.data {Buffer}
 * @param opts.block {Block}
 */
VM.prototype.runCall = function (opts, cb) {
  var self = this,
    fromAccount = opts.fromAccount,
    toAccount,
    data,
    code,
    vmResults,
    createdAddress,
    gasUsed = bignum(0);

  //subcract the the amount sent
  fromAccount.balance = bignum.fromBuffer(fromAccount.balance)
    .sub(opts.value)
    .toBuffer();


  //make sure we are sending to a valid address
  if (opts.to && opts.to.length > 20) {
    opts.to = opts.to.slice(opts.to.length - 20);
  }

  async.series([

      function (cb2) {
        //get receiver's account
        if (!opts.to) {
          //creating a contract if no `to`
          code = opts.data;
          createdAddress = opts.to = VM.generateAddress(opts.from, fromAccount.nonce);
          toAccount = new Account();
          cb2(null, toAccount);
        } else {
          data = opts.data;
          if (opts.to.toString('hex') !== opts.from.toString('hex')) {
            self.trie.get(opts.to, function (err, account) {
              toAccount = new Account(account);
              cb2(err, toAccount);
            });
          } else {
            toAccount = fromAccount;
            cb2(null, toAccount);
          }
        }
      },
      function (cb2) {
        //loads the contranct's code
        if (!code && toAccount.isContract()) {
          self.trie.db.get(toAccount.codeHash, {
              encoding: 'binary'
            },
            function (err, c) {
              code = c;
              cb2(err);
            });
        } else {
          cb2();
        }
      },
      function (cb2) {
        //run VM
        if (code) {
          self.runCode({
            code: code,
            data: data,
            gasLimit: opts.gas,
            gasPrice: opts.gasPrice,
            account: toAccount,
            address: opts.to,
            origin: opts.origin,
            from: opts.from,
            block: opts.block
          }, function (err, results) {

            if (err) {
              err = null;
            }

            toAccount = results.account;
            gasUsed = results.gasUsed;
            vmResults = results;
            cb2();
          });
        } else {
          cb2();
        }
      },
      function (cb2) {
        //store code for a new contract
        if (createdAddress && vmResults.returnValue.toString() !== '') {
          var newCode = vmResults.returnValue,
            hash = new SHA3.SHA3Hash(256);

          hash.update(newCode);
          toAccount.codeHash = hash.digest('hex');

          self.trie.db.put(toAccount.codeHash, newCode, {
            enoding: 'binary'
          }, cb2);
        } else {
          cb2();
        }
      },
      function (cb2) {
        //add the amount sent to the `to` account
        toAccount.balance = bignum
          .fromBuffer(toAccount.balance)
          .add(opts.value)
          .toBuffer();

        //removes the sucidail account
        if (vmResults && vmResults.suicide) {
          var suicideToAccount;
          //toAccount.balance;
          async.series([
            //load to account
            function (done) {
              self.trie.get(vmResults.suicideTo, function (err, rawAccount) {
                suicideToAccount = new Account(rawAccount);
                done(err);
              });
            },
            //save the account of the heir
            function (done) {
              //add to the balance
              suicideToAccount.balance = bignum.fromBuffer(suicideToAccount.balance)
                .add(bignum.fromBuffer(toAccount.balance))
                .toBuffer();

              self.trie.put(vmResults.suicideTo, suicideToAccount.serialize(), done);
            },
            self.trie.del.bind(self.trie, opts.to)
          ], cb2);

        } else if ( vmResults && vmResults.exceptionErr === 'out of gas' && opts.value.toString() === '0') {
          //don't have the to account if out of gas
          cb2();
        } else {
          //save to account
          self.trie.put(opts.to, toAccount.serialize(), cb2);
        }
      }
    ],
    function (err) {
      var results = {
        gasUsed: gasUsed,
        fromAccount: fromAccount,
        toAccount: toAccount,
        createdAddress: createdAddress,
        vm: vmResults
      };

      cb(err, results);
    });
};

VM.prototype.generateGenesis = function (cb) {
  var self = this,
    addresses = [
      '1a26338f0d905e295fccb71fa9ea849ffa12aaf4',
      'b9c015918bdaba24b4ff057a92a3873d6eb201be',
      '2ef47100e0787b915105fd5e3f4ff6752079d5cb',
      '51ba59315b3a95761d0863b05ccc7a7f54703d99',
      '6c386a4b26f73c802f34673f7248bb118f97424a',
      'cd2a3d9f938e13cd947ec05abc7fe734df8dd826',
      'e4157b34ea9615cfbde6b4fda419828124b70c78',
      'e6716f9544a56c530d868e4bfbacb172315bdead'
    ];

  this.trie.checkpoint();

  async.each(addresses, function (address, done) {
    var account = new Account(),
      startAmount = new Buffer(26);

    startAmount.fill(0);
    startAmount[0] = 1;
    account.balance = startAmount;

    self.trie.put(new Buffer(address, 'hex'), account.serialize(), function () {
      done();
    });

  }, function (err) {
    if (!err) {
      self.trie.commit(cb);
    } else {
      self.trie.revert();
      cb(err);
    }
  });
};

//generates an address for a new contract
VM.generateAddress = function (from, nonce) {
  nonce = bignum.fromBuffer(nonce).sub(1).toBuffer();
  var hash = new SHA3.SHA3Hash(256);
  hash.update(rlp.encode([new Buffer(from, 'hex'), nonce]));
  return new Buffer(hash.digest('hex').slice(24), 'hex');
};
