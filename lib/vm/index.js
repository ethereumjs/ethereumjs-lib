const async = require('async'),
  Account = require('../account'),
  Trie = require('merkle-patricia-tree');

/**
 * @constructor
 */
var VM = module.exports = function(trie) {

  if (trie.constructor !== Trie) {
    trie = new Trie(trie);
  }

  this.trie = trie;
};

VM.prototype.runCode = require('./runCode.js');
VM.prototype.runBlock = require('./runBlock.js');
VM.prototype.runTx = require('./runTx.js');
VM.prototype.runCall = require('./runCall.js');

VM.prototype.generateGenesis = function(cb) {
  var self = this,
    addresses = [
      '1a26338f0d905e295fccb71fa9ea849ffa12aaf4',
      'b9c015918bdaba24b4ff057a92a3873d6eb201be',
      '2ef47100e0787b915105fd5e3f4ff6752079d5cb',
      '51ba59315b3a95761d0863b05ccc7a7f54703d99',
      '6c386a4b26f73c802f34673f7248bb118f97424a',
      'cd2a3d9f938e13cd947ec05abc7fe734df8dd826',
      'e4157b34ea9615cfbde6b4fda419828124b70c78',
      'e6716f9544a56c530d868e4bfbacb172315bdead'
    ];

  this.trie.checkpoint();

  async.each(addresses, function(address, done) {
    var account = new Account(),
      startAmount = new Buffer(26);

    startAmount.fill(0);
    startAmount[0] = 1;
    account.balance = startAmount;

    self.trie.put(new Buffer(address, 'hex'), account.serialize(), function() {
      done();
    });

  }, function(err) {
    if (!err) {
      self.trie.commit(cb);
    } else {
      self.trie.revert();
      cb(err);
    }
  });
};
