var stRecursiveCreate = require('ethereum-tests').StateTests.stRecursiveCreate,
  VM = require('../lib/vm'),
  testUtils = require('../test/testUtils'),
  Trie = require('merkle-patricia-tree');

var state = new Trie();
var testKey = 'recursiveCreate';
var testData = stRecursiveCreate[testKey];
var hrstart = process.hrtime();

testUtils.setupPreConditions(state, testData, function() {
  var env = testData.env,
    block = testUtils.makeBlockFromEnv(env),
    vm = new VM(state),
    tx = testUtils.makeTx(testData.transaction);

  vm.runTx(tx, block, function() {
    var hrend = process.hrtime(hrstart);
    console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
  });
});
