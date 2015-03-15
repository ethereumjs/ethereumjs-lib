var crypto = require('crypto');
var BN = require('bn.js');

var sha256 = crypto.createHash('SHA256');
const fees = require('ethereum-common').fees;
var data = opts.data;
var results = {};
var gasCost = fees.sha256Gas.v;

results.gasUsed = gasCost;
var dataGas = Math.ceil(data.length / 32) * fees.sha256WordGas.v;
results.gasUsed += dataGas;

if (opts.gasLimit.cmp(new BN(gasCost + dataGas)) === -1) {
  results.gasUsed = opts.gasLimit;
  results.exception = 0; // 0 means VM fail (in this case because of OOG)
  return results;
}

hashStr = sha256.update(data).digest('hex');

results.exception = 1;
results.returnValue = new Buffer(hashStr, 'hex');

return results;
