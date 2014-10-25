const SHA3 = require('sha3'),
  async = require('async'),
  bignum = require('bignum'),
  Account = require('../account'),
  utils = require('../utils.js');

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
module.exports = function(opts, cb) {
  var self = this,
    fromAccount = opts.fromAccount,
    toAccount,
    data,
    code,
    vmResults,
    createdAddress,
    gasUsed = bignum(0);

  //subtract the the amount sent
  fromAccount.balance = bignum.fromBuffer(fromAccount.balance)
    .sub(opts.value)
    .toBuffer();

  //make sure we are sending to a valid address
  if (opts.to && opts.to.length > 20) {
    opts.to = opts.to.slice(opts.to.length - 20);
  }

  async.series([
      //save the current account
      async.apply(self.trie.put.bind(self.trie), opts.from, opts.fromAccount.serialize()),

      function(cb2) {
        //get receiver's account
        if (!opts.to) {
          //creating a contract if no `to`
          code = opts.data;
          createdAddress = opts.to = utils.generateAddress(opts.from, fromAccount.nonce);
          toAccount = new Account();
          cb2(null, toAccount);
        } else {
          data = opts.data;
          if (opts.to.toString('hex') !== opts.from.toString('hex')) {
            self.trie.get(opts.to, function(err, account) {
              toAccount = new Account(account);
              cb2(err, toAccount);
            });
          } else {
            toAccount = fromAccount;
            cb2(null, toAccount);
          }
        }
      },
      function(cb2) {
        //loads the contranct's code
        if (!code && toAccount.isContract()) {
          self.trie.db.get(toAccount.codeHash, {
              encoding: 'binary'
            },
            function(err, c) {
              code = c;
              cb2(err);
            });
        } else {
          cb2();
        }
      },
      function(cb2) {
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
          }, function(err, results) {

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
      function(cb2) {
        //store code for a new contract
        if (createdAddress && vmResults.returnValue.toString() !== '') {
          var newCode = vmResults.returnValue,
            hash = new SHA3.SHA3Hash(256);

          hash.update(newCode);
          toAccount.codeHash = hash.digest('hex');

          self.trie.db.put(toAccount.codeHash, newCode, {
            encoding: 'binary'
          }, cb2);
        } else {
          cb2();
        }
      },
      function(cb2) {

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
            function(done) {
              self.trie.get(vmResults.suicideTo, function(err, rawAccount) {
                suicideToAccount = new Account(rawAccount);
                done(err);
              });
            },
            //save the account of the heir
            function(done) {
              //add to the balance
              suicideToAccount.balance = bignum.fromBuffer(suicideToAccount.balance)
                .add(bignum.fromBuffer(toAccount.balance))
                .toBuffer();

              self.trie.put(vmResults.suicideTo, suicideToAccount.serialize(), done);
            },
            self.trie.del.bind(self.trie, opts.to)
          ], cb2);

        }
        // else if (vmResults && vmResults.exceptionErr === 'out of gas') {
        //   //don't have the to account if out of gas
        //   cb2();
        // }
        else {

          //save to account
          self.trie.put(opts.to, toAccount.serialize(), cb2);
        }
      }
    ],
    function(err) {
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
