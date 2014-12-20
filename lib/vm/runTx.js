var async = require('async'),
  bignum = require('bignum'),
  Bloom = require('../bloom.js'),
  Account = require('../account');

/**
 * @method txLogsBloom
 */
function txLogsBloom(logs) {

  var bloom = new Bloom();

  if (logs) {
    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];
      //add the address
      bloom.add(log[0]);
      //add the topics
      var topics = log[1];
      for (var q = 0; q < topics.length; q++) {
        bloom.add(topics[q]);
      }
    }
  }

  return bloom;
}

/**
 * Process a transaction. Run the vm. Transfers eth. checks balaces
 * @method processTx
 * @param {Transaciton} tx - a transaction
 * @param {Block} block needed to process the transaction
 * @param {Function} cb - the callback
 */
module.exports = function(tx, block, cb) {
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
    self.trie.get(tx.getSenderAddress(), function(err, account) {
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
        delete options.to;
      }

      //run call
      self.runCall(options, function(err, r) {
        //generate the bloom for the tx
        r.bloom = txLogsBloom(r.vm.logs);

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
    results.gasUsed = results.gasUsed.add(tx.getBaseFee());

    var gasRefund = results.vm.gasRefund;

    //refund the account
    if (gasRefund) {
      if (gasRefund.lt(results.gasUsed.div(2))) {
        results.gasUsed = results.gasUsed.sub(gasRefund);
      } else {
        results.gasUsed = results.gasUsed.sub(results.gasUsed.div(2));
      }
    }

    fromAccount.balance = bignum.fromBuffer(fromAccount.balance)
      .sub(results.gasUsed.mul(bignum.fromBuffer(tx.gasPrice)))
      .toBuffer();

    results.fromAccount = fromAccount;
    results.amountSpent = results.gasUsed.mul(bignum.fromBuffer(tx.gasPrice));

    self.trie.put(new Buffer(tx.getSenderAddress(), 'hex'), fromAccount.serialize(), done);
  }

  //run everything
  async.series([
    runTxHook,
    loadFromAccount,
    runCall,
    loadFromAccount,
    saveFromAccount
  ], function(err) {
    cb(err, results);
  });
};
