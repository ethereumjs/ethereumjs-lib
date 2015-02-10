var path = require('path');
var tape = require('tape');

tape('browserify', function(t) {
  var browserify = require('browserify');
  var b = browserify();
  b.add(path.join(__dirname, '/../index.js'));
  var s = b.bundle();
  s.on('error', function(err) {
    t.fail('got error: ' + err );
  });

  s.once('data', function() {
    t.end();
  });
});
