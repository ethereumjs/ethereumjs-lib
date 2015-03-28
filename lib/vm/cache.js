const Tree = require('functional-red-black-tree');

var Cache = module.exports = function() {
  this._cache = Tree();
}

Cache.prototype.populateCache = function(accounts, cb) {
  //shim till async supports iterators
  var accountArr = [];
  accounts.forEach(function(val) {
    if (val) accountArr.push(val);
  })

  async.eachSeries(accountArr, function(acnt, done) {
    console.log(acnt);
    self.trie.get(new Buffer(acnt, 'hex'), function(err, val) {
      self.cache = self.cache.insert(acnt, val);
      done();
    });
  }, cb);
}
