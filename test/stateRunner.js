const async = require('async'),
  BN = require('bn.js'),
  VM = require('../lib/vm'),
  Account = require('../lib/account.js'),
  Bloom = require('../lib/bloom.js'),
  testUtil = require('./util'),
  blockchain = require('./fakeBlockChain.js'),
  utils = require('ethereumjs-util');
Trie = require('merkle-patricia-tree/secure');

module.exports = function runStateTest(testData, options, cb) {

  var t = options.t;
  var sstream = false;
  var state = new Trie();
  var errored = false;
  var block;
  var hrstart;
  var vm;

  async.series([
    function(done) {
      testUtil.setupPreConditions(state, testData, done);
    },
    function(done) {
      vm = new VM(state, blockchain);
      vm.loadAllPrecompiled(done);
    },
    function(done) {

      var tx = testUtil.makeTx(testData.transaction);

      block = testUtil.makeBlockFromEnv(testData.env);
      block.transactions.push(tx);

      if (options.vmtrace) {
        sstream = testUtil.enableVMtracing(vm, options.vmtrace);
      }

      hrstart = process.hrtime();
      if (tx.validate()) {
        vm.runBlock({
          block: block,
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
      var hrend = process.hrtime(hrstart);
      //console.log('# Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
      //remove the miner's reward
      if (!errored) {
        var address = new Buffer(testData.env.currentCoinbase, 'hex');
        var minerReward = new BN('1500000000000000000');

        state.get(address, function(err, data) {
          var account = new Account(data);
          account.balance = new BN(account.balance).sub(minerReward);
          // if(account.balance.toString('hex') === '00'){
          //   state.del(address,  done);
          // }else{
            state.put(address, account.serialize(), done);
          // }
        });
      } else {
        done();
      }
    },
    function(done) {
      if (sstream) sstream.end();
      var rlp = require('rlp');
      t.equal(state.root.toString('hex'), testData.postStateRoot, 'the state roots should match');

      if (testData.logs.length !== 0) {
        var bloom = new Bloom();
        testData.logs.forEach(function(l) {
          bloom.or(new Bloom(new Buffer(l.bloom, 'hex')));
        });
        t.equal(bloom.bitvector.toString('hex'), block.header.bloom.toString('hex'));
      }

      var hashedAccounts = {};
      var keyMap = {};

      for (key in testData.post) {
        var hash = utils.sha3(new Buffer(key, 'hex')).toString('hex');
        hashedAccounts[hash] = testData.post[key];
        keyMap[hash] = key;
      }

      var q = async.queue(function(task, cb2) {
        testUtil.verifyAccountPostConditions(state, task.account, task.testData, t, function() {
          cb2();
        });
      }, 1);


      var keysOfPost = Object.keys(testData.post);
      var stream = state.createReadStream();

      stream.on('data', function(data) {
        var acnt = new Account(rlp.decode(data.value));
        var key = data.key.toString('hex');
        var testData = hashedAccounts[key];
        delete keyMap[key];

        if (testData) {
          q.push({
            account: acnt,
            testData: testData
          });
        } else {
          t.fail('invalid account in the trie: ' + key);
        }
      });

      stream.on('end', function() {

        function onEnd() {
          for (hash in keyMap) {
            t.fail('Missing account!: ' + keyMap[hash]);
          }
          done();
        };

        if (q.length()) {
          q.drain = onEnd;
        } else {
          onEnd();
        }
      });
    }
  ], cb);
};
