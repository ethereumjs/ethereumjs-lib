var util = require('./util');
var rlp = require('./rlp');
var trie = require('./trie');
var BigInteger = require('./jsbn/jsbn');

var INITIAL_DIFFICULTY = BigInteger('2').pow(22);
var GENESIS_PREVHASH = util.repeat('\x00', 32);
var GENESIS_COINBASE = util.repeat('0', 40);
var GENESIS_NONCE = util.sha3(String.fromCharCode(42));
var GENESIS_GAS_LIMIT = BigInteger('10').pow(6);
var BLOCK_REWARD = BigInteger('10').pow(18);
var BLOCK_DIFF_FACTOR = BigInteger('1024');
var GASLIMIT_EMA_FACTOR = BigInteger('1024');
var GENESIS_MIN_GAS_PRICE = BigInteger.ZERO;
var BLKLIM_FACTOR_NOM = BigInteger('6');
var BLKLIM_FACTOR_DEN = BigInteger('5');

// Testnet
var GENESIS_INITIAL_ALLOC = {
    "51ba59315b3a95761d0863b05ccc7a7f54703d99": BigInteger('2').pow(200),
    "e6716f9544a56c530d868e4bfbacb172315bdead": BigInteger('2').pow(200),
    "b9c015918bdaba24b4ff057a92a3873d6eb201be": BigInteger('2').pow(200),
    "1a26338f0d905e295fccb71fa9ea849ffa12aaf4": BigInteger('2').pow(200),
    "2ef47100e0787b915105fd5e3f4ff6752079d5cb": BigInteger('2').pow(200),
    "cd2a3d9f938e13cd947ec05abc7fe734df8dd826": BigInteger('2').pow(200),
    "6c386a4b26f73c802f34673f7248bb118f97424a": BigInteger('2').pow(200),
    "e4157b34ea9615cfbde6b4fda419828124b70c78": BigInteger('2').pow(200)
};

var block_structure = [
    ["prevhash", "bin", GENESIS_PREVHASH],
    ["uncles_hash", "bin", util.sha3(rlp.encode([]))],
    ["coinbase", "addr", GENESIS_COINBASE],
    ["state_root", "trie_root", ''],
    ["tx_list_root", "trie_root", ''],
    ["difficulty", "int", INITIAL_DIFFICULTY],
    ["number", "int", BigInteger.ZERO],
    ["min_gas_price", "int", GENESIS_MIN_GAS_PRICE],
    ["gas_limit", "int", GENESIS_GAS_LIMIT],
    ["gas_used", "int", BigInteger.ZERO],
    ["timestamp", "int", BigInteger.ZERO],
    ["extra_data", "bin", ""],
    ["nonce", "bin", ""],
];
var block_structure_rev = {};
block_structure.forEach(function(v, i) {
  var name = v[0];
  var typ = v[1];
  var defaul = v[2];
  block_structure_rev[name] = [i, typ, defaul];
});

var acct_structure = [
    ["nonce", "int", BigInteger.ZERO],
    ["balance", "int", BigInteger.ZERO],
    ["storage", "trie_root", trie.BLANK_ROOT],
    ["code", "bin", ""],
];

function mk_blank_acct() {
    return [util.encode_int(BigInteger.ZERO),
            util.encode_int(BigInteger.ZERO),
            trie.BLANK_ROOT,
            util.sha3('')];
}

acct_structure_rev = {};
acct_structure.forEach(function(v, i) {
  var name = v[0];
  var typ = v[1];
  var defaul = v[2];
  acct_structure_rev[name] = [i, typ, defaul];
});


var Block = function(opts) {
    opts = opts || {};
    this.prevhash = opts.prevhash || GENESIS_PREVHASH;
    this.uncles_hash = opts.uncles_hash || block_structure_rev.uncles_hash[2];
    this.coinbase = opts.coinbase || block_structure_rev.coinbase[2];
    this.difficulty = opts.difficulty || block_structure_rev.difficulty[2];
    this.number = opts.number || BigInteger.ZERO;
    this.min_gas_price = opts.min_gas_price || block_structure_rev.min_gas_price[2];
    this.gas_limit = opts.gas_limit || block_structure_rev.gas_limit[2];
    this.gas_used = opts.gas_used || BigInteger.ZERO;
    this.timestamp = opts.timestamp || BigInteger.ZERO;
    this.extra_data = opts.extra_data || '';
    this.nonce = opts.nonce || '';
    this.uncles = opts.uncles || [];

    var state_root = opts.state_root || trie.BLANK_ROOT;
    var tx_list_root = opts.tx_list_root || trie.BLANK_ROOT;

    var transaction_list = opts.transaction_list || [];

    // TODO persistent trie
    this.transactions = new trie.Trie(undefined, tx_list_root);
    this.transaction_count = BigInteger.ZERO;

    // TODO persistent trie
    this.state = new trie.Trie(undefined, state_root);

    if (transaction_list.length > 0) {
        // support init with transactions only if state is known
        //assert len(this.state.root) == 32 and \
        //    this.state.db.has_key(this.state.root)
        // TODO
//        for tx_serialized, state_root, gas_used_encoded in transaction_list:
//            this._add_transaction_to_list(
//                tx_serialized, state_root, gas_used_encoded)
    }

    // make sure we are all on the same db
    //assert this.state.db.db == this.transactions.db.db


/* TODO
    # Basic consistency verifications
    if len(this.state.root) == 32 and \
            not this.state.db.has_key(this.state.root):
        raise Exception(
            "State Merkle root not found in database! %r" % this)
    if tx_list_root != this.transactions.root:
        raise Exception("Transaction list root hash does not match!")
    if len(this.transactions.root) == 32 and \
            not this.transactions.db.has_key(this.transactions.root):
        raise Exception(
            "Transactions root not found in database! %r" % this)
    if utils.sha3(rlp.encode(this.uncles)) != this.uncles_hash:
        raise Exception("Uncle root hash does not match!")
    if len(this.extra_data) > 1024:
        raise Exception("Extra data cannot exceed 1024 bytes")
    if this.coinbase == '':
        raise Exception("Coinbase cannot be empty address")
    if not this.is_genesis() and this.nonce and not this.check_proof_of_work(this.nonce):
        raise Exception("PoW check failed")
*/
};

Block.prototype.stateRoot = function() {
    return this.state.rootHash();
};

/* TODO
Block.prototype._add_transaction_to_list = function(tx_serialized, state_root, gas_used_encoded) {
    // adds encoded data # FIXME: the constructor should get objects
    data = [tx_serialized, state_root, gas_used_encoded];
    this.transactions.update(
        utils.encode_int(this.transaction_count), data);
    this.transaction_count.add(BigInteger.ONE);
};
*/

Block.prototype.get_nonce = function(address) {
    return this._get_acct_item(address, 'nonce');
};

Block.prototype.set_nonce = function(address, value) {
    this._set_acct_item(address, 'nonce', value);
};

Block.prototype.increment_nonce = function(address) {
    return this._delta_item(address, 'nonce', BigInteger.ONE);
};

Block.prototype.decrement_nonce = function(address) {
    this._delta_item(address, 'nonce', BigInteger.ONE.negate());
};

Block.prototype.get_balance = function(address) {
    return this._get_acct_item(address, 'balance');
};

Block.prototype.set_balance = function(address, value) {
    this._set_acct_item(address, 'balance', value);
};

Block.prototype.delta_balance = function(address, value) {
    return this._delta_item(address, 'balance', value);
};

Block.prototype.transfer_value = function(from_addr, to_addr, value) {
    //assert value >= 0
    if (this.delta_balance(from_addr, BigInteger(value+'').negate())) {
        return this.delta_balance(to_addr, value);
    }
    return false;
};

Block.prototype.get_code = function(address) {
    return this._get_acct_item(address, 'code');
};

// _get_acct_item(bin or hex, int) -> bin
Block.prototype._get_acct_item = function(address, param) {
    /* get account item
    :param address: account address, can be binary or hex string
        :param param: parameter to get
    */
    if (address.length === 40) {
        address = util.decodeHex(address);
    }
    var acct = rlp.decode(this.state.get(address)) || mk_blank_acct();
    var decoder = util.decoders[acct_structure_rev[param][1]];
    return decoder(acct[acct_structure_rev[param][0]]);
};

// _set_acct_item(bin or hex, int, bin)
Block.prototype._set_acct_item = function(address, param, value) {
    /* set account item
    :param address: account address, can be binary or hex string
    :param param: parameter to set
    :param value: new value
    */
    if (address.length === 40) {
        address = util.decodeHex(address);
    }
    var acct = rlp.decode(this.state.get(address)) || mk_blank_acct();
    var encoder = util.encoders[acct_structure_rev[param][1]];
    acct[acct_structure_rev[param][0]] = encoder(value);
    this.state.update(address, rlp.encode(acct));
};

Block.prototype._delta_item = function(address, param, value) {
    /* add value to account item
    :param address: account address, can be binary or hex string
    :param param: parameter to increase/decrease
    :param value: can be positive or negative
    */
    value = this._get_acct_item(address, param).add(value);
    if (value.compareTo(BigInteger.ZERO) < 0) {  // ie value < 0
        return false;
    }
    this._set_acct_item(address, param, value);
    return true;
};

Block.prototype.get_state_root = function() {
    // this.commit_state(); TODO
    return this.state.rootHash();
};

Block.prototype.state_root = function() {
    return this.get_state_root();
};

Block.prototype.tx_list_root = function() {
    return this.transactions.rootHash();
};

Block.prototype.getattr = function(name) {
    if (name === 'state_root') {
        return this.state_root();
    }
    else if (name === 'tx_list_root') {
        return this.tx_list_root();
    }
    return this[name];
};

Block.prototype.list_header = function(exclude) {
    exclude = exclude || [];
    this.uncles_hash = util.sha3(rlp.encode(this.uncless));
    var header = [];

    block_structure.forEach(function(v, i) {
        var name = v[0];
        var typ = v[1];
        var defaul = v[2];
        if (exclude.indexOf(name) === -1) {
            header.push(util.encoders[typ](this.getattr(name)));
        }
    });
    return header;
};

// Serialization method; should act as perfect inverse function of the
// constructor assuming no verification failures
Block.prototype.serialize = function() {
    return rlp.encode([this.list_header(),
                       this._list_transactions(),
                       this.uncles]);
};

Block.prototype.hash = function() {
    return util.sha3(this.serialize());
};

Block.prototype.hex_hash = function() {
    return util.encodeHex(this.hash());
};

function genesis(initial_alloc) {
    initial_alloc = initial_alloc || GENESIS_INITIAL_ALLOC;
    // https://ethereum.etherpad.mozilla.org/12
    var block = new Block({
        prevhash: GENESIS_PREVHASH,
        coinbase: GENESIS_COINBASE,
        tx_list_root: trie.BLANK_ROOT,
        difficulty: INITIAL_DIFFICULTY,
        nonce: GENESIS_NONCE,
        gas_limit: GENESIS_GAS_LIMIT
    });
    for (var addr in initial_alloc) {
        block.set_balance(addr, initial_alloc[addr]);
    }
    return block;
}

module.exports = {
    Block: Block,
    genesis: genesis,
    GENESIS_COINBASE: GENESIS_COINBASE
};
