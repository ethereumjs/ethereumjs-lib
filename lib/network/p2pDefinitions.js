var utils = require('../utils.js'),
  codes = require('./codes.js'),
  bignum = require('bignum');

exports.offsets = {
  0x00: 'hello',
  0x01: 'disconnect',
  0x02: 'ping',
  0x03: 'pong',
  0x04: 'getPeers',
  0x05: 'peers'
};

exports.meta = {
  version: 2
};

function encodePeers(peers) {
  var peerArray = [];
  peers.forEach(function(peer) {
    if (peer.publicIp && peer.port !== 0) {
      var ip = new Buffer(peer.publicIp.split('.'));
      var port = new Buffer(2);
      port.writeUInt16BE(peer.port, 0);
      var id = new Buffer(peer.id, 'hex');
      peerArray.push([ip, port, id]);
    }
  });
  return peerArray;
}

function parseHello(payload) {
  //build hello message
  var caps = {};
  payload[3].forEach(function(p) {
    caps[p[0].toString()] = utils.bufferToInt(p[1]);
  });

  var hello = {
    protocolVersion: payload[1][0],
    clientId: payload[2].toString(),
    capabilities: caps,
    port: utils.bufferToInt(payload[4]),
    id: payload[5].toString('hex'),
    ip: this.socket.remoteAddress
  };
  return hello;
}

function parsePeers(payload) {
  var message = [];
  //format message
  for (var i = 1; i < payload.length; i++) {
    var peer = payload[i];
    var peerObject = {
      publicIp: peer[0][0] + '.' + peer[0][1] + '.' + peer[0][2] + '.' + peer[0][3],
      port: bignum.fromBuffer(peer[1]).toNumber(),
      id: peer[2].toString('hex'),
      recTime: new Date()
    };
    message.push(peerObject);
  }
  return message;
}

exports.send = {
  hello: function() {

    var caps = [];
    for (var cap in this.network.capabilities) {
      caps.push([cap, new Buffer([Number(this.network.capabilities[cap])])]);
    }

    var message = [
      this.network.protocolVersion,
      this.network.clientId,
      caps,
      this.network.port,
      new Buffer(this.network.id, 'hex')
    ];

    return message;
  },
  disconnect: function(reason, onDone) {
    var self = this;

    if (!reason) {
      reason = 0x00;
    }

    //define a on done hook
    onDone(function() {
      self.socket.end();
    });

    return [reason];
  },
  peers: function(peers) {
    peers = encodePeers(peers);
    return peers;
  }
};

exports.parse = {
  hello: parseHello,
  disconnect: function(payload) {
    return {
      reason: codes.disconnect[payload[1][0]],
      code: payload[1]
    };
  },
  peers: parsePeers
};
