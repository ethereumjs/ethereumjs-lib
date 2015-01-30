const async = require('async'),
  bignum = require('bignum'),
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
VM.prototype.runExtension = require('./runExtension.js');

VM.prototype.generateGenesis = function(initState, cb) {

  var self = this;
  var addresses = Object.keys(initState);

  async.each(addresses, function(address, done) {
    var account = new Account();

    account.balance = bignum(initState[address]).toBuffer();

    self.trie.put(new Buffer(address, 'hex'), account.serialize(), done);
  }, cb);
};
