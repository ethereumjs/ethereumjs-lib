const async = require('async');
const BN = require('bn.js');
const Bloom = require('../bloom.js');
const Account = require('../account');
const assert = require('assert');

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
 * @param opts
 * @param opts.tx {Transaciton} - a transaction
 * @param opts.block {Block} needed to process the transaction
 * @param opts.blockchain {Blockchain} needed to for BLOCKHASH
 * @param cb {Function} - the callback
 */
module.exports = function(opts, cb) {

  var self = this,
    block = opts.block,
    tx = opts.tx,
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

      var c = self.cache.get(tx.getSenderAddress());

      assert(fromAccount.balance.toString('hex') === c.balance.toString('hex'))
      assert(fromAccount.nonce.toString('hex') === c.nonce.toString('hex'))
      assert(fromAccount.codeHash.toString('hex') === c.codeHash.toString('hex'))
      assert(fromAccount.stateRoot.toString('hex') === c.stateRoot.toString('hex'))

      done(err);
    });
  }

  //sets up the envorment and runs a `call`
  function runCall(done) {
    //check to the sender's account to make sure it has enought wei and the
    //correct nonce
    if (new BN(fromAccount.balance).cmp(tx.getUpfrontCost()) >= 0 &&
      new BN(fromAccount.nonce).cmp(new BN(tx.nonce)) === 0 ) {

      //increment the nonce
      fromAccount.nonce = new BN(fromAccount.nonce).add(new BN(1));

      var gasLimit = new BN(tx.gasLimit).sub(tx.getBaseFee());

      fromAccount.balance = new BN(fromAccount.balance).sub(new BN(tx.gasLimit).mul(new BN(tx.gasPrice )));

      var options = {
        caller: new Buffer(tx.getSenderAddress(), 'hex'),
        account: fromAccount,
        gasLimit: gasLimit,
        gasPrice: tx.gasPrice,
        to: tx.to,
        value: new BN(tx.value),
        data: tx.data,
        block: block,
        blockchain: opts.blockchain
      };

      if (tx.to.toString('hex') === '') {
        delete options.to;
      }

      //run call
      self.runCall(options, function(err, r) {
        //generate the bloom for the tx
        r.bloom = txLogsBloom(r.vm.logs);

        if(r.vm.logs && r.vm.logs.length){
          self.emit('logs', { logs: r.vm.logs, bloom: r.bloom});
        }

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
      if (gasRefund.cmp(results.gasUsed.div(new BN(2))) === -1 ) {
        results.gasUsed = results.gasUsed.sub(gasRefund);
      } else {
        results.gasUsed = results.gasUsed.sub(results.gasUsed.div(new BN(2)));
      }
    }

    var gasLimit = new BN(tx.gasLimit);

    //refund the left over gas amount
    fromAccount.balance = new BN(fromAccount.balance)
      .add(gasLimit.sub(results.gasUsed).mul(new BN(tx.gasPrice)));

    results.callerAccount = fromAccount;
    results.amountSpent = results.gasUsed.mul(new BN(tx.gasPrice));

    self.cache.put(new Buffer(tx.getSenderAddress(), 'hex'), fromAccount);
    self.trie.put(new Buffer(tx.getSenderAddress(), 'hex'), fromAccount.serialize(), done);
  }

  function rewardSuicides(done){

    if(!results.vm.suicides){
      results.vm.suicides = [];
    }

    async.eachSeries(results.vm.suicides, function(s, cb2){
      var suicideToAccount;
      var suicideAccount;
      //toAccount.balance;
      async.series([
        function(cb3) {
          self.trie.get(s.account, function(err, rawAccount) {

            suicideAccount = new Account(rawAccount);

            var c = self.cache.get(s.account);

            assert(suicideAccount.balance.toString('hex') === c.balance.toString('hex'))
            assert(suicideAccount.nonce.toString('hex') === c.nonce.toString('hex'))
            assert(suicideAccount.codeHash.toString('hex') === c.codeHash.toString('hex'))
            assert(suicideAccount.stateRoot.toString('hex') === c.stateRoot.toString('hex'))

            cb3(err);
          });
        },
        //load to account
        function(cb3) {

          self.cache.getOrLoad(s.to, function(err, c){
            self.trie.get(s.to, function(err, rawAccount) {
              suicideToAccount = new Account(rawAccount);

              assert(suicideToAccount.balance.toString('hex') === c.balance.toString('hex'))
              assert(suicideToAccount.nonce.toString('hex') === c.nonce.toString('hex'))
              assert(suicideToAccount.codeHash.toString('hex') === c.codeHash.toString('hex'))
              assert(suicideToAccount.stateRoot.toString('hex') === c.stateRoot.toString('hex'))

              cb3(err);
            });
          });
        },
        //save the account of the heir
        function(cb3) {
          //add to the balance
          suicideToAccount.balance = new BN(suicideToAccount.balance)
            .add(new BN(suicideAccount.balance));

          self.cache.put(s.to, suicideToAccount);
          self.trie.put(s.to, suicideToAccount.serialize(), cb3);
        },
        function(cb3){
          self.cache.del(s.account);
          self.trie.del(s.account, cb3);
        }
      ], cb2);
    }, done);
  }

  //run everything
  async.series([
    runTxHook,
    loadFromAccount,
    runCall,
    loadFromAccount,
    saveFromAccount,
    rewardSuicides
  ], function(err) {
    cb(err, results);
  });
};
