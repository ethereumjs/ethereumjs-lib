const crypto = require('crypto');
const BN = require('bn.js');
const sha256 = crypto.createHash('SHA256');
const fees = require('ethereum-common').fees;

var data = opts.data;
var results = {};

results.gasUsed = Math.ceil(data.length / 32) * fees.identityWordGas.v  +  fees.identityGas.v;
results.exception = 1;
results.returnValue =  opts.data;

if (opts.gasLimit.cmp(new BN(results.gasUsed)) === -1) {
  results.gasUsed = opts.gasLimit;
  results.exception = 0; // 0 means VM fail (in this case because of OOG)
  return results;
}

return results;
