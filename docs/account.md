- [`Account`](#account)
  - [`new Account([data])`](#new-accountdata)
  - [`Account` Properties](#account-properties)
  - [`Account` Methods](#account-methods)
    - [`account.serialize(data)`](#accountserializedata)
    - [`account.isContract()`](#accountiscontract)
    - [`account.toJSON()`](#accounttojson)
    - [`account.getCode(trie, cb)`](#accountgetcodetrie-cb)
    - [`account.storeCode(trie, code, cb)`](#accountstorecodetrie-code-cb)

## `Account`
Implements schema and functions relating to Accounts
- file - [lib/account.js](../lib/account.js)

### `new Account([data])`
Creates a new transaction object
- `data` - the RLP serialized `Buffer` or an `Array` of `Buffers`

### `Account` Properties
- `nonce` - The account's nonce.
- `balance`  - The account's balance in wie
- `stateRoot` - the stateRoot for the storage of the contract
- `codeHash` - the hash of the code of the contract

### `Account` Methods
#### `account.serialize()`
Returns the RLP serialization of the account

#### `account.isContract()`
Returns a `Boolean`.

#### `account.toJSON()`
Returns a JSON object of the account

#### `account.getCode(trie, cb)`
Fetches the code from the trie
- `trie` - the [trie](github.com/wanderer/merkle-patricia-tree) to storing the accounts
- `cb` - the callback

#### `account.storeCode(trie, code, cb)`
Stores the code in the trie
- `trie` - the [trie](github.com/wanderer/merkle-patricia-tree)
- `code` - a `Buffer`
- `cb` - the callback
