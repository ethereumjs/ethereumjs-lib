SYNOPSIS [![Build Status](https://travis-ci.org/ethereum/ethereumjs-lib.svg?branch=master)](https://travis-ci.org/ethereum/ethereumjs-lib)
===========

A Javascript library of core [Ethereum](http://Ethereum.org) functions as described in the [Yellow Paper](https://github.com/ethereum/yellowpaper) `ethereumjs-lib` can be used with [`browserify`](http://browserify.org/). 

# EXAMPLES
 - [Exploring the state trie](https://wanderer.github.io/ethereum/nodejs/code/2014/05/21/using-ethereums-tries-with-node/)
 - [Creating contracts and verifying transaction](https://wanderer.github.io/ethereum/2014/06/14/creating-and-verifying-transaction-with-node/)
 - [How to run contracts and create stack traces](https://wanderer.github.io/ethereum/nodejs/code/2014/08/12/running-contracts-with-vm/)

# API
`ethereumjs-lib` provides the following.

 - [Network](./docs/networking.md) - Networking protocol and peer managment
 - [VM](./docs/VM.md) - The Ethereum vitural machine and state processing functions
 - [Block Chain](./docs/blockchain.md) - Blockchain managment
 - [Block](./docs/block.md) - Block Schema definition and validation
 - [Transaction](./docs/transaction.md) - Transaction Schema definition and validation
 - [Bloom](./docs/bloom.md) - Bloom Filter
 - [Account](./docs/account.md) - Account Schema definition and validation
 - [utils](./docs/utils.md) - Miscellaneous helper functions
 - [rlp](https://github.com/wanderer/rlp) - Recusive Length Perfix serialization
 - [Trie](https://github.com/wanderer/merkle-patricia-tree) - Modified Merkle Patricia Tree

# TESTING
Tests use mocha
`npm test`

Most of the tests are in described in the [test repo](https://github.com/ethereum/tests)
To run the test run `npm test`. 

You can use the test run directly by running `./bin/tester -a` 
The test can take the following options  
`-a` runs all the tests  
`-s` runs all the state tests
`-v` runs all the VM tests 
`-r` runs a VM tests given a string which defines the test   
`--vmtrace <filename>` dumps a json VM trace to a file for VM and State tests  

In addition you can select specific VM and State tests with the following options    
`--file` run only one file in the [test repo](https://github.com/ethereum/tests)  
`--test` needs to be used with the `--file` option. Specifies a test from a file to run.  

For browser testing install testling `npm install testling -g` and run  
`testling -u`

######example usage
run a the CallRecursiveContract test from the stInitCodeTest file  
`./bin/tester --file stInitCodeTest --test CallRecursiveContract --vmtrace "trace.json"`

# CONTRIBUTIONS

Patches welcome! Contributors are listed in the `package.json` file.
Please run the tests before opening a pull request and make sure that you are
passing all of them.

If you would like to contribute, but don't know what to work on, check
the issues list or ask on the forms or on IRC.

* [issues](http://github.com/ethereum/ethereumjs-lib/issues)
* [task tracker](https://waffle.io/ethereum/ethereumjs-lib)
* [forum](https://forum.ethereum.org/categories/node-ethereum)
* #ethereum-dev on irc.freenode.net

# BUGS

When you find issues, please report them:

* [web](http://github.com/ethereum/ethereumjs-tools/issues)
* [email](mailto:mb@ethdev.com)

You can also look for null_radix in #ethereum-dev on irc://irc.freenode.net. 

# LISCENCE
GPL3
