//http://jsperf.com/function-vs-constructor-vs-eval/49
var Benchmark = require('benchmark');
var reload = require('require-reload')(require);
var binding = process.binding('contextify');
var Script = binding.ContextifyScript;
var suite = new Benchmark.Suite;
var fs = require('fs');
var vm = require('vm');


var r = fs.readFileSync('./tester.js').toString();
var r1 = r;
var a = new vm.Script(r, {
  filename: 'myfile.vm'
});
// add tests 
suite
  // .add('module load', function() {
  //   var test = reload('./tester.js');
  // })
  .add('eval', function() {
    eval(r)();
  })
  // .add('anon function', function(){
  //   var t = new Function('require', r);
  //   t(require);
  //   t(require);
  //   t(require);
  // })
  // .add('contextScipt', function() {

  //   a.runInNewContext({
  //     require: require,
  //     console: console
  //   });

  // }).add('raw', function() {

  //   const crypto = require('crypto');
  //   // console.log('random: ' + crypto.randomBytes(8).toString('hex'));
  //   crypto.randomBytes(8);
  // })
  // add listeners 
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').pluck('name'));
  })
  .on('error', function(e) {
    console.log('error', e)
  })
  // run async 
  .run({
    'async': true
  });
