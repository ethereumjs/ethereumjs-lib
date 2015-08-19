SYNOPSIS [![Build Status](https://travis-ci.org/ethereum/ethereumjs-lib.svg?branch=master)](https://travis-ci.org/ethereum/ethereumjs-lib)
===========

A Javascript library of core [Ethereum](http://Ethereum.org) functions as described in the [Yellow Paper](https://github.com/ethereum/yellowpaper). This is a simple meta-module that provides the following modules.

 - [VM](https://github.com/ethereum/ethereumjs-vm) - The Ethereum vitural machine and state processing functions
 - [Block Chain](https://github.com/ethereum/ethereumjs-blockchain) - Blockchain managment
 - [Block](https://github.com/ethereum/ethereumjs-block) - Block Schema definition and validation
 - [Transaction](https://github.com/ethereum/ethereumjs-tx) - Transaction Schema definition and validation
 - [Account](https://github.com/ethereum/ethereumjs-account) - Account Schema definition and validation
 - [utils](https://github.com/ethereum/ethereumjs-util) - Miscellaneous helper functions
 - [rlp](https://github.com/wanderer/rlp) - Recusive Length Perfix serialization
 - [Trie](https://github.com/wanderer/merkle-patricia-tree) - Modified Merkle Patricia Tree
 - [devp2p](https://github.com/ethereum/node-devp2p)
 - [devp2p-dpt](https://github.com/ethereum/node-devp2p-dpt)

Most of the tests are in described in the [test repo](https://github.com/ethereum/tests)
To run the test run `npm test`. You can also run the tests directly by running `./bin/tester -a`   

# BROWSER
`ethereumjs-lib` can be used with [`browserify`](http://browserify.org/). 
For browser testing install testling `npm install testling -g` and run `testling -u`

# CONTRIBUTIONS

Patches welcome! Contributors are listed in the `package.json` file.
Please run the tests before opening a pull request and make sure that you are
passing all of them.

If you would like to contribute, but don't know what to work on, check
the issues list or ask on the forms or on IRC.

* [issues](http://github.com/ethereum/ethereumjs-lib/issues)
* [forum](https://forum.ethereum.org/categories/node-ethereum)
* [scrollback](https://scrollback.io/ethereumjs/all) or #ethereumjs on irc.freenode.net

# BUGS

When you find issues, please report them:

* [web](http://github.com/ethereum/ethereumjs-tools/issues)
* [email](mailto:mb@ethdev.com)

# LISCENCE
MLP-2.0
