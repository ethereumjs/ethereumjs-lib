const async = require('async');
const BN = require('bn.js');
const Account = require('../account');
const utils = require('ethereumjs-util');
const Set = require('es6-set');

/**
 * runs a CALL operation
 * @method runCall
 * @param opts
 * @param opts.account {Account}
 * @param opts.block {Block}
 * @param opts.caller {Buffer}
 * @param opts.code {Buffer} this is for CALLCODE where the code to load is different than the code from the to account.
 * @param opts.data {Buffer}
 * @param opts.gasLimit {Bignum}
 * @param opts.gasPrice {Bignum}
 * @param opts.origin {Buffer} []
 * @param opts.to {Buffer}
 * @param opts.value {Bignum}
 */
module.exports = function(opts, cb) {
  var self = this;
  var toAccount;
  var data;
  var compiled = false; //is the code compiled or not?
  var vmResults = {};
  var createdAddress;
  var gasUsed = new BN(0);

  function setup(cb2){

    //set default values
    if (!opts.value) {
      opts.value = new BN(0);
    }

    if (!opts.to || opts.caller.toString('hex') !== opts.to.toString('hex')) {
      opts.account.balance = new Buffer((new BN(opts.account.balance).sub(opts.value)).toArray());
    }
   
    //save caller
    self.cache.put(opts.caller, opts.account);

    self.trie.checkpoint();
    self.cache.checkpoint();


    //get receiver's account
    if (!opts.to) {
      //creating a contract if no `to`
      opts.code = opts.data;
      createdAddress = opts.to = utils.generateAddress(opts.caller, opts.account.nonce);
      toAccount = new Account();
    } else {
      //else load the to account
      data = opts.data;
      toAccount = self.cache.get(opts.to);
    }

    // if(opts.populateCache === false)
    return cb2();

    console.log('populateCache');

    var accounts = new Set();
    accounts.add(opts.caller.toString('hex'));
    accounts.add(opts.to.toString('hex'));
    self.populateCache(accounts, cb2);
  }

  function loadCode(cb2) {
    //loads the contract's code if the account is a contract
    if ((!opts.code && toAccount.isContract()) || toAccount.isPrecompiled(opts.to)) {
      toAccount.getCode(self.trie, opts.to, function(err, c, comp) {
        opts.compiled = comp;
        opts.code = c;
        cb2(err);
      });
    } else {
      cb2();
    }
  }

  function runCode(cb2) {
    //add the amount sent to the `to` account
    if (opts.caller.toString('hex') !== opts.to.toString('hex')) {
      toAccount.balance = new Buffer(new BN(toAccount.balance)
        .add(opts.value)
        .toArray());
    }

    if (opts.code) {
      var oldStateRoot = toAccount.stateRoot;
      var oldBalace = toAccount.balance;
      var oldNonce = toAccount.nonce;
      var runCodeOpts = {
        code: opts.code,
        data: data,
        gasLimit: opts.gasLimit,
        gasPrice: opts.gasPrice,
        account: toAccount,
        address: opts.to,
        origin: opts.origin,
        caller: opts.caller,
        value: opts.value,
        block: opts.block,
        depth: opts.depth
      };
      var codeRunner = opts.compiled ? self.runJIT : self.runCode;

      //run Code through vm
      codeRunner.call(self, runCodeOpts, function(err, results) {

        toAccount = results.account;
        vmResults = results;

        if (results.exceptionErr) {
          results.account.stateRoot = oldStateRoot;
          results.account.balance = oldBalace;
          results.account.nonce = oldNonce;

          if (!opts.to || opts.caller.toString('hex') !== opts.to.toString('hex')) {
            opts.account.balance = new Buffer((new BN(opts.account.balance).add(opts.value)).toArray());
          }
  
          toAccount.balance = new Buffer(new BN(toAccount.balance)
            .sub(opts.value)
            .toArray());
        }

        if (createdAddress) {
          //TODO:
          var returnFee = results.gasUsed.add(new BN(results.returnValue.length * 200));
          if (returnFee.cmp(opts.gasLimit) <= 0) {
            results.gasUsed = returnFee;
          } else {
            results.returnValue = new Buffer([]);
          }
        }

        gasUsed = results.gasUsed;

        if (results.exceptionErr) {
          self.cache.revert();
          self.trie.revert(cb2);
        } else {
          self.cache.commit();
          self.trie.commit(cb2);
        }
      });
    } else {
      cb2();
    }
  }

  function saveCode(cb2) {
    //store code for a new contract
    if (!vmResults.exceptionErr && createdAddress && vmResults.returnValue.toString() !== '') {
      toAccount.storeCode(self.trie, vmResults.returnValue, cb2);
    } else {
      cb2();
    }
  }

  async.series([
      setup,
      loadCode,
      runCode,
      saveCode
    ],
    function(err) {
      //save from account
      

      if(vmResults.exceptionErr){
        self.cache.put(opts.caller, opts.account);
      }

      //save the to account
      self.cache.put(opts.to, toAccount);

      var results = {
        gasUsed: gasUsed,
        fromAccount: opts.account,
        toAccount: toAccount,
        createdAddress: createdAddress,
        vm: vmResults
      };

      if (results.vm.exception === undefined) {
         results.vm.exception = 1;
       }

      cb(err, results);
    });
};
