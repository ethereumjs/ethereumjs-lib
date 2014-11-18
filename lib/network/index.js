var net = require('net'),
  crypto = require('crypto'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  _ = require('underscore'),
  async = require('async'),
  Peer = require('./peer'),
  pjson = require('../../package.json');

/**
 * Creates new Network object
 * @class Implements Ethereum's Wire Protocol and provides networking functions.
 * @param {Object} options
 * @param {Number} [options.protocolVersion=1] The network version
 * @param {String} [options.publicIp] The public ip address of this instance
 * @param {Object} [options.caps] A hash containing the capbilities of this node and their corrisponding version numbers
 * @param {Number} [options.timeout=20000] The length of time in milliseconds to wait for a peer to response after connecting to it
 * @param {Number} [options.maxPeers=10] The max number of peer the network will try to connect to
 * @param {String} [options.clientId] Specifies the client software identity, as a human-readable string
 * @param {String} [options.nodeId] the Unique Identity of the node and specifies a 512-bit hash that identifies this node.
 * @property {Array.<Peer>} peers an array of connected peers
 * @property {Array.<Peer>} knownPeers an array of peers the server knows about but is not connected to. The server uses this list to replace peers that disconnect.
 */
var Network = exports = module.exports = function (options) {

  //Register as event emitter
  EventEmitter.call(this);

  //setup defaults
  var optionDefaults = {
    protocolVersion: 2,
    timeout: 20000, //10 seconds
    maxPeers: 10,
    clientId: 'Ethereum Node.js/' + pjson.version,
    networkID: 0,
    capabilities: {
      'eth': 42
    }
  };

  options = options ? options : {};
  _.defaults(options, optionDefaults);
  _.defaults(this, options);

  if (!this.id) {
    //generate a node id
    var hash = crypto.createHash('sha512');
    hash.update((Math.random())
      .toString());

    this.id = new Buffer(hash.digest('hex'), 'hex');
  }

  this._peers = {};
  this._peersList = {};
  this._stopping = false;
  this.port = 0;

  Object.defineProperties(this, {
    knownPeers: {
      get: function () {
        return _.values(this._peersList);
      }
    },
    peers: {
      get: function () {
        return _.values(this._peers);
      }
    }
  });

  this.server = net.createServer(this._onConnect.bind(this));
};

util.inherits(Network, EventEmitter);

/**
 * start the server
 * @method listen
 * @param {Number} [port=30303] The hostname or IP address the server is bound to. Defaults to 0.0.0.0 which means any available network
 * @param {String} [host='0.0.0.0'] The TPC port the server is listening to. Defaults to port 30303
 */
Network.prototype.listen = function (port, host, cb) {
  var self = this;
  this.host = host ? host : '0.0.0.0';
  this.port = port ? port : 30303;
  this.server.listen(this.port, this.host, function () {
    self._listening = true;
    if (_.isFunction(cb)) {
      cb();
    }
  });
};

/**
 * connects to a peer
 * @method connect
 * @param {Number} port the port of the peer
 * @param {String} host the hostname or IP of the peer
 * @param {Function} cb the callback
 */
Network.prototype.connect = function (port, host, cb) {
  var socket = new net.Socket(),
    self = this;

  if (!_.isFunction(cb)) {
    cb = function () {};
  }

  function onError(e) {
    cb(e);
  }

  function onTimeOut() {
    socket.destroy();
    cb();
  }

  socket.setTimeout(this.timeout);
  socket.once('timeout', onTimeOut);
  socket.once('error', onError);
  socket.on('connect', function () {
    socket.removeListener('error', onError);
    socket.removeListener('timeout', onTimeOut);
    self._onConnect(socket);
    cb();
  });
  socket.connect(port, host);
  return socket;
};

//creates a new peer object and adds it to the peer hash
Network.prototype._onConnect = function (socket) {
  if (!this.publicIp) {
    this.publicIp = socket.localAddress;
  }

  var peer = new Peer(socket, this),
    self = this;

  //disconnect delete peers
  socket.on('close', function () {
    self.emit('closing', peer);
    //delete refrances to the peer
    delete self._peers[peer.id];
    self._popPeerList();
  });

  peer.on('message.hello', function(hello){
    self._peers[hello.id] = peer;
  });

  peer.on('message.peers', function (peers) {
    var peersToBroadcast = [];
    for (var i = 0; i < peers.length; i++) {
      //save only the peers that are listening and to peers we are not already connected to
      if (peers[i].port !== 0 && !self._peers[peers[i].id] && self.id !== peers[i].id ) {
        //create uid and save to peerlist
        self._peersList[peers[i].id] = peers[i];
        peersToBroadcast.push(peers[i]);
      }
    }
    self.broadcastPeers(peersToBroadcast);
    //connects to new peers
    self._popPeerList();
  });

  this.emit('connect', peer);
};

/**
 * stops the tcp server and disconnects any peers
 * @method stop
 * @param {Function} cb the callback
 */
Network.prototype.stop = function (cb) {
  var self = this;
  this._stopping = true;
  //disconnect peers
  this.removeAllListeners();
  async.each(this.peers, function (peer, cb2) {
    peer.socket.once('end', cb2);
    //0x08 Client quitting.
    peer.sendDisconnect(0x08, function () {
      peer.socket.end();
    });
  }, function () {
    if (self._listening) {
      self.server.close(cb);
      self._listening = false;
    } else if (_.isFunction(cb)) {
      cb();
    }
  });
};

//broadcast an array of blocks to the network
Network.prototype.broadcastBlocks = function (blocks, cb) {
  this._broadcast('sendBlocks', blocks, cb);
};

//broadcast an array of transactions to the network
Network.prototype.broadcastTransactions = function (txs, cb) {
  this._broadcast('sendTransactions', txs, cb);
};

Network.prototype.broadcastGetPeers = function (cb) {
  this._broadcast('sendGetPeers', cb);
};

Network.prototype.broadcastPing = function (cb) {
  this._broadcast('sendPing', cb);
};

Network.prototype.broadcastGetChain = function (parents, count, cb) {
  this._broadcast('sendGetChain', parents, count, cb);
};

Network.prototype.broadcastGetTransactions = function (cb) {
  this._broadcast('sendGetTransactions', cb);
};

Network.prototype.broadcastDisconnect = function (reason, cb) {
  this._broadcast('sendDisconnect', reason, cb);
};

Network.prototype.broadcastPeers = function (peers, cb) {
  this._broadcast('_sendPeers', peers, cb);
};

Network.prototype.broadcastNewBlock = function (block, td, cb) {
  this._broadcast('sendNewBlock', block, td, cb);
};

/**
 * broadcast messages to the network
 * @method _broadcast
 * @param {String} functionName - one peer's sending functions
 * @param {..} - the argments for the function
 * @param cb - a callback
 * @private
 */
Network.prototype._broadcast = function () {
  var args = Array.prototype.slice.call(arguments),
    cb,
    fn = args.shift();

  if (_.isFunction(arguments[arguments.length - 1])) {
    cb = arguments.pop();
  }

  async.each(this.peers, function (peer, cb2) {
    var fargs = args.slice();
    fargs.push(cb2);
    peer[fn].apply(peer, fargs);
  }, cb);
};

/**
 * Pops peers off the peer list and connects to them untill we reach maxPeers
 * or we run out of peer in the peer list
 * @private
 */
Network.prototype._popPeerList = function () {

  var openSlots = this.maxPeers - this.peers.length,
    self = this;

  if (this.knownPeers.length > 0 && openSlots > 0 && !this._stopping) {
    var peers = this.knownPeers.splice(0, openSlots);
    async.each(peers, function (peer, done) {
      delete self._peersList[peer.id];
      self.connect(peer.port, peer.publicIp, done);
    });
  }
};
