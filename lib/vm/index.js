const async = require('async');
const BN = require('bn.js');
const Account = require('../account');
const Trie = require('merkle-patricia-tree');
const util = require('util');
const ethUtil = require('ethereumjs-util');
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const path = require('path');
const Cache = require('./cache.js');

/**
 * @constructor
 */
var VM = module.exports = function(trie, blockchain) {

  if (trie.constructor !== Trie) {
    trie = new Trie(trie);
  }

  this.blockchain = blockchain;
  this.trie = trie;
  this.cache = new Cache(trie);
};

util.inherits(VM, EventEmitter);

VM.prototype.runCode = require('./runCode.js');
VM.prototype.runJIT = require('./runJit.js');
VM.prototype.runBlock = require('./runBlock.js');
VM.prototype.runTx = require('./runTx.js');
VM.prototype.runCall = require('./runCall.js');
VM.prototype.generateGenesis = function(initState, cb) {
  var self = this;
  var addresses = Object.keys(initState);
  async.eachSeries(addresses, function(address, done) {
    var account = new Account();

    account.balance = new Buffer((new BN(initState[address])).toArray())
    self.trie.put(new Buffer(address, 'hex'), account.serialize(), done);
  }, cb);
};

/**
 * Loads precomiled contracts into the state
 */
VM.prototype.loadPrecompiled = function(address, src, cb) {
  this.trie.db.put(address, src , cb);
}

VM.prototype.loadAllPrecompiled = function(cb) {

  var self = this;
  var dir = path.join(__dirname, '../../precompiled/');
  var reg = new RegExp(/^\d+$/);

  fs.readdir(dir, function(err, files) {
    async.forEachSeries(files, function(file, cb2) {
      if (reg.test(file[0])) {
        fs.readFile(dir + file, function(err, data){
          var address = ethUtil.pad(new Buffer(file.split('-')[0], 'hex'), 20);
          self.loadPrecompiled(address, data, cb2);
        });
      } else {
        cb2();
      }
    }, cb);
  });
}
