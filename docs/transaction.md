- [`Transaction`](#transaction)
    - [`new Transaction([data])`](#new-blockdata)
    - [`Transaction` Properties](#transaction-properties)
    - [`Transaction` Methods](#transaction-methods)
        - [`transaction.parse(data)`](#transactionparsedata)
        - [`transaction.serialize()`](#transactionserialize) 
        - [`transaction.hash([signature])`](#transactionhashsignature)
        - [`transaction.getSenderAddress()`](#transactiongetsenderaddress)
        - [`transaction.getSenderPublicKey()`](#transactiongetsenderpublickey)
        - [`transaction.validate()`](#transactionvalidate)
        - [`transaction.validateSignature()`](#transactionvalidatesignature)
        - [`transaction.getDataFee()`](#transactiongetdatafee)
        - [`transaction.getBaseFee()`](#transactiongetbasefee)
        - [`transaction.getUpfrontCost()`](#transactiongetupfrontcost)

## `Transaction`
Implements schema and functions relating to Ethereum transactions
- file - [lib/transaction.js](../lib/transaction.js)
- [example](https://wanderer.github.io/ethereum/2014/06/14/creating-and-verifying-transaction-with-node/)

### `new Transaction([data])`
Creates a new transaction object
- `data` - the serialized transaction (usually from the network) in a array of buffers as described in the [wire protocol](https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-Wire-Protocol)

### `transaction` Properties
- `type` - Either `message` or `contract`
- `raw` - The raw rlp decoded transaction.
- `nonce` 
- `to` - the to address
- `value` - the amount of ether sent
- `data` - this will contain the `data` of the message or the `init` of a contract.
- `v` 
- `r`
- `s`

--------------------------------------------------------

### `Transaction` Methods
#### `transaction.parse(data)`
parses a serialized transaction
- `data` - the serialized transaction (usually from the network) in a array of buffers as described in the [wire protocol](https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-Wire-Protocol)

#### `transaction.serialize()`
Returns the RLP serialization of the transaction

#### `transaction.hash([signature])`
Returns the SHA3-256 hash of the rlp transaction
- `signature` - a `Boolean` determining if to include the signature components of the transaction. Defaults to true.

#### `transaction.getSenderAddress()`
returns the senders address

#### `transaction.getSenderPublicKey()`
returns the public key of the  sender

#### `transaction.validate()`
returns a `Boolean` determinging if the transaction is schematiclly valid

#### `transaction.validateSignature()`
returns a `Boolean` determining if the signature is valid

#### `transaction.getDataFee()`
returns the amount of gas to be paid for the data in this transaction

#### `transaction.getBaseFee()`
returns the upfront fee (DataFee + TxFee)

#### `transaction.getUpfrontCost()`
returns the total amount needed in the account of the sender for the transaction to be valid
