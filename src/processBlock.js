var _ = require('./lodash/lodash.min');

var GSTEP = 1;
var GSTOP = 0;
var GSHA3 = 20;
var GSLOAD = 20;
var GSSTORE = 100;
var GBALANCE = 20;
var GCREATE = 100;
var GCALL = 20;
var GMEMORY = 1;
var GTXDATA = 5;
var GTXCOST = 500;

var OUT_OF_GAS = -1;

var CREATE_CONTRACT_ADDRESS = '0000000000000000000000000000000000000000';


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
function InvalidTransaction(message) {
    this.name = 'InvalidTransaction';
    this.message = message;
}
InvalidTransaction.prototype = new Error();
InvalidTransaction.prototype.constructor = InvalidTransaction;

function UnsignedTransaction(message) {
    this.name = 'UnsignedTransaction';
    this.message = message;
}
UnsignedTransaction.prototype = InvalidTransaction.prototype;
UnsignedTransaction.prototype.constructor = UnsignedTransaction;

function InvalidNonce(message) {
    this.name = 'InvalidNonce';
    this.message = message;
}
InvalidNonce.prototype = InvalidTransaction.prototype;
InvalidNonce.prototype.constructor = InvalidNonce;


function Message(sender, to, value, gas, data) {
    return {
        sender: sender,
        to: to,
        value: value,
        gas: gas,
        data: data
    };
}

function apply_transaction(block, tx) {

    function rp(actual, target) {
        return JSON.stringify(tx) + ', actual:'+actual + ' target:'+target;
        //return '%r, actual:%r target:%r' % (tx, actual, target)
    }

    // (1) The transaction signature is valid;
    if (!tx.sender) {
        throw new UnsignedTransaction(tx);
    }

    // (2) the transaction nonce is valid (equivalent to the
    //     sender account's current nonce);
    var acctnonce = block.get_nonce(tx.sender);
    if (!_.isEqual(acctnonce, tx.nonce)) {
        throw new InvalidNonce(rp(tx.nonce, acctnonce));
    }

    // (3) the gas limit is no smaller than the intrinsic gas,
    // g0, used by the transaction;
    var intrinsic_gas_used = GTXDATA * tx.data.length + GTXCOST;
    if (tx.startgas < intrinsic_gas_used) {
        throw new InsufficientStartGas(rp(tx.startgas, intrinsic_gas_used));
    }

    // (4) the sender account balance contains at least the
    // cost, v0, required in up-front payment.
    var total_cost = tx.value + tx.gasprice * tx.startgas;
    if (block.get_balance(tx.sender) < total_cost) {  // todo
        throw new InsufficientBalance(
            rp(block.get_balance(tx.sender), total_cost));
    }

    // check offered gas price is enough
    if (tx.gasprice < block.min_gas_price) { // todo? {
        throw new GasPriceTooLow(rp(tx.gasprice, block.min_gas_price));
    }

    // check block gas limit
    if (block.gas_used + tx.startgas > block.gas_limit) {  // todo?
        throw new BlockGasLimitReached(
            rp(block.gas_used + tx.startgas, block.gas_limit));
    }

    // start transacting //////////////////////////////////
    if (tx.to) {
        block.increment_nonce(tx.sender);
    }

    // buy startgas
    var success = block.transfer_value(tx.sender, block.coinbase,
                                   tx.gasprice * tx.startgas);
    //assert success

    /* todo
    blocks:
    getnonce, incrnonce, get_code
    add_transaction_to_list
    snapshot
    */

    //snapshot = block.snapshot()

    var message_gas = tx.startgas - intrinsic_gas_used;
    var message = Message(tx.sender, tx.to, tx.value, message_gas, tx.data);
    // MESSAGE
    var res;
    if (tx.to && tx.to !== '0000000000000000000000000000000000000000') {
        res = apply_msg_send(block, tx, message);
    }
    else {  // CREATE
        // TODO
    }

    var output;
    if (!res.result) {
    }
    else {
        var gas_used = tx.startgas - res.gas_remained;
        // sell remaining gas
        block.transfer_value(
            block.coinbase, tx.sender, tx.gasprice * res.gas_remained);
        block.gas_used += gas_used;
        if (tx.to) {
            //console.log('dd: ', res.data);
            output = 'TODO';  //''.join(map(chr, res.data))
        }
        else {
            output = res.result;
        }
    }
    if (success) {
        return {
            success: success,
            output: output
        };
    }
    else {
        return '';
    }
}

function apply_msg(block, tx, msg, code) {
    //pblogger.log("MSG APPLY", tx=tx.hex_hash(), to=msg.to, gas=msg.gas)
    // Transfer value, instaquit if not enough
    var o = block.transfer_value(msg.sender, msg.to, msg.value);
    if (!o) {
        return {
            result: 1,
            gas_remained: msg.gas,
            data: []
        };
    }

    // TODO this is hardcoded until we implement Compustate
    return {
        result: 1,
        gas_remained: msg.gas,
        data: []
    };

    /* TODO
    snapshot = block.snapshot()
    compustate = Compustate(gas=msg.gas)
    t, ops = time.time(), 0
    // Main loop
    while 1:
        o = apply_op(block, tx, msg, code, compustate)
        ops += 1
        if o is not None:
            pblogger.log('PERFORMAMCE', ops=ops, time_per_op=(time.time() - t) / ops)
            pblogger.log('MSG APPLIED', result=o)
            if o == OUT_OF_GAS:
                block.revert(snapshot)
                return 0, compustate.gas, []
            else:
                return 1, compustate.gas, o
    */
}
function apply_msg_send(block, tx, msg) {
    return apply_msg(block, tx, msg, block.get_code(msg.to));
}

module.exports = {
    apply_transaction: apply_transaction,
    UnsignedTransaction: UnsignedTransaction
};
