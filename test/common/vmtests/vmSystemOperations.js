const vmSystemOperationsTest = require('ethereum-tests').vmtests.vmSystemOperationsTest,
  async = require('async'),
  VM = require('../../../lib/vm'),
  rlp = require('rlp'),
  Account = require('../../../lib/account.js'),
  bignum = require('bignum'),
  assert = require('assert'),
  testUtils = require('../../testUtils'),
  utils = require('../../../lib/utils.js'),
  Trie = require('merkle-patricia-tree');

const START_BALANCE = '1333333';

describe.only('[Common]: vmSystemOperationsTest', function() {
  var tests = Object.keys(vmSystemOperationsTest);
  // TODO add tests
  tests = ['CallToNameRegistrator0'];
  tests.forEach(function(testKey) {
    var state = new Trie();
    var testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function(done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run code', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        acctData,
        account,
        runCodeData,
        vm = new VM(state);


      // vm.onStep = function(info, done) {
      //   console.log('vm', bignum(info.pc).toString(16) + ' Opcode: ' + info.opcode + ' Gas: ' + info.gasLeft.toString());


      //   var stream = vm.trie.createReadStream();
      //   stream.on("data", function(data) {
      //     var account = new Account(data.value);
      //     console.log("key: " + data.key.toString("hex"));
      //     //console.log(data.value.toString('hex'));
      //     console.log('decoded:' + bignum.fromBuffer(account.balance).toString() + '\n');
      //   });

      //   stream.on('end', done);

      //   // info.stack.reverse();
      //   // info.stack.forEach(function (item) {
      //   //   console.log('vm', '    ' + item.toString('hex'));
      //   // });
      //   // info.stack.reverse();

      // };


      acctData = testData.pre[testData.exec.address];
      account = new Account();
      account.nonce = testUtils.fromDecimal(acctData.nonce);
      account.balance = testUtils.fromDecimal(acctData.balance);

      runCodeData = testUtils.makeRunCodeData(testData.exec, account, block);
      vm.runCode(runCodeData, function(err, results) {
        assert(!err);

        // console.log('gas: ', results.gasUsed.toNumber(), 'exp: ',  testData.exec.gas - testData.gas)
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        async.series([
          function(cb) {
            var stream = state.createReadStream();
            stream.on("data", function(data) {
              var account = new Account(data.value);
              console.log("key: " + data.key.toString("hex"));
              //console.log(data.value.toString('hex'));
              console.log('decoded:' + bignum.fromBuffer(account.balance).toString() + '\n');
            });

            stream.on('end', cb);
          },

//           function(cb) {
//             // cb()
//             // return

//             account = results.account;
//             acctData = testData.post[testData.exec.address];
//             testUtils.verifyAccountPostConditions(state, account, acctData, cb);
//           },

          function() {
            // validate the postcondition of other accounts
            // delete testData.post[testData.exec.address];
            var keysOfPost = Object.keys(testData.post);
            async.eachSeries(keysOfPost, function(key, cb) {
              state.get(new Buffer(key, 'hex'), function(err, raw) {
                assert(!err);

                account = new Account(raw);
                acctData = testData.post[key];
                testUtils.verifyAccountPostConditions(state, account, acctData, cb);
              });
            }, done);
          }
        ]);
      });
    });
  });

  describe.skip('.', function() {
    var testKey = 'CallToNameRegistrator0',
      state = new Trie(),
      testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function(done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run call', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        account = new Account([
          new Buffer([0]),
          bignum(START_BALANCE).toBuffer()
        ]),
        runData = testUtils.makeRunCallDataWithAccount(testData, account, block),
        vm = new VM(state);

      vm.runCall(runData, function(err, results) {
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        async.series([
          function(cb) {
            cb();

            // state.get(new Buffer(testData.exec.address, 'hex'), function(err, raw) {
            //   assert(!err);
            //   assert(!raw, 'contract should have been deleted by SUICIDE');
            //   cb();
            // });
          },
          function() {
            var keysOfPost = Object.keys(testData.post);
            async.each(keysOfPost, function(key, cb) {
              state.get(new Buffer(key, 'hex'), function(err, raw) {
                assert(!err);
                var account = new Account(raw),
                  acctData = testData.post[key];
                testUtils.verifyAccountPostConditions(state, account, acctData, cb);
              });
            }, done);
          }
        ]);
      });
    });
  });

  describe('.', function() {
    var testKey = 'suicide0',
      state = new Trie(),
      testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function(done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run call', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        account = new Account([
          new Buffer([0]),
          bignum(START_BALANCE).toBuffer()
        ]),
        runData = testUtils.makeRunCallDataWithAccount(testData, account, block),
        vm = new VM(state);

      vm.runCall(runData, function(err, results) {
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        var suicideTo = results.vm.suicideTo.toString('hex'),
          keysOfPost = Object.keys(testData.post);
        assert.strictEqual(keysOfPost.length, 1, '#post mismatch');
        assert.strictEqual(suicideTo, keysOfPost[0], 'suicideTo mismatch');

        state.get(new Buffer(suicideTo, 'hex'), function(err, acct) {
          assert(!err);
          var account = new Account(acct),
            acctData = testData.post[suicideTo];
          testUtils.verifyAccountPostConditions(state, account, acctData, done);
        });
      });
    });
  });

  describe('.', function() {
    var testKey = 'suicideNotExistingAccount',
      state = new Trie(),
      testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function(done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run call', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        account = new Account([
          new Buffer([0]),
          bignum(START_BALANCE).toBuffer()
        ]),
        runData = testUtils.makeRunCallDataWithAccount(testData, account, block),
        vm = new VM(state);

      vm.runCall(runData, function(err, results) {
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        async.series([
          function(cb) {
            state.get(new Buffer(testData.exec.address, 'hex'), function(err, raw) {
              assert(!err);
              assert(!raw, 'contract should have been deleted by SUICIDE');
              cb();
            });
          },
          function() {
            var keysOfPost = Object.keys(testData.post),
              suicideCreated = testData.exec.code.substr(4, 20 * 2);
            assert(keysOfPost.indexOf(suicideCreated) !== -1, 'suicideCreated not in post');

            async.each(keysOfPost, function(key, cb) {
              state.get(new Buffer(key, 'hex'), function(err, raw) {
                assert(!err);
                var account = new Account(raw),
                  acctData = testData.post[key];
                testUtils.verifyAccountPostConditions(state, account, acctData, cb);
              });
            }, done);
          }
        ]);
      });
    });
  });

  describe('.', function() {
    var testKey = 'suicideSendEtherToMe',
      state = new Trie(),
      testData = vmSystemOperationsTest[testKey];

    it(testKey + ' setup the trie', function(done) {
      testUtils.setupPreConditions(state, testData, done);
    });

    it(testKey + ' run call', function(done) {
      var env = testData.env,
        block = testUtils.makeBlockFromEnv(env),
        account = new Account([
          new Buffer([0]),
          bignum(START_BALANCE).toBuffer()
        ]),
        runData = testUtils.makeRunCallDataWithAccount(testData, account, block),
        vm = new VM(state);

      vm.runCall(runData, function(err, results) {
        assert(!err);
        assert.strictEqual(results.gasUsed.toNumber(),
          testData.exec.gas - testData.gas, 'gas used mismatch');

        var suicideTo = results.vm.suicideTo.toString('hex'),
          keysOfPost = Object.keys(testData.post);
        assert.strictEqual(keysOfPost.length, 1, '#post mismatch');
        assert.notStrictEqual(suicideTo, keysOfPost[0], 'suicideTo should not exist');

        async.series([
          function(cb) {
            state.get(new Buffer(suicideTo, 'hex'), function(err, acct) {
              assert(!err);
              assert(!acct, 'suicide account should be gone');
              cb();
            });
          },
          function() {
            state.get(new Buffer(keysOfPost[0], 'hex'), function(err, acct) {
              assert(!err);
              var account = new Account(acct),
                acctData = testData.post[keysOfPost[0]];
              testUtils.verifyAccountPostConditions(state, account, acctData, done);
            });
          }
        ], done);
      });
    });
  });
});
