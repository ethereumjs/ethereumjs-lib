var bigi = require('bigi');

var bi = function (i, r) {
  if ('number' == typeof i) {
    i = i.toString();
  } else if (bigi.isBigInteger(i)) {
    return i;
  }

  return bigi(i, r);
};

bi.fromBuffer = function (buf) {
  return bigi.fromBuffer(buf);
};

bigi.prototype.mul = wrap('multiply');
bigi.prototype.eq = wrap('equals');
bigi.prototype.sub = wrap('subtract');

bigi.prototype.toNumber = function () {
  return Number(this.toString());
};

bigi.prototype.ge = function (n) {
  var c = this.compareTo(n);
  if (c >= 0) {
    return true;
  }
  return false;
};

bigi.prototype.lt = function (n) {
  var c = this.compareTo(n);
  if (c < 0) {
    return true;
  }
  return false;
};


module.exports = bi;

function wrap(f2) {
  return function (i) {
    return this[f2](bi(i));
  };
}
