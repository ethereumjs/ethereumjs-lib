var async = require('async'),
  bignum = require('bignum'),
  Account = require('../account');

/**
 * Process a transaction. Run the vm. Transfers eth. checks balaces
 * @method processTx
 * @param {Transaciton} tx - a transaction
 * @param {Block} block needed to process the transaction
 * @param {Function} cb - the callback
 */
module.exports = function (tx, block, cb) {
  if (arguments.length === 2) {
    cb = block;
    block = null;
  }

  var self = this,
    fromAccount,
    results;

  //run the transaction hook
  function runTxHook(cb) {
    if (self.onTx) {
      self.onTx(tx, cb);
    } else {
      cb();
    }
  }

  //loads the sender's account
  function loadFromAccount(done) {
    self.trie.get(tx.getSenderAddress(), function (err, account) {
      fromAccount = new Account(account);
      done(err);
    });
  }

  //sets up the envorment and runs a `call`
  function runCall(done) {
    //check to the sender's account to make sure it has enought wei and the
    //correct nonce
    if (bignum.fromBuffer(fromAccount.balance).ge(tx.getUpfrontCost()) &&
      bignum.fromBuffer(fromAccount.nonce).eq(bignum.fromBuffer(tx.nonce))) {

      //increment the nonce
      fromAccount.nonce = bignum.fromBuffer(fromAccount.nonce).add(bignum(1)).toBuffer();

      var options = {
        from: new Buffer(tx.getSenderAddress(), 'hex'),
        fromAccount: fromAccount,
        gas: bignum.fromBuffer(tx.gasLimit).sub(tx.getBaseFee()),
        to: tx.to,
        value: bignum.fromBuffer(tx.value),
        gasPrice: tx.gasPrice,
        data: tx.data,
        block: block
      };

      if (tx.type === 'contract') {
        debugger;
        delete options.to;
      }

      //run call
      self.runCall(options, function (err, r) {
        results = r;
        done(err);
      });
    } else {
      done('sender doesn\' have correct nonce or balance');
    }
  }

  //saves the send's account in the trie
  function saveFromAccount(done) {
    //subtract the amount spent on gas
    fromAccount.balance = bignum.fromBuffer(fromAccount.balance)
      .sub(tx.getBaseFee().mul(bignum.fromBuffer(tx.gasPrice)))
      .sub(results.gasUsed.mul(bignum.fromBuffer(tx.gasPrice)))
      .toBuffer();

    results.gasUsed = results.gasUsed.add(tx.getBaseFee());
    results.amountSpent = results.gasUsed.mul(bignum.fromBuffer(tx.gasPrice));
    self.trie.put(new Buffer(tx.getSenderAddress(), 'hex'), fromAccount.serialize(), done);
  }

  //run everything
  async.series([
    runTxHook,
    loadFromAccount,
    runCall,
    saveFromAccount
  ], function (err) {
    cb(err, results);
  });
};
