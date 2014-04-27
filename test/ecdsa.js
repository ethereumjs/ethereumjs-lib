require('chai').should();

var util=require('../src/util');
var ec=require('../src/ecdsa');
var conv=require('../src/convert');

describe('ecdsa', function(){
    describe('verify', function(){
        it('should verify an ecdsa signature', function(){
            var priv = util.bigIntFromHex(util.sha3('private key brainiac'));
            var msg = conv.hexToBytes(util.sha3('this is a message to sign'));
            
            var sig = ec.sign(msg, priv);

            var pub = ec.privToPub(priv);
            //pub = ec.recoverPubKey(sig, msg);

            var res  = ec.verify(sig, msg, pub, console);
            res.should.equal(true);
        })
        it('should detect an invalid ecdsa signature', function(){
            var priv = util.bigIntFromHex(util.sha3('private key brainiac'));
            var msg = conv.hexToBytes(util.sha3('this is a message to sign'));

            var sig = ec.sign(msg, priv);

            var priv = util.bigIntFromHex(util.sha3('a different key muahaha'));
            var pub = ec.privToPub(priv);

            var res  = ec.verify(sig, msg, pub, console); 
            res.should.equal(false);
        })
    })
});


