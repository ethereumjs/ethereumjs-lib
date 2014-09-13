- [`Account`](#account)
  - [`new Account([data])`](#new-accountdata)
  - [`Account` Properties](#account-properties)
  - [`Account` Methods](#account-methods)
    - [`account.serialize(data)`](#accountserializedata)
    - [`account.isContract()`](#accountiscontract)

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
#### `account.serialize(data)`
#### `account.serialize()`
Returns the RLP serialization of the account

#### `account.isContract()`
Returns a `Boolean`.
