const tape = require('tape');
const async = require('async');
const runner = require('./stateRunner.js');
const sysOps = require('ethereum-tests/StateTests/stSystemOperationsTest.json');


var keys = Object.keys(sysOps);
async.eachSeries(keys, function(key, done) {

  tape(key, function(t) {
    runner(sysOps[key], {
      t: t
    }, function() {
      t.end();
      done();
    });
  });
});
