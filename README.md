
# SYNOPSIS
[![NPM Package](https://img.shields.io/npm/v/ethereumjs-lib.svg?style=flat-square)](https://www.npmjs.org/package/ethereumjs-util)
[![Gitter](https://img.shields.io/gitter/room/ethereum/ethereumjs-lib.svg?style=flat-square)](https://gitter.im/ethereum/ethereumjs-lib) or #ethereumjs on freenode  

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)  

A Javascript library of core [Ethereum](http://Ethereum.org) functions as described in the [Yellow Paper](https://github.com/ethereum/yellowpaper). This is a simple meta-module that provides the following modules. Most JS modules are tracked in [ethereumjs](https://github.com/ethereumjs)

 - [VM](https://github.com/ethereumjs/ethereumjs-vm) - The Ethereum virtual machine and state processing functions
 - [Blockchain](https://github.com/ethereumjs/ethereumjs-blockchain) - Blockchain managment
 - [Block](https://github.com/ethereumjs/ethereumjs-block) - Block Schema definition and validation
 - [Transaction](https://github.com/ethereumjs/ethereumjs-tx) - Transaction Schema definition and validation
 - [Account](https://github.com/ethereumjs/ethereumjs-account) - Account Schema definition and validation
 - [rlp](https://github.com/ethereumjs/rlp) - Recursive Length Prefix serialization
 - [Trie](https://github.com/ethereumjs/merkle-patricia-tree) - Modified Merkle Patricia Tree
 - [Ethash](https://github.com/ethereumjs/ethashjs) - Ethereum's Proof of Work algorithm
 - [utils](https://github.com/ethereumjs/ethereumjs-util) - Miscellaneous helper functions
 - [devp2p](https://github.com/ethereumjs/node-devp2p) - The networking protocol
 - [devp2p-dpt](https://github.com/ethereumjs/node-devp2p-dpt) - The disputed peer table

# BROWSER
`ethereumjs-lib` can be used with [`browserify`](http://browserify.org/). With the exception of the networking modules. 

# CONTRIBUTIONS

Patches welcome! Contributors are listed in the `package.json` file.
Please run the tests before opening a pull request and make sure that you are
passing all of them.

If you would like to contribute, but don't know what to work on, check
the issues list or ask on the forms or on IRC.

* [issues](http://github.com/ethereum/ethereumjs-lib/issues)
* [forum](https://forum.ethereum.org/categories/node-ethereum)


# BUGS

When you find issues, please report them:

* [web](http://github.com/ethereum/ethereumjs-tools/issues)
* [email](mailto:mb@ethdev.com)

# LICENSE
[MPL-2.0](https://tldrlegal.com/license/mozilla-public-license-2.0-(mpl-2))
