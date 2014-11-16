var async = require('async'),
  bignum = require('bignum'),
  Bloom = require('../bloom.js'),
  Account = require('../account.js'),
  rlp = require('rlp'),
  utils = require('../utils.js'),
  Trie = require('merkle-patricia-tree');

/**
 * process the transaction in a block and pays the miners
 * @param {Block} block the block we are processing
 * @param {Buffer} root the state root which to start from
 * @param {Boolean} [gen=false] whether to generate
 * @param {Function} cb the callback which is given an error string
 */
module.exports = function(block, root, gen, cb) {

  if (arguments.length === 3) {
    cb = gen;
    gen = false;
  }

  var trie = this.trie,
    self = this,
    bloom = new Bloom(),
    receiptTrie = new Trie(),
    minerReward = bignum('1500000000000000000'),
    uncleReward = bignum('1406250000000000000'),
    nephewReward = bignum('46875000000000000'),
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
    var gasUsed = bignum(0), //the totally amount of gas used processing this block
      results,
      i = 0;

    async.eachSeries(block.transactions, function(tx, cb2) {
      async.series([
        function(cb3) {
          //run the tx through the VM
          self.runTx(tx, block, function(err, r) {
            results = r;
            gasUsed = gasUsed.add(results.gasUsed);

            //is the miner also the sender?
            if (block.header.coinbase.toString('hex') === tx.getSenderAddress().toString('hex')) {
              account = results.fromAccount;
            }

            //is the miner also the receiver?
            if (block.header.coinbase.toString('hex') === tx.to.toString('hex')) {
              account = results.toAccount;
            }

            //add the amount spent on gas to the miner's account
            account.balance = bignum
              .fromBuffer(account.balance)
              .add(results.amountSpent);

            //or the blooms together
            if (results.bloom) {
              bloom = (bignum.fromBuffer(bloom).or(bignum.fromBuffer(results.bloom))).toBuffer();
            }
            cb3(err);
          });
        },
        function(cb3) {
          //save the miner's account
          trie.put(block.header.coinbase, account.serialize(), function(err) {
            if (gen) {
              block.header.bloom = bloom;
              block.transactionReceipts[i].state = trie.root;
            }

            cb3(err);
          });
        },
        function(cb3) {
          //incerment the tx counter
          var tr = [trie.root, gasUsed.toBuffer(), utils.zeros(64), []];
          receiptTrie.put(rlp.encode(new Buffer([i])), rlp.encode(tr));
          i++;
          cb3();
        }
      ], cb2);

    }, cb);
  }

  //get the miners account
  function getMinerAccount(cb) {
    trie.get(block.header.coinbase, function(err, rawAccount) {
      account = new Account(rawAccount);
      cb(err);
    });
  }

  //give the uncles thiers payout
  function payUncles(cb) {
    //iterate over the uncles
    async.each(block.uncleHeaders, function(uncle, cb2) {
      //acculmulate the nephewReward
      r = r.add(nephewReward);

      //get the miners account
      if (uncle.coinbase.toString('hex') === block.header.coinbase.toString('hex')) {

        account.balance = bignum.fromBuffer(account.balance)
          .add(uncleReward)
          .toBuffer();

        cb2();

      } else {
        trie.get(uncle.coinbase, function(err, rawAccount) {
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

  //gives the mine the block reward and saves the miners account
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
  ], function(err) {

    if (!err) {
      if (receiptTrie.root && receiptTrie.root.toString('hex') !== block.header.receiptTrie.toString('hex')) {
        err = 'invalid receiptTrie';
      } else if (bloom.bitvector.toString('hex') !== block.header.bloom.toString('hex')) {
        err = 'invalid bloom';
      } else if (trie.root.toString('hex') !== block.header.stateRoot.toString('hex')) {
        err = 'invalid block stateRoot';
      }
    }

    if (err) {
      trie.revert();
      cb(err);
    } else {
      if (gen) {
        block.header.stateRoot = trie.root;
      }
      trie.commit(cb);
    }
  });
};
