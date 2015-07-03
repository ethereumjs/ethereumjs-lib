const async = require('async')
const BN = require('bn.js')
const Semaphore = require('semaphore')
const util = require('util')
const VM = require('./vm')
const Ethash = require('./ethash')
const Trie = require('merkle-patricia-tree')

//require('v8-profiler')
var sem = Semaphore(1)

BlockProcesser = module.exports = function(blockchain, vm, ethHash) {
  if (vm instanceof Trie)
    vm = new VM(vm, blockchain)

  if (ethHash instanceof Trie)
    ethHash = new Ethash(ethHash) 

  this.vm = vm
  this.ethHash = ethHash
  this.blockchain = blockchain
}

/**
 * processes blocks and adds them to the blockchain
 * @method onBlock
 * @param {Aarray} - an `Array` of `Blocks`
 */
BlockProcesser.prototype.run = function(blocks, cb) {

  var self = this
  var blockErr;

  if (!Array.isArray(blocks))
    blocks = [blocks]

  //TODO: maybe? Move sem to `runBlock`
  sem.take(function() {
    //proccess the block and  update the world state
    async.eachSeries(blocks, function(block, cb2) {
        async.series([
            function(cb3){
              if(self.ethHash){
                self.ethHash.verifyPOW(block, function(valid){
                  if(valid)
                    cb3()
                  else
                    cb3('invalid POW') 
                })
              }else{
                cb3()
              }
            },
            //validate and run block
            function(cb3){
              block.validate(self.blockchain, function(err){
                blockErr = err
                cb3()
              })
            },
            function(cb3) {
              if(!blockErr){
                self.vm.runBlock({
                  block: block,
                  root: block.parentBlock.header.stateRoot
                }, function(err, results) {
                  blockErr = err
                  cb3()
                })
              }else{
                cb3()
              }
            },
            function(cb3){
              if(!blockErr)
                self.blockchain.addBlock(block, cb3)
              else
                cb3()
            }
          ],
          function(err) {
            cb2(err)
          })
      },
      function(err) {
        console.log('blockErr: ' + blockErr)
        sem.leave()
        if (cb) cb(blockErr)
      })
  })
}
