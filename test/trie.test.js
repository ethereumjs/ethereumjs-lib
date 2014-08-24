require('chai').should();

var Trie = require('../src/trie');
var util = require('../src/util');

describe('trie', function(){

  var LONG_VALUE = "1234567890abcdefghijklmnopqrstuvwxxzABCEFGHIJKLMNOPQRSTUVWXYZ";

  describe('#update', function() {
    it('should get updated value', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('dog', LONG_VALUE);
      var result = trie.get('dog');
      result.should.equal(LONG_VALUE);
    });

    it('should do replace when update with same key', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('dog', LONG_VALUE);
      trie.update('dog', LONG_VALUE + 'sameKey');
      var result = trie.get('dog');
      result.should.equal(LONG_VALUE + 'sameKey');
    });

    it('basic', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('a', 'A');
      trie.update('b', 'B');
      trie.get('a').should.equal('A');
      trie.get('b').should.equal('B');
    });
  });

  describe('#rootHash', function (argument) {
    function hexRootHash(trie) {
        return util.encodeHex(trie.rootHash());
    }

    it('basic', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('a', 'A');
      trie.update('b', 'B');
      hexRootHash(trie).should.equal('300eab197a9d9e437aaeb9b0d7bd77d57e8d4e3eeca0b1e6a3fe28a84e2cd70c');
    });

    it('basic1', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('test', 'test');
      hexRootHash(trie).should.equal('85d106d4edff3b7a4889e91251d0a87d7c17a1dda648ebdba8c6060825be23b8');
    });

    it('basic2', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('test', 'test');
      trie.update('te', 'testy');
      hexRootHash(trie).should.equal('8452568af70d8d140f58d941338542f645fcca50094b20f3c3d8c3df49337928');
    });

    it('do prefix', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('dogglesworth', 'cat');
      trie.update('dog', 'puppy');
      trie.update('doe', 'reindeer');
      hexRootHash(trie).should.equal('8aad789dff2f538bca5d8ea56e8abe10f4c7ba3a5dea95fea4cd6e7c3a1168d3');
    });

    it('be prefix', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('be', 'e');
      trie.update('dog', 'puppy');
      trie.update('bed', 'd');
      hexRootHash(trie).should.equal('3f67c7a47520f79faa29255d2d3c084a7a6df0453116ed7232ff10277a8be68b');
    });

    it('multiprefix', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('dog', 'puppy');
      trie.update('horse', 'stallion');
      trie.update('do', 'verb');
      trie.update('doge','coin');
      hexRootHash(trie).should.eql('5991bb8c6514148a29db676a14ac506cd2cd5775ace63c30a4fe457715e9ac84');
    });

    it('replacement', function () {
      var trie = new Trie.Trie(undefined, '');
      trie.update('foo', 'bar');
      trie.update('food', 'bat');
      trie.update('food', 'bass');
      hexRootHash(trie).should.equal('17beaa1648bafa633cda809c90c04af50fc8aed3cb40d16efbddee6fdf63c4c3');
    });
  });
});
