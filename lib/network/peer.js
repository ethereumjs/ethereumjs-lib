var util = require('util'),
  assert = require('assert'),
  domain = require('domain'),
  EventEmitter = require('events').EventEmitter,
  rlp = require('rlp'),
  _ = require('underscore'),
  bignum = require('bignum'),
  etherUtils = require('../utils'),
  logic = require('./logic.js'),
  Block = require('../block.js'),
  Transaction = require('../transaction.js'),
  codes = require('./codes.js');

/**
 * @contructor
 * @param {Object} socket an Intialized Sockets. MUST alread be connected
 * @param {Object} network the network that initailized the connection
 */
var Peer = exports = module.exports = function (socket, network) {
  // Register as event emitter
  EventEmitter.call(this);

  this.socket = socket;
  this.network = network;

  //the state of the peer
  this._state = {
    hello: false //has the handshake took place?
  };

  //create an id internall book keeping
  this.internalId = socket.remoteAddress + ':' + socket.remotePort;

  var self = this;
  socket.on('error', function (e) {
    self.emit('socet.error', e);
  });

  var data = new Buffer([]);
  socket.on('data', function (newData) {

    data = Buffer.concat([data, newData]);
    var more = true;

    while (more) {
      var parsedData = false,
        command;

      try {
        var payloadLen = parseInt(data.slice(4, 8).toString('hex'), 16);

        if (payloadLen > data.length + 8) {
          more = false;
        } else {
          var payload = rlp.decode(data.slice(8, payloadLen + 8));

          assert.equal(codes.syncToken, data.slice(0, 4).toString('hex'), 'Invalid Sync Token');
          data = data.slice(payloadLen + 8);

          command = codes.command[payload[0][0]];
          parsedData = self._parsePayload(command, payload);

          if (data.length === 0) {
            more = false;
          }
        }
      } catch (e) {
        more = false;
        data = new Buffer([]); //stop the while

        self.emit('parsing.error', e);
        self.sendDisconnect(0x02);
      }

      if (parsedData) {
        //emit events
        var eventData = ['message.' + command, parsedData, self];
        self.emit.apply(self, eventData);

        //broadcast on network
        self.network.emit.apply(self.network, eventData);

        //broadcast event to peer for type `message`
        eventData[0] = command;
        eventData.unshift('message');
        self.emit.apply(self, parsedData);
      }
    }
  });

  //bind the peer logic
  logic.logic(this);
};

util.inherits(Peer, EventEmitter);

/**
 * formats packets as a 4-byte synchronisation token (0x22400891), a 4-byte
 * 'payload size', to be interpreted as a big-endian integer and finally an
 * N-byte rlp-serialised data structure, where N is the aforementioned
 * 'payload size'.
 * @method sendMessage
 * @param {Object} message a the message that is being sent
 * @param {Function} cb a callback function
 */
Peer.prototype.sendMessage = function (message, cb) {
  var payload = rlp.encode(message),
    len = new Buffer(4);

  len.writeUInt32BE(payload.length, 0);
  var formatedPayload = Buffer.concat([new Buffer(codes.syncToken, 'hex'), len, payload]);
  this.socket.write(formatedPayload, cb);
};

/**
 * Sends the hello message
 * @method sendHello
 * @param {Buffer} td the total difficultly
 * @param {Buffer} bestHash the block Head
 */
Peer.prototype.sendHello = function (cb) {

  var caps = [];
  for (var cap in this.network.capabilities) {
    caps.push([cap, new Buffer([Number(this.network.capabilities[cap])])]);
  }

  var message = [
    null,
    this.network.protocolVersion,
    this.network.clientId,
    caps,
    this.network.port,
    new Buffer(this.network.id, 'hex')
  ];
  this.sendMessage(message, cb);
};

function parseHello(payload) {
  //build hello message
  var hello = {
    protocolVersion: payload[1][0],
    clientId: payload[2].toString(),
    capabilities: payload[3].map(function (p) {
      var cap = {};
      cap[p[0].toString()] = etherUtils.bufferToInt(p[1]);
      return cap;
    }),
    port: etherUtils.bufferToInt(payload[4]),
    id: payload[5].toString('hex'),
    ip: this.socket.remoteAddress
  };
  return hello;
}

/**
 * Inform the peer that a disconnection is imminent
 * @method sendDisconnect
 * @param {Number} [reason=0x00]
 * @param {Function} cb
 */
Peer.prototype.sendDisconnect = function (reason, cb) {
  var self = this;

  //delete peer from the list of connected peers
  delete this.network._peers[this.internalId];

  if (!reason) {
    reason = 0x00;
  }

  this.sendMessage([codes.code.disconnect, reason], function () {
    self.socket.end();
    if (_.isFunction(cb)) {
      cb();
    }
  });
};


/**
 * Requests an immediate reply of Pong from the peer
 * @method sendPing
 * @param {Function} cb
 */
Peer.prototype.ping = function (cb) {
  this.on('message.pong', cb);
  this._sendPing();
};


/**
 * Requests an immediate reply of Pong from the peer
 * @method sendPing
 * @param {Function} cb
 */
Peer.prototype._sendPing = function (cb) {

  this.sendMessage([codes.code.ping], cb);
};


/**
 * Reply to peer's Ping packet
 * @method sendPong
 * @param {Function} cb
 */
Peer.prototype._sendPong = function (cb) {
  this.sendMessage([codes.code.pong], cb);
};

/**
 * Request the peer to enumerate some known peers for us to connect to. This
 * should include the peer itself.
 * @method sendGetPeers
 * @param {Function} cb
 */
Peer.prototype.getPeers = function (cb) {
  this.once('message.peers', cb);
  this._sendGetPeers();
};

/**
 * Request the peer to enumerate some known peers for us to connect to. This
 * should include the peer itself.
 * @method sendGetPeers
 * @param {Function} cb
 */
Peer.prototype._sendGetPeers = function (cb) {
  this.sendMessage([codes.code.getPeers], cb);
};

/**
 * Specifies a number of known peers
 * @method sendPeers
 * @param {Function} cb
 */
Peer.prototype._sendPeers = function (cb) {
  var peers = this.network.peers;
  //inculde thy self
  peers.push(this.network);
  peers = encodePeers(peers);
  peers.unshift(codes.code.peers);
  this.sendMessage(peers, cb);
};


Peer.prototype.sendStatus = function (td, bestHash, genesisHash, cb) {
  var msg = [
    codes.code.status,
    this.network.ethVersion,
    this.network.networkID,
    td,
    bestHash,
    genesisHash
  ];

  this.sendMessage(msg, cb);
};

/**
 * Request the peer to send all transactions currently in the queue
 * @method sendGetTransactions
 * @param {Function} cb
 */
Peer.prototype.getTransactions = function (cb) {
  this.once('message.Transaction', cb);
  this._sendGetTransactions();
};

/**
 * Request the peer to send all transactions currently in the queue
 * @method sendGetTransactions
 * @param {Function} cb
 */
Peer.prototype._sendGetTransactions = function (cb) {
  this.sendMessage([codes.code.getTransactions], cb);
};

/**
 * Specify (a) transaction(s) that the peer should make sure is included on its
 * transaction queue.
 * @method sendTransactions
 * @param {Array.<Transaction>} transaction
 * @param {Function} cb
 */
Peer.prototype.sendTransactions = function (transactions, cb) {
  var msg = [codes.code.transactions];

  transactions.forEach(function (tx) {
    msg.push(tx.serialize());
  });

  this.sendMessage(msg, cb);
};

Peer.prototype.getBlockHashes = function (startHash, max, cb) {
  this.once('message.blockHashes', cb);
  this._sendGetBlockHashes(startHash, max);
};

Peer.prototype._sendGetBlockHashes = function (startHash, max, cb) {
  this.sendMessage([codes.code.getBlockHashes, startHash, etherUtils.intToBuffer(max)], cb);
};

Peer.prototype.sendBlockHashes = function (hashes, cb) {
  this.sendMessage([codes.code.blockHashes].concat(hashes), cb);
};

Peer.prototype.getBlocks = function (hashes, cb) {
  this.once('message.blocks', cb);
  this._sendGetBlocks(hashes);
};

Peer.prototype._sendGetBlocks = function (hashes, cb) {
  this.sendMessage([codes.code.getBlocks].concat(hashes), cb);
};

/**
 * Specify (a) block(s) that the peer should know about.
 * @method sendBlocks
 * @param {Array.<Block>} blocks
 * @param {Function} cb
 */
Peer.prototype.sendBlocks = function (blocks, cb) {
  var msg = [codes.code.blocks];

  blocks.forEach(function (block) {
    msg.push(block.serialize());
  });

  this.sendMessage(msg, cb);
};


Peer.prototype._parsePayload = function (command, payload) {

  switch (command) {
  case undefined:
  case 'hello':
    //hello
    //build hello message
    return parseHello.call(this, payload);

  case 'disconnect':
    //disconnect
    return {
      reason: codes.disconnect[payload[1][0]],
      code: payload[1]
    };

  case 'ping':
    //ping
    return {};

  case 'pong':
    //pong
    return {};

  case 'getPeers':
    //get peers
    return {};

  case 'peers':
    //peers
    return parsePeers(payload);

  case 'status':
    //status
    return {
      ethVersion: payload[1][0],
      networkID: payload[2][0],
      td: payload[3],
      bestHash: payload[4],
      genesisHash: payload[5]
    };

  case 'getTransactions':
    //get transactions
    return {};

  case 'transactions':
    //transactions
    return parseTxs(payload);

  case 'getBlockHashes':
    return {
      hash: payload[1],
      maxBlocks: payload[2]
    };

  case 'blockHashes':
    return payload.slice(1);

  case 'getBlocks':
    return payload.slice(1);

  case 'blocks':
    //blocks
    return parseBlocks(payload);

  default:
    //bad protocol
    throw ('invalid message id');
  }
};

function parseBlocks(payload) {
  //blocks
  var blocks = [];
  for (var i = 1; i < payload.length; i++) {
    blocks.push(new Block(payload[i]));
  }
  return blocks;
}

//parses an array of transactions
function parseTxs(payload) {
  var txs = [];
  for (var i = 1; i < payload.length; i++) {
    txs.push(new Transaction(payload[i]));
  }
  return txs;
}

function parsePeers(payload) {
  var message = [];
  //format message
  for (var i = 1; i < payload.length; i++) {
    var peer = payload[i];
    var peerObject = {
      publicIp: peer[0][0] + '.' + peer[0][1] + '.' + peer[0][2] + '.' + peer[0][3],
      port: bignum.fromBuffer(peer[1]).toNumber(),
      id: peer[2].toString('hex')
    };
    peerObject.internalId = peerObject.publicIp + ':' + peerObject.port;
    message.push(peerObject);
  }
  return message;
}

function encodePeers(peers) {
  var peerArray = [];
  peers.forEach(function (peer) {
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
