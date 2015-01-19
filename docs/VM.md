- [`VM`](#vm)
  - [`new VM([StateTrie])`](#new-vmstatetrie)  
  - [`VM` methods](#vm-methods)  
    - [`vm.runBlock(block, [stateRoot], cb)`](#vmrunblockblock-stateroot-cb)
    - [`vm.runTx(params, cb)`](#vmruntxparams-cb)
    - [`vm.runCode(params, cb)`](#vmruncodeparams-cb)
    - [`vm.generateGenesis(cb)`](#vmgenerategenesiscb)
  - [`VM` debugging hooks](#vm-debugging-hooks)
    - [`vm.onTx`](#vmontx)
    - [`vm.onStep`](#vmonstep)

## `VM`
Implements Ethereum's VM and handle execution of blocks, transaction and EVM code.
- file - [lib/vm](../lib/vm)
- [example usage](https://wanderer.github.io/ethereum/nodejs/code/2014/08/12/running-contracts-with-vm/)

### `new VM([StateTrie])`
Creates a new VM object
- `StateTrie` - The [Patricia Merkle Tree](https://github.com/wanderer/merkle-patricia-tree) that contains the state

### `VM` methods
#### `vm.runBlock(opts, cb)`
Processes the `block` running all of the transaction it contains and updating the miner's account.
- `opts.block` - The [`Block`](./block.md) to process
- `opts.blockchain` - The [blockchain](./blockchain.md)
- `opts.root` - The state at which the trie should start with when running the block. If omited the current `trie.root` will be used
- `cb` - The callback

--------------------------------------------------------

#### `vm.runTx(opts, cb)`
Process a transaction.
- `opts.tx` - A [`Transaction`](./transaction.md) to run.
- `opts.block` - The block to which the `tx` belongs. If omited, any EVM code that accesses block properties will not run.
- `opts.blockchain` - The [blockchain](./blockchain.md)
- `cb` - The callback. It is given two arguments, an `error` string containing an error that may have happened or `null`, and a `results` object with the following propieties:
  - `gasUsed` - the amount of gas used by this transaction as a `bignum`
  - `callerAccount` - the resulting [`Account`](./account.md) that sent the transaction
  - `toAccount` - the resulting [`Account`](./account.md) that recieved the transaction
  - `createdAddress` - if the transaction created a new contract this is the resulting address as a `Buffer`
  - `vm` - contains the results from running the code, if any, as described in [`vm.runCode(params, cb)`](#vmruncodeparams-cb)

--------------------------------------------------------

#### `vm.runCode(opts, cb)`
Runs EVM code
- `opts.code` - The EVM code to run given as a `Buffer`
- `opts.data` - The input data given as a `Buffer`
- `opts.block` - The [`Block`](./block.md) the `tx` belongs to. If omited any EVM code that access block proporties will not run.
- `opts.blockchain` - The [blockchain](./blockchain.md)
- `opts.gasLimit` - The gas limit for the code given as an `Number` or a `bignum`.
- `opts.account` - The [`Account`](./account.md) that the exucuting code belongs to.
- `params.address` - The address of the account that is exucuting this code. The address should be a `Buffer` of 20bits.
- `opts.origin` - The address where the call originated from. The address should be a `Buffer` of 20bits.
- `opts.caller` - The address that ran this code. The address should be a `Buffer` of 20bits.
- `opts.bloom` - A bloom filter.
- `cb` - The callback. It is given two arguments, a `error` string containing an error that may have happen or `null` and a `results` object with the following propieties
  - `gasUsed` - the amount of gas as a `bignum` the code used to run. 
  - `gasRefund` - a `Bignum` containting the amount of gas to refund from deleting storage values
  - `suicide` - a `boolean`, whether the contract commited suicide
  - `account` - account of the code that ran
  - `expcetion` - a `boolean`, whethere or not the contract encoutered an exception
  - `exceptionErr` - a `String` describing the exception if there was one.
  - `returnValue` - a `Buffer` containing the value that was returned by the contract


--------------------------------------------------------

#### `vm.generateGenesis(cb)`
Generate the genesis state.

--------------------------------------------------------

### `VM` debugging hooks
#### `vm.onTx`
When `onTx` is assigned a function the VM will run that function at the begining of each transaction it processes. The `onTx` function is give the [`Transaction`](./transaction.md) and `done`. `done` must be called before the VM contunies

--------------------------------------------------------

#### `vm.onStep` 
When `onStep` is assigned a function the VM will run that function at the begining of each opcode. The `onStep` function is give an `Object` and `done`. `done` must be called before the VM contunies. The `Object` has the following propieties.
- `pc` - a `Number` repersenting the program counter
- `opcode` - the next opcode to be ran
- `gasLeft` - a `bignum` standing for the amount of gasLeft
- `stack` - an `Array` of `Buffers` containing the stack. 
- `account` - the [`Account`](./account.md) which owns the code running.
- `address` - the address of the `account`
