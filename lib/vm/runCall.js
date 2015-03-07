const async = require('async');
const BN = require('bn.js');
const Account = require('../account');
const utils = require('ethereumjs-util');

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
  var fromAccount = opts.account;
  var toAccount;
  var data;
  var code = opts.code;
  var compiled = false; //is the code compiled or not?
  var vmResults = {};
  var createdAddress;
  var gasUsed = new BN(0);

  //set default values
  if (!opts.value) {
    opts.value = new BN(0);
  }

  fromAccount.balance = new Buffer((new BN(fromAccount.balance).sub(opts.value)).toArray());

  function getToAccount(cb2) {
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
  }

  function loadCode(cb2) {
    //loads the contract's code if the account is a contract
    if ((!code && toAccount.isContract()) || toAccount.isPrecompiled(opts.to)) {
      toAccount.getCode(self.trie, opts.to, function(err, c, comp) {
        compiled = comp;
        code = c;
        cb2(err);
      });
    } else {
      cb2();
    }
  }


  function runCode(cb2) {
    //add the amount sent to the `to` account
    toAccount.balance = new Buffer(new BN(toAccount.balance)
      .add(opts.value)
      .toArray());

    if (code) {
      var oldStateRoot = toAccount.stateRoot;
      var oldBalace = toAccount.balance;
      var runCodeOpts = {
        code: code,
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
      var codeRunner = compiled ? self.runJIT : self.runCode;

      //run Code through vm
      codeRunner.call(self, runCodeOpts, function(err, results) {
        if (results.exceptionErr) {
          results.account.stateRoot = oldStateRoot;
          results.account.balance = oldBalace;
        }

        if (createdAddress) {
          var returnFee = results.gasUsed.add(new BN(results.returnValue.length * 5));
          if (returnFee.cmp(opts.gasLimit) <= 0) {
            results.gasUsed = returnFee;
          } else {
            results.returnValue = new Buffer([]);
          }
        }

        toAccount = results.account;
        gasUsed = results.gasUsed;

        vmResults = results;
        cb2();
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

  function saveToAccount(cb2) {
    //save the to account
    self.trie.put(opts.to, toAccount.serialize(), cb2);
  }

  async.series([
      //save the current account. We need to do this becase we could be calling recursivly
      async.apply(self.trie.put.bind(self.trie), opts.caller, opts.account.serialize()),
      getToAccount,
      loadCode,
      runCode,
      saveCode,
      saveToAccount
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
