const async = require('async');
const bignum = require('bignum');
const Account = require('../account');
const utils = require('ethereumjs-util');

/**
 * runs a CALL operation
 * @method runCall
 * @param opts
 * @param opts.account {Account}
 * @param opts.block {Block}
 * @param opts.blockchain {Blockchain} needed to for BLOCKHASH
 * @param opts.caller {Buffer}
 * @param opts.code {Buffer} this is for CALLCODE where the code to load is different than the code from the to account.
 * @param opts.data {Buffer}
 * @param opts.gas {Bignum}
 * @param opts.gasPrice {Bignum}
 * @param opts.origin {Buffer} []
 * @param opts.to {Buffer}
 * @param opts.value {Bignum}
 */
module.exports = function(opts, cb) {
  var self = this;
  var fromAccount = opts.account;
  var toAccount;
  var data;
  var code = opts.code;
  var vmResults = {};
  var createdAddress;
  var gasUsed = bignum(0);

  //set default values
  if(!opts.value){
    opts.value = bignum(0);
  }

  fromAccount.balance = bignum.fromBuffer(fromAccount.balance).sub(opts.value).toBuffer();

  async.series([
      //save the current account. We need to do this becase we could be calling recursivly
      async.apply(self.trie.put.bind(self.trie), opts.caller, opts.account.serialize()),
      function(cb2) {
        //get receiver's account
        if (!opts.to) {
          //creating a contract if no `to`
          code = opts.data;
          createdAddress = opts.to = utils.generateAddress(opts.caller, fromAccount.nonce);
          toAccount = new Account();
          cb2(null, toAccount);
        } else {
          //else load the to account
          data = opts.data;
          self.trie.get(opts.to, function(err, account) {
            toAccount = new Account(account);
            cb2(err);
          });
        }
      },
      function(cb2) {
        //loads the contract's code
        if (!code && toAccount.isContract()) {
          toAccount.getCode(self.trie, function(err, c){
            code = c;
            cb2(err);
          });
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

        var oldStateRoot = toAccount.stateRoot;
        var oldBalace = toAccount.balance;

        //run precompiled contracts
        var extResults = self.runExtension(opts);
        if (extResults) {
          gasUsed = extResults.gasUsed;
          vmResults = extResults;
          cb2();
        }else if (code) {
          //run Code through vm
          self.runCode({
            code: code,
            data: data,
            gasLimit: opts.gas,
            gasPrice: opts.gasPrice,
            account: toAccount,
            address: opts.to,
            origin: opts.origin,
            caller: opts.caller,
            value: opts.value,
            block: opts.block,
            depth: opts.depth,
            blockchain: opts.blockchain
          }, function(err, results) {

            if(results.exceptionErr){
              results.account.stateRoot = oldStateRoot;
              results.account.balance = oldBalace;
            }

            if(results.exceptionErr === 'out of gas'){
              delete results.gasRefund;
            }

            if(createdAddress){
              var returnFee = results.gasUsed.add(results.returnValue.length * 5);
              if(returnFee.lt(opts.gas)){
                results.gasUsed = returnFee;
              }else{
                results.returnValue = new Buffer([]);
              }
            }

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
        if (!vmResults.exceptionErr && createdAddress && vmResults.returnValue.toString() !== '') {
          toAccount.storeCode(self.trie, vmResults.returnValue, cb2);
        } else {
          cb2();
        }
      },
      function(cb2) {
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

        } else {
          //save the to account
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
