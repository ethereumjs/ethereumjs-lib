const Tree = require('functional-red-black-tree');
const Set = require('es6-set');
const Account = require('../account.js');
const async = require('async');

var Cache = module.exports = function(trie) {
  this._cache = Tree();
  this._checkpoints = [];
  this._deletes = [];
  this._trie = trie;
}

Cache.prototype.put = function(key, val) {
  key = key.toString('hex');

  var it = this._cache.find(key);
  if(it.node){
    this._cache = it.update(val);
  }else{
    this._cache = this._cache.insert(key, val);
  }
}

Cache.prototype.get = function(key){
  key = key.toString('hex');

  var it = this._cache.find(key)
  if(it.node){
    return new Account(it.value);
  }else{
    return new Account();
  }
}

Cache.prototype.getOrLoad = function(key, cb){
  var self = this;

  if(!key){
    return cb();
  }

  key = key.toString('hex');

  var it = this._cache.find(key)
  if(it.node){
    var raw = it.value.isEmpty() ? null : it.value.raw;
    cb(null, it.value, raw);
  }else{
    this._trie.get(new Buffer(key, 'hex'), function(err, raw){
      var account = new Account(raw);
      self._cache = self._cache.insert(key, account);
      cb(err, account, raw);
    });
  }
}

Cache.prototype.flush = function(cb){
  var it = this._cache.begin;
  var self  = this;
  var next = true;

  async.whilst(function(){
    return next;
  }, function(done){
    self._trie.put(new Buffer(it.key, 'hex'), it.value.serialize(), function(){
      next = it.hasNext;
      it.next();
      done();
    })
  }, function(){
    //delete the deletes
    async.eachSeries(self._deletes, function(address, done){
      self._trie.del(address, done);
    }, cb);
  });
};

Cache.prototype.checkpoint = function(){
  this._checkpoints.push(this._cache)
}

Cache.prototype.revert = function(){
  this._cache = this._checkpoints.pop(this._cache)
}

Cache.prototype.commit = function(){
  this._checkpoints.pop();
}

Cache.prototype.del = function(key){
  this._deletes.push(key);
  key = key.toString('hex');
  this._cache = this._cache.remove(key);
}
