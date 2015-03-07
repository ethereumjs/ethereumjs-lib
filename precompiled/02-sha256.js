var crypto = require('crypto');
var BN = require('bn.js');

sha256 = crypto.createHash('SHA256');
data = opts.data;
var dataGas = Math.ceil(data.length / 32) * 50;
var results = {};
results.gasUsed += dataGas;

var gasCost = 50;


if (opts.gasLimit.cmp(new BN(gasCost)) === -1) {
  results.gasUsed = opts.gasLimit;
  results.exception = 0; // 0 means VM fail (in this case because of OOG)
  return results;
}

results.gasUsed = gasCost;

sha256 = crypto.createHash('SHA256');
data = opts.data;
var dataGas = Math.ceil(data.length / 32) * 50;
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
