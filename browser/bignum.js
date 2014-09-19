var bigi = require('bigi');

bigi.prototype.mul = bigi.prototype.multiply;
bigi.prototype.eq = bigi.prototype.equals;

module.exports = function(i, r){
  if('number' == typeof i){
    i = i.toString(); 
  }

  return bigi(i, r);
};


