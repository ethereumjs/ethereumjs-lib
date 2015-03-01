const async = require('async');
const bignum = require('bignum');
const Bloom = require('../bloom.js');
const Account = require('../account.js');
const rlp = require('rlp');
const Trie = require('merkle-patricia-tree');

/**
 * process the transaction in a block and pays the miners
 * @param opts
 * @param opts.block {Block} the block we are processing
 * @param opts.blockchain {Blockchain} the current blockchain
 * @param opts.root {Buffer} the state root which to start from
 * @param opts.gen {Boolean} [gen=false] whether to generate
 * @param cb {Function} the callback which is given an error string
 */
module.exports = function(opts, cb) {

  var trie = this.trie;
  var self = this;
  var bloom = new Bloom();
  var receiptTrie = new Trie();
  var minerReward = bignum('1500000000000000000');
  var uncleReward = bignum('1406250000000000000');
  var nephewReward = bignum('46875000000000000');
  var r = bignum(0);
  var account;
  var block = opts.block;
  var gen = opts.gen;
  var blockchain = opts.blockchain;
  var root = opts.root;
  var logs = [];

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
        function setupRunTx(cb3) {

          if(bignum.fromBuffer(block.header.gasLimit).lt(bignum.fromBuffer(tx.gasLimit).add(gasUsed)))
            return cb3('tx has a higher gas limit than the block');

          //run the tx through the VM
          self.runTx({
              tx: tx,
              block: block,
              blockchain: blockchain
            },
            function(err, r) {
              results = r;

              if(!err){

                logs.push({
                  bloom: r.bloom,
                  logs: r.logs
                });

                gasUsed = gasUsed.add(results.gasUsed);

                //is the miner also the sender?
                if (block.header.coinbase.toString('hex') === tx.getSenderAddress().toString('hex')) {
                  account = results.callerAccount;
                }

                //is the miner also the receiver?
                if (block.header.coinbase.toString('hex') === tx.to.toString('hex')) {
                  account = results.toAccount;
                }

                //add the amount spent on gas to the miner's account
                account.balance = bignum
                  .fromBuffer(account.balance)
                  .add(results.amountSpent);

                //bitwise OR the blooms together
                bloom.or(r.bloom);
              }

              cb3(err);
            });
        },
        function saveMiner(cb3) {
          if (gen) {
            block.header.bloom = bloom.bitvector;
          }

          //save the miner's account
          trie.put(block.header.coinbase, account.serialize(), function(err) {
            cb3(err);
          });
        },
        //create the tx receipt
        function createTxReceipt(cb3) {
          var txLogs = results.vm.logs ? results.vm.logs : [];
          var tr = [trie.root, gasUsed.toBuffer(), results.bloom.bitvector, txLogs];

          receiptTrie.put(rlp.encode(i), rlp.encode(tr));
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

    if (!err && !opts.gen) {
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
      // console.log('ours:' + trie.root.toString('hex'));
      // console.log('thiers:' + block.header.stateRoot.toString('hex'));
      // trie.commit(cb.bind(cb, err));
    } else {
      if (gen) {
        block.header.stateRoot = trie.root;
      }

      trie.commit(function(err){
        cb(err,{logs: logs});
      });
    }
  });
};
