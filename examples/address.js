var crypto = require('crypto');
var ethUtil = require('ethereumjs-util');
var ecdsa = require('secp256k1');

var privateKey = crypto.randomBytes(32);
console.log('Your Private Key Is:');
console.log(privateKey.toString('hex'));

console.log('Your Ethereum address is:');
console.log(ethUtil.pubToAddress(ecdsa.createPublicKey(privateKey)).toString('hex'));
