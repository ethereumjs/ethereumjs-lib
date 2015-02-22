const async = require('async'),
  bignum = require('bignum'),
  VM = require('../lib/vm'),
  Account = require('../lib/account.js'),
  Bloom = require('../lib/bloom.js'),
  testUtil = require('./util'),
  blockchain = require('./fakeBlockChain.js'),
  Trie = require('../index.js').Trie;

module.exports = function runStateTest(testData, options, cb) {

  var t = options.t;
  var sstream = false;
  var state = new Trie();
  var errored = false;
  var block;

  async.series([
    function(done) {
      testUtil.setupPreConditions(state, testData, done);
    },
    function(done) {

      var vm = new VM(state);
      var tx = testUtil.makeTx(testData.transaction);

      block = testUtil.makeBlockFromEnv(testData.env);
      block.transactions.push(tx);

      if (options.vmtrace) {
        sstream = testUtil.enableVMtracing(vm, options.vmtrace);
      }

      if (tx.validate()) {
        vm.runBlock({
          block: block,
          blockchain: blockchain,
          gen: true
        }, function(err) {
          if (err) {
            errored = true;
          }
          done();
        });
      } else {
        errored = true;
        done();
      }
    },
    function(done) {
      if (!errored) {
        var address = new Buffer(testData.env.currentCoinbase, 'hex');
        var minerReward = bignum('1500000000000000000');

        state.get(address, function(err, data) {
          var account = new Account(data);
          account.balance = bignum.fromBuffer(account.balance).sub(minerReward).toBuffer();
          state.put(address, account.serialize(), done);
        });
      } else {
        done();
      }
    },

    function(done) {
      if (sstream) sstream.end();

      if (testData.logs.length !== 0) {
        var bloom = new Bloom();
        testData.logs.forEach(function(l) {
          bloom.or(new Bloom(new Buffer(l.bloom, 'hex')));
        });

        t.equal(bloom.bitvector.toString('hex'), block.header.bloom.toString('hex'));

      }

      var keysOfPost = Object.keys(testData.post);

      async.eachSeries(keysOfPost, function(key, cb2) {
        var bkey = new Buffer(key, 'hex');
        state.get(bkey, function(err, raw) {
          t.assert(raw !== null, 'account: ' + key + ' was found');

          var account = new Account(raw);
          var acctData = testData.post[key];
          testUtil.verifyAccountPostConditions(state, account, acctData, t, function() {
            cb2();
          });
        });
      }, done);
    }
  ], cb);
};
