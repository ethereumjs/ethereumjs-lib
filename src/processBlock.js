
function UnsignedTransaction() {
}
UnsignedTransaction.prototype = Error.prototype;

function apply_transaction(block, tx) {

    // def rp(actual, target):
    //     return '%r, actual:%r target:%r' % (tx, actual, target)

    // (1) The transaction signature is valid;
    if (!tx.sender) {
        throw new UnsignedTransaction(tx);
    }

    // (2) the transaction nonce is valid (equivalent to the
    //     sender account's current nonce);
    var acctnonce = block.get_nonce(tx.sender);
    if (acctnonce != tx.nonce) {
        throw new InvalidNonce(rp(tx.nonce, acctnonce));
    }

    // (3) the gas limit is no smaller than the intrinsic gas,
    // g0, used by the transaction;
    var intrinsic_gas_used = GTXDATA * len(tx.data) + GTXCOST;
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
            rp(block.gas_used + tx.startgas, block.gas_limit))
    }

    // start transacting //////////////////////////////////
    if (tx.to) {
        block.increment_nonce(tx.sender);
    }

    // buy startgas
    var success = block.transfer_value(tx.sender, block.coinbase,
                                   tx.gasprice * tx.startgas)
    //assert success

    /* todo
    blocks:
    getnonce, incrnonce
    add_transaction_to_list
    snapshot
    Message
    

    snapshot = block.snapshot()
    message_gas = tx.startgas - intrinsic_gas_used
    message = Message(tx.sender, tx.to, tx.value, message_gas, tx.data)
    // MESSAGE
    if tx.to and tx.to != '0000000000000000000000000000000000000000':
        result, gas_remained, data = apply_msg(block, tx, message)
    else:  // CREATE
        result, gas_remained, data = create_contract(block, tx, message)
    assert gas_remained >= 0
    logger.debug(
        'applied tx, result %s gas remained %s data/code %s', result, gas_remained,
        ''.join(map(chr, data)).encode('hex'))
    if not result:  // 0 = OOG failure in both cases
        block.revert(snapshot)
        block.gas_used += tx.startgas
        output = OUT_OF_GAS
    else:
        gas_used = tx.startgas - gas_remained
        // sell remaining gas
        block.transfer_value(
            block.coinbase, tx.sender, tx.gasprice * gas_remained)
        block.gas_used += gas_used
        output = ''.join(map(chr, data)) if tx.to else result.encode('hex')
    block.add_transaction_to_list(tx)
    success = output is not OUT_OF_GAS
    return success, output if success else ''
    */
}

module.exports = {
    apply_transaction: apply_transaction,
    UnsignedTransaction: UnsignedTransaction
}
