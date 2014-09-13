- [`Block`](#block)
    - [`new Block([data])`](#new-blockdata)
    - [`Block` Properties](#block-properties)
    - [`Block` Methods](#block-methods)
        - [`block.genTxTrie(cb)`](#blockgentxtriecb) 
        - [`block.hash()`](#blockhash)
        - [`block.serialize()`](#blockserialize)
        - [`block.validate(parentBlock, grandParentBlock)`](#blockvalidateparentblock-grandparentblock)
        - [`block.validateTransactions()`](#blockvalidatetransactions)
        - [`block.validateTransactionsTrie()`](#blockvalidatetransactionstrie)

- [`Blockheader`](#blockheader)
    - [`Blockheader` Properties](#blockheader-properties)
    - [`Blockheader` Methods](#blockheader-methods)
        - [`blockheader.validate(parentBlock)`](#blockheadervalidateparentblock)
        - [`blockheader.canonicalGasLimit(parentBlock)`](#blockheadercanonicalgaslimitparentblock)
        - [`blockheader.canonicalDifficulty(parentBlock)`](#blockheadercanonicaldifficultyparentblock)

- [`TransactionReceipt`](#transactionreceipt)
    - [`TransactionReceipt` Properties](#transactionreceipt-properties)

## `Block`
Implements schema  and functions related to Etheruem's block
- file - [lib/block.js](../lib/block.js)

### `new Block([data])`
Creates a new block object
- `data` - the serialized block (usually from the network) in a array of buffers as described in the [wire protocol](https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-Wire-Protocol)

### `Block` Properties 
- `header` - the block's [`header`](#blockheader)
- `transactionReceipt` - an array of [`TransactionReceipt`](#transactionreceipt) in the block
- `uncleList` - an array of uncle [`headers`](#blockheader)
- `raw` - an array of buffers containing the raw blocks.

### `Block` Methods

#### `block.genTxTrie(cb)`
Generates the transaction trie. This must be done before doing validation
- `cb` - the callback 

#### `block.hash()`
Returns the sha3-256 hash of the RLP encoding of the serialized block

#### `block.serialize()`
Returns the RLP serialization of the block.

#### `block.validate(parentBlock, grandParentBlock)`
Validates the entire block. Returns a `Boolean`
- `parentBlock` - the Parent Block of this block
- `grandParentBlock` - the Parent's Parent's Block. Need to validate uncle headers

#### `block.validateTransactions()`
Validates all of the transactions in the block. Returns a `Boolean`

#### `block.validateTransactionsTrie()`
Validates the transaction trie. Returns a `Boolean`

## `Blockheader`
A object that repersents the block header.
- file - [lib/blockheader.js](../lib/blockHeader.js)

### `Blockheader` Properties
- `parentHash` - the blocks' parnet's hash
- `sha3UncleList` - sha3(rlp_encode(uncle_list))
- `coinbase` - the miner address
- `stateRoot` - The root of a Merkle Patricia tree
- `sha3transactionList` - sha3(rlp_encode(transaction_list))
- `difficulty`
- `timestamp`
- `extraData`
- `number` - the height
- `raw` - an `Array` of `Buffers` forming the raw header

### `Blockheader` Methods

#### `blockheader.validate(parentBlock)`
Validate the `blockheader` returning a `Boolean`
- `parentBlock` - the parent`Block` of the header

#### `blockheader.canonicalGasLimit(parentBlock)`
Returns the canonical gas limit of the block
- `parentBlock` - the parent`Block` of the header

#### `blockheader.canonicalDifficulty(parentBlock)`
Returns the canoncical difficulty of the block
- `parentBlock` - the parent`Block` of the header

## `TransactionReceipt`
A object that repersents the Transaction Receipt.
- file - [lib/transactionreceipt.js](../lib/transactionReceipt.js)

### `TransactionReceipt` Properties
- `transaction`
- `state` - the state root after the `transaction` has been applied
- `gasUsed` - the amount of gas used by the `transaction`
