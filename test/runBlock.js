var async = require('async'),
  Block = require('../lib/block.js'),
  VM = require('../lib/vm'),
  assert = require('assert'),
  levelup = require('levelup');

var internals = {},
  stateDB = levelup('', {
    db: require('memdown')
  });

describe('[State]: Basic functions', function () {
  before('should create a new state', function () {
    internals.VM = new VM(stateDB);
  });

  it('should generate correct genesis state', function (done) {
    internals.VM.generateGenesis(function () {
      var stateRoot = '08bf6a98374f333b84e7d063d607696ac7cbbd409bd20fbe6a741c2dfc0eb285';
      assert(internals.VM.trie.root.toString('hex') === stateRoot);
      done();
    });
  });

});
