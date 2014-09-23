/*
 * This implements the logic for the Peers
 */

exports.logic = function (peer) {
  //send hello right away
  peer.on('message', function (payload) {
    //No other messages may be sent until a Hello is received
    if (payload[0][0] !== 0x00 && payload[0][0] !== undefined) {
      if (!peer._state.hello) {
        //Bad protocol
        peer.sendDisconnect(0x02);
      }
    }
  });

  peer.on('message.hello', function (hello) {
    this.capabilities = hello.capabilities;
    this._state.hello = true;
    this.id = hello.id;
    this.publicIp = hello.ip;
    this.port = hello.port;
    this.sendHello();
  });

  peer.on('message.status', function (status) {
    if( this.network.ethVersion !== status.ethVersion){
      peer.sendDisconnect(0x07);
    }
    this.td = status.td;
    this.bestHash = status.bestHash;
    //wait 2 seconds and get peers from this peer
    //we should only get one hello message
    setTimeout(peer._sendGetPeers.bind(peer), 200);
  });

  peer.on('message.ping', function () {
    peer._sendPong();
  });

  peer.on('message.getPeers', function () {
    peer._sendPeers();
  });

  peer.on('message.disconnect', function () {
    peer.socket.end();
  });
};
