ethereum-lib [![Build Status](https://travis-ci.org/wanderer/ethereum-lib-node.svg?branch=master)](https://travis-ci.org/wanderer/ethereum-lib-node)
===========


A Javascript library of core [Ethereum](http://Ethereum.org) functions.

####Install
`npm install ethereumjs-lib`

### Usage
``` javascript
 var Network = require('ethereumjs-lib').Network;
 
 //create a new tcp server instance using network version 25
 var network = new Network({
   version: 25
 });

 //start listening for incoming connects
 network.listen(30303, '0.0.0.0');
```
#### Examples

 - [Exploring the state trie](https://wanderer.github.io/ethereum/nodejs/code/2014/05/21/using-ethereums-tries-with-node/)
 - [Creating contracts and verifying transaction](https://wanderer.github.io/ethereum/2014/06/14/creating-and-verifying-transaction-with-node/)
 - [How to run contracts and create stack traces](https://wanderer.github.io/ethereum/nodejs/code/2014/08/12/running-contracts-with-vm/)

#### API
`ethereumjs-lib` provides the following.

 - [Network](./docs/networking.md) - Networking protocol and peer managment
 - [VM](./docs/VM.md) - The Ethereum vitural machine and state processing functions
 - [Block Chain](./docs/blockchain.md) - Blockchain managment
 - [Block](./docs/block.md) - Block Schema definition and validation
 - [Transaction](./docs/transaction.md) - Transaction Schema definition and validation
 - [Account](./docs/account.md) - Account Schema definition and validation
 - [utils](./docs/utils.md) - Miscellaneous helper functions
 - [rlp](https://github.com/wanderer/rlp) - Recusive Length Perfix serialization
 - [Trie](https://github.com/wanderer/merkle-patricia-tree) - Modified Merkle Patricia Tree

####Testing
Tests use mocha
`npm test`

For browser testing install testling and run  
`testling -u`


####License
GPL3
