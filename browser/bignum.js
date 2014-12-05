//horrible horrible shims to get bigi to act like bignum
var bigi = require('bigi');

var bi = function (i, r) {
  if (typeof i === 'number' ) {
    i = i.toString();
  } else if (bigi.isBigInteger(i)) {
    return i;
  }

  return bigi(i, r);
};

function wrap(f2) {
  return function (i) {
    return this[f2](bi(i));
  };
}


bi.fromBuffer =  bigi.fromBuffer;
bigi.prototype.mul = wrap('multiply');
bigi.prototype.eq = wrap('equals');
bigi.prototype.sub = wrap('subtract');
bigi.prototype.div = wrap('divide');

bigi.prototype.toNumber = function () {
  return Number(this.toString());
};

bigi.prototype.ge = function (n) {
  var c = this.compareTo(bi(n));
  if (c >= 0) {
    return true;
  }
  return false;
};

bigi.prototype.gt = function (n) {
  var c = this.compareTo(bi(n));
  if (c > 0) {
    return true;
  }
  return false;
};

bigi.prototype.lt = function (n) {
  var c = this.compareTo(bi(n));
  if (c < 0) {
    return true;
  }
  return false;
};

module.exports = bi;
