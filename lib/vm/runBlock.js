var async = require('async'),
  bignum = require('bignum'),
  Account = require('../account.js');

/**
 * process the transaction in a block and pays the miners
 * @param {Block} block the block we are processing
 * @param {Buffer} root the state root which to start from
 * @param {Boolean} [gen=false] whether to generate
 * @param {Function} cb the callback which is given an error string
 */
module.exports = function (block, root, gen, cb) {

  if (arguments.length === 3) {
    cb = gen;
    gen = false;
  }

  var trie = this.trie,
    self = this,

    //1500 Finney
    minerReward = bignum('1500000000000000000'),
    uncleReward = bignum('1406250000000000000'),
    nephewReward = bignum('46875000000000000'),

    //?
    r = bignum(0),
    account;

  this.block = block;

  trie.checkpoint();
  if (root) trie.root = root;

  /**
   * Processes all of the transaction in the block
   * @method processTransaction
   * @param {Function} cb the callback is given error if there are any
   */
  function processTransactions(cb) {
    //the totally amount of gas used processing this block
    var gasUsed = bignum(0),
      results,
      i = 0;

    async.eachSeries(block.transactionReceipts, function (tr, cb2) {
      async.series([
        //run the tx through the VM
        function (cb3) {
          self.runTx(tr.transaction, block, function (err, r) {
            results = r;
            cb3(err);
          });
        },
        //update the miner's account
        function (cb3) {
          gasUsed = gasUsed.add(results.gasUsed);

          //is the miner also the sender?
          if (block.header.coinbase.toString('hex') === tr.transaction.getSenderAddress().toString('hex')) {
            account = results.fromAccount;
          }

          //is the miner also the receiver?
          if (block.header.coinbase.toString('hex') === tr.transaction.to.toString('hex')) {
            account = results.toAccount;
          }

          //add the amount spent on gas to the mine's account
          account.balance = bignum
            .fromBuffer(account.balance)
            .add(results.amountSpent);

          //save the miner's account
          trie.put(block.header.coinbase, account.serialize(), function (err) {
            if (gen) {
              block.transactionReceipts[i].state = trie.root;
              i++;
            } else {
              if (tr.state.toString('hex') !== trie.root.toString('hex')) {
                err = 'state hash doesn\'t match the state hash from the transaction receipt';
              } else if (!bignum.fromBuffer(tr.gasUsed).eq(gasUsed)) {
                err = 'gas used does not match amount from the transaction receipt';
              }
            }
            cb3(err);
          });
        }
      ], cb2);

    }, cb);
  }

  //get the miners account
  function getMinerAccount(cb) {
    trie.get(block.header.coinbase, function (err, rawAccount) {
      account = new Account(rawAccount);
      cb(err);
    });
  }

  //give the uncles thiers payout
  function payUncles(cb) {
    //iterate over the uncles
    async.each(block.uncleHeaders, function (uncle, cb2) {
      //acculmulate the nephewReward
      r = r.add(nephewReward);

      //get the miners account
      if (uncle.coinbase.toString('hex') === block.header.coinbase.toString('hex')) {

        account.balance = bignum.fromBuffer(account.balance)
          .add(uncleReward)
          .toBuffer();

        cb2();

      } else {
        trie.get(uncle.coinbase, function (err, rawAccount) {
          if (!err) {
            var uncleAccount = new Account(rawAccount);
            uncleAccount.balance = bignum.fromBuffer(uncleAccount.balance)
              .add(uncleReward)
              .toBuffer();

            trie.put(uncle.coinbase, uncleAccount.serialize(), cb2);
          } else {
            cb2(err);
          }
        });
      }
    }, cb);
  }

  function saveMinerAccount(cb) {
    account.balance = bignum
      .fromBuffer(account.balance)
      .add(minerReward)
      .add(r) //add the accumlated nephewReward
    .toBuffer();

    trie.put(block.header.coinbase, account.serialize(), cb);
  }

  //run everything
  async.series([
    getMinerAccount,
    processTransactions,
    payUncles,
    saveMinerAccount
  ], function (err) {
    if (err) {
      trie.revert();
      cb(err);
    } else if (!gen && trie.root.toString('hex') !== block.header.stateRoot.toString('hex')) {
      trie.revert();
      cb('invalid block stateRoot');
    } else {
      if (gen) {
        block.header.stateRoot = trie.root;
      }
      trie.commit(cb);
    }
  });
};
