var Network = require('../lib/network'),
  RLP = require('rlp'),
  net = require('net'),
  assert = require('assert');

var internals = {
  //test port and host
  port: 4447,
  host: 'localhost'
};

describe('[Network]: Listening functions', function () {
  var network = new Network();
  it('should listen', function (done) {
    network.listen(internals.port, internals.host, done);
  });

  it('should stop listening', function (done) {
    network.stop(done);
  });
});

describe('[Network]: Connect functions', function () {

  var server;
  var network = new Network();
  var socket;

  it('should connect to a peer', function (done) {
    server = net.createServer();
    server.once('connection', function (sock) {
      socket = sock;
      done();
    });
    server.listen(internals.port, internals.host, function () {
      network.connect(internals.port, internals.host);
    });
  });

  it('should disconnect from peer', function (done) {
    socket.once('close', function () {
      done();
    });

    network.stop();
  });
});

describe('[Network]: Peer Messages', function () {

  var network = new Network(),
    network2 = new Network(),
    peer,
    peer2;

  before(function (done) {
    network2.listen(internals.port + 1, internals.host, done);
  });

  it('should send a hello message on connect', function (done) {
    network.once('message.hello', function () {
      done();
    });

    network2.on('connect', function (peer) {
      peer.hello(new Buffer('test'), new Buffer(32), new Buffer(32));
    });

    network.on('connect', function (peer) {
      peer.hello(new Buffer('test'), new Buffer(32), new Buffer(32));
    });

    network.connect(internals.port + 1, internals.host);
  });

  it('should store the peer in a hash', function () {
    var peers = network2.peers;
    assert(peers.length, 1);
    peer2 = peers[0];
  });

  it('should send a ping', function (done) {
    network.once('message.ping', function () {
      done();
    });
    peer2.ping();
  });

  it('should send a pong', function (done) {
    network.once('message.pong', function () {
      done();
    });
    peer = network.peers[0];
    peer.ping();
  });

  it('should send get peers', function (done) {
    network.once('message.getPeers', function () {
      done();
    });
    peer2.getPeers();
  });

  it('should send disconnect', function (done) {
    network.once('message.disconnect', function () {
      done();
    });
    peer2.disconnect(0x08);
  });

  it('should be not send anymore packets after dissconect', function (done) {
    network.once('message.ping', function () {
      throw ('packet was sent');
    });
    peer2.ping();
    done();
  });

});

describe('[Network]: Message Validation', function () {

  var lastData,
    network = new Network(),
    socket;

  before(function (done) {
    network.listen(internals.port + 2, internals.host, done);
  });

  beforeEach(function () {
    socket = new net.Socket();
  });

  it('should disconnect with reason 0x02 on invalid magic token', function (done) {
    function sendBadSyncToken(socket) {
      var message = [0x00, 0x00]; ///hello
      var BAD_SYNC_TOKEN = '22400892';
      var payload = RLP.encode(message);
      var len = new Buffer(4);
      len.writeUInt32BE(payload.length, 0);
      var formatedPayload = Buffer.concat([new Buffer(BAD_SYNC_TOKEN, 'hex'), len, payload]);
      socket.write(formatedPayload);
    }

    socket.on('data', function (data) {
      lastData = data;
    });

    socket.once('connect', function () {
      sendBadSyncToken(socket);
    });

    socket.once('close', function () {
      socket.removeAllListeners();
      assert.equal(lastData.toString('hex'), '2240089100000003c20102');
      done();
    });
    socket.connect(internals.port + 2, internals.host);
  });

  it('should disconnect with reason 0x02 given an invalid hello', function (done) {

    function sendBadSyncToken(socket) {
      var message = [0x00, 0x00]; ///hello
      var SYNC_TOKEN = '22400891';
      var payload = RLP.encode(message);
      var len = new Buffer(4);
      len.writeUInt32BE(payload.length, 0);
      var formatedPayload = Buffer.concat([new Buffer(SYNC_TOKEN, 'hex'), len, payload]);
      socket.write(formatedPayload);
    }

    socket.on('data', function (data) {
      lastData = data;
    });

    socket.on('connect', function () {
      sendBadSyncToken(socket);
    });

    socket.on('close', function () {
      assert.equal(lastData.toString('hex'), '2240089100000003c20102');
      done();
    });
    socket.connect(internals.port + 2, internals.host);
  });
});
