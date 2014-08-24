var convert = require('./convert'),
    util = require('./util'),
    rlp = require('./rlp');

var BLANK_NODE = '';
var BLANK_ROOT = '';

var BasicDB = function() {
    this.map = {};
    this.get = function(k) {
        return this.map[k];
    };
    this.set = function(k, v) {
        this.map[k] = v;
    };
    return this;
};

var Trie = function(db, node) {
    this.root = node || BLANK_NODE;
    this.db = db || new BasicDB();
};

Trie.prototype._dbget = function(v) {
    if (!v) return BLANK_NODE;
    if (!util.isString(v) || v.length < 32) return v.slice();
    var n = this.db.get(v);
    return n ? rlp.decode(n) : null;
};

Trie.prototype._dbset = function(v) {
    if (!v) return BLANK_NODE;
    var rlp_node = rlp.encode(v);
    if (rlp_node.length < 32) return v.slice(0);
    var h = util.sha3(rlp_node);
    this.db.set(h, rlp_node);
    return h;
};

Trie.prototype._get = function(node, path) {
    if (path.length === 0 || !node) {
        return node;
    }
    node = this._dbget(node);
    if (node.length == 17) {
        var subnode = this._dbget(node[path[0]]);
        return this._get(subnode, path.slice(1));
    }
    else if (node.length == 2) {
        var oldkey = compactDecode(node[0]);
        var shared = 0;
        while (shared < oldkey.length && shared < path.length && oldkey[shared] === path[shared]) {
            shared++;
        }
        if (shared < oldkey.length) return BLANK_NODE;
        else return this._get(node[1], path.slice(shared));
    }
};

Trie.prototype._update = function(node, path, value) {
    var sub_node;

    if (path.length === 0) {
        return value;
    }
    node = this._dbget(node);
    //console.log(1, node)
    if (node.length === 17) {
        node[path[0]] = this._update(node[path[0]], path.slice(1), value);
    }
    else if (node.length === 0) {
        node =[compactEncode(path), value];
    }
    else {
        var oldkey = compactDecode(node[0]);
        var shared = 0;
        while (shared < oldkey.length && shared < path.length && oldkey[shared] === path[shared]) {
            shared++;
        }
        //console.log(1.5,shared,oldkey,path)
        if (!shared) {
            var new_node = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
            new_node[oldkey[0]] = this._update(new_node[oldkey[0]], oldkey.slice(1), node[1]);
            new_node[path[0]] = this._update(new_node[path[0]], path.slice(1), value);
            node = new_node;
        }
        else {
            sub_node = this._update(BLANK_NODE, oldkey.slice(shared), node[1]);
            sub_node = this._update(sub_node, path.slice(shared), value);
            node =[compactEncode(oldkey.slice(0, shared)), sub_node];
        }
    }
    //console.log(2,node)
    // Normalize
    if (node.length === 17) {
        var posOfSingle = -1;
        for (var i = 0;i < 17;i++) {
            if (node[i]) {
                if (posOfSingle === -1) posOfSingle = i;
                else if (posOfSingle > 0) posOfSingle = -2;
            }
        }
        if (posOfSingle === -1) return BLANK_NODE;
        else if (posOfSingle > 0) {
            node =[compactEncode([posOfSingle]), node[posOfSingle]];
        }
    }
    if (node.length === 2) {
        if (node[1] === BLANK_NODE) return BLANK_NODE;
        sub_node = this._dbget(node[1]);
        if (sub_node && sub_node.length == 2) {
            new_path = compactDecode(node[0]).concat(compactDecode(sub_node[0]));
            node =[compactEncode(new_path), sub_node[1]];
        }
    }
    //console.log(3,node)
       // Database-ize
    return this._dbset(node);
};

Trie.prototype._rlp_decode = function(node) {
    if (!util.isString(node)) {
        return node;
    } else if (node.length === 0) {
        return node;
    } else if (node.length < 32) {
        return node;
    } else {
        return rlp.decode(this.db.get(node));
    }
};

Trie.prototype.get = function(k) {
    var key = compactHexDecode(k).concat([16]);
    return this._get(this.root, key);
};

Trie.prototype.update = function(k,v) {
    var key = compactHexDecode(k).concat([16]);
    this.root = this._update(this.root, key, v);
};

// based on pyethereum features/steps/trie.py
Trie.prototype.rootHash = function() {
    if (this.root === BLANK_NODE) {
        return BLANK_ROOT;
    }

    var rlpRoot = rlp.encode(this._rlp_decode(this.root));
    return util.sha3(rlpRoot);
};


var compactEncode = function (dataArr) {
  dataArr = dataArr.slice();
  if (util.isArray(dataArr)) {
    var terminator = 0;
    if (dataArr[dataArr.length - 1] === 16) {
      terminator = 1;
    }
    if (terminator === 1) {
      dataArr.pop();
    }
    var dataArrLen = dataArr.length;

    var oddlen = dataArrLen % 2;
    var flags = 2 * terminator + oddlen;
    if (oddlen !== 0) {
      dataArr.unshift(flags);
    } else {
      dataArr.unshift(flags, 0);
    }
    var o = BLANK_NODE;
    for (var i = 0; i < dataArr.length; i += 2) {
      o += String.fromCharCode(16 * dataArr[i] + dataArr[i + 1]);
    }
    return o;
  } else {
    logger.error("[compactEncode]: param should be array.");
  }
};

/**
 * Compact Decoding based on: {@link https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-Patricia-Tree|Patricia Tree}
 * First step
 *
 * @param {String|Buffer} str
 * @returns {Array}
 **/

var compactHexDecode = function (str) {
  var base = "0123456789abcdef";
  var hexArr =[];
  str = convert.bytesToHex(convert.stringToBytes(str));
  for (var i = 0; i < str.length; i++) {
    hexArr.push(base.indexOf(str[i]));
  }
  return hexArr;
};

/**
 * Compact Decoding based on: {@link https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-Patricia-Tree|Patricia Tree}
 *
 * @param {String|Buffer} str
 * @returns {Array}
 **/

var compactDecode = function (str) {
  var base = compactHexDecode(str);
  if (parseInt(base[0], 10) >= 2) {
    base.push(16);
  }
  if (base[0] % 2 == 1) {
    base = base.slice(1);
  } else {
    base = base.slice(2);
  }
  return base;
};

module.exports = {
    Trie: Trie,
    BLANK_NODE: BLANK_NODE,
    BLANK_ROOT: BLANK_ROOT,
    BasicDB: BasicDB,
    compactDecode: compactDecode,
    compactEncode: compactEncode
};
