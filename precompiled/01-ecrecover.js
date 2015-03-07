// buf = new Buffer(128);
// buf.fill(0);
// data = Buffer.concat([opts.data, buf]);

// msgHash = data.slice(0, 32);
// v = data.slice(32, 64);
// r = data.slice(64, 96);
// s = data.slice(96, 128);

// publicKey = ecdsaOps.ecrecover(msgHash, v, r, s);

// if (!publicKey) {
//   results.exception = 1; // 1 since there is no VM error
//   return results;
// }

// results.exception = 1;
// results.returnValue = utils.pad(utils.pubToAddress(publicKey), 32);

var ecdsaOps = require('../ecdsaOps.js');
var utils = require('ethereumjs-util');
var BN = require('bn.js');
var gasCost = 500;

results = {};

if (opts.gasLimit.cmp(new BN(gasCost)) === -1) {
  results.gasUsed = opts.gasLimit;
  results.exception = 0; // 0 means VM fail (in this case because of OOG)
  return results;
}

results.gasUsed = gasCost;

buf = new Buffer(128);
buf.fill(0);
data = Buffer.concat([opts.data, buf]);

 msgHash = data.slice(0, 32);
 v = data.slice(32, 64);
 r = data.slice(64, 96);
 s = data.slice(96, 128);

 publicKey = ecdsaOps.ecrecover(msgHash, v, r, s);

if (!publicKey) {
  results.exception = 1; // 1 since there is no VM error
  return results;
}

results.exception = 1;
results.returnValue = utils.pad(utils.pubToAddress(publicKey), 32);
return results;
