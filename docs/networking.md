- [`Network`](#network)
    - [`new Network([host], [post], [options])`](#new-networkhost-port-options)
    - [`Network` options](#network-options)
    - [`Network` methods](#network-methods)
        - [`network.listen([port], [host])`](#networklistenport-host)
        - [`network.connect(port, host, [callback])`](#networkconnectport-host-callback)
        - [`network.stop([callback])`](#networkstopcallback)
        - [`network.getPeers()`](#networkgetpeers)
        - [`network.getPeerList()`](#networkgetpeerlist)
        - [`network.broadcastPing([callback])`](#networkbroadcastpingcallback)
        - [`network.broadcastGetPeers([callback])`](#networkbroadcastgetpeerscallback)
        - [`network.broadcastTransactions(transactions, [callback])`](#networkbroadcasttransactionstxs-callback)
        - [`network.broadcastBlocks(blocks, [callback])`](#networkbroadcastblocksblocks-callback)
        - [`network.broadcastDisconnect(reason, [callback])`](#networkbroadcastdisconnectreason-callback)
    - [`Network` events](#network-events)
- [`Peer`](#peer)
    - [`Peer` methods](#peer-methods)
        - [`peer.sendHello([callback])`](#peersendhellocallback)
        - [`peer.sendDisconnect(reason, [callback])`](#peersenddisconnectreason-callback)
        - [`peer.sendPing([callback])`](#peersendpingcallback)
        - [`peer.sendPong([callback])`](#peersendpongcallback)
        - [`peer.sendGetPeers([callback])`](#peersendgetpeerscallback)
        - [`peer.sendPeers(peers, [callback])`](#peersendpeerspeers-callback)
        - [`peer.sendTransactions(transactions, [callback])`](#peersendtransactionstransactions-callback)
        - [`peer.sendBlocks(blocks, [callback])`](#peersendblocksblocks-callback)
        - [`peer.sendGetChain(parents, count,[callback])`](#peersendgetchainparents-count-callback)
        - [`peer.sendNotInChain([callback])`](#peersendnotinchaincallback)
        - [`peer.sendGetTransactions([callback])`](#peersendgettransactionscallback)
    - [`Peer` events](#peer-events)
- [Schemas](#schemas)
    -  [`peers`](#peers)
    -  [`getChain`](#getchain)
    -  [`blocks`](#blocks)
    -  [`header`](#header)
    -  [`transaction`](#transaction)
    -  [`disconnect`](#disconnect)

## `Network`
Implements Ethereum's [Wire Protocol](https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-Wire-Protocol) and provides networking functions.
- file - [lib/network/](../lib/network/)

### `new Network([options])`
Creates new Network object with the following arguments
- `options` - An object with the Network configuration. See [`Network` options](#network-options)

### `Network` options
When creating a Network the following options can be used to configure its behavoir.
- `ehtVersion` - The version of the Ethereum protocol this peer implements. Defaults to 33 at present.
- `timeout` - The lenght of time in milliseconds to wait for a peer to response after connecting to it
- `maxPeers` - The max number of peer the network will try to connect to
- `clientId` - specifies the client software identity, as a human-readable string 
- `publicIp` - The public ip of this node

### `Network` methods
#### `network.listen([port], [host])`
start the tcp server
- `host` - The hostname or IP address the server is bound to. Defaults to `0.0.0.0` which means any available network
- `port` - The TPC port the server is listening to. Defaults to port `30303` 

#### `network.connect(port, host, [callback])`
connect to a peer
- `host` - the hostname or IP of the peer
- `port` - the port of the peer
- `callback` - a callback function

#### `network.stop([callback])`
stops the tcp server and disconnects any peers
#### `network.getPeers()`
returns an array of connected peers a instances of the [peer object](#peer)
#### `network.getPeerList()`
returns an array of peers the server knows about but is not connected to. The server uses this list to replace peers that disconnect. 

#### `network.broadcastPing([callback])`
Broadcast a ping to all of the peers.

#### `network.broadcastGetPeers([callback])`
Broadcast a get peers packet to all of the peers.

#### `network.broadcastTransactions(transactions, [callback])` 
broadcasts an array of [transactions](API-transaction) to the connected peers
- `transactions` - an array of valid [transactions](API-transaction)

#### `network.broadcastBlocks(blocks, [callback])`
broadcast an array of [blocks](API-Block) to the connected peers
- `blocks` - an array of [blocks](API-Block) to broadcast

#### `network.broadcastDisconnect(reason, [callback])`
broadcast a disconnect packet to all of the peers
- `reason` - the reason the client is disconnecting. See [`peer.sendDisconnect(reason, [callback])`](#peersenddisconnectreason-callback)

### `Network` events
The Network object inherits from `Events.EventEmitter` and emits the following events.
- `'message.hello'` - emitted on receiving a hello packet. Provides a [`hello`](#hello) object as an argument.
- `'message.disconnect'` - emitted on receiving a disconnect packet.Provides a [`disconnect`](#disconnect) object as an argument.
- `'message.ping'` - emitted on receiving a ping
- `'message.pong'` - emitted on receiving a pong
- `'message.sendPeers'` - emitted on receiving a send a peers packet. 
- `'message.peers'` - emitted on receiving a peers packet. Provides a [`peers`](#peers) object as an argument.
- `'message.transaction'` - emitted on receiving a transaction packet. Provides a [`transaction`](API-transaction) object as an argument.
- `'message.blocks'` - emitted on receiving a blocks packet. Provides a [`blocks`](API-Block) object as an argument.
- `'message.getChain'` - emitted on receiving a get chain packet. Provides a [`getChain`](#getchain) object as an argument.
- `'message.getNotInChain'` - emitted on receiving a not in chain packet
- `'message.getTransactions'` - emitted on receiving a get transactions packet
 
Each of the events are provided with the following arguments in this order

- `message` - The decoded message parsed to an Object. [See event Message Objects](#event-message-objects)
- `peer` - The [peer](#peer) that emitted the event

## `Peer`
The peer represents a peer on the ethereum network. Peer objects cannot be created directly.
- file - [lib/network/peer.js](../tree/master/lib/network/peer.js)

### `Peer` methods
#### `peer.sendHello([callback])`
Sends the hello message
#### `peer.sendDisconnect(reason, [callback])`
Sends the disconnect message, where reason is one of the following integers
- `0x00` - Disconnect requested
- `0x01` - TCP sub-system error
- `0x02` - Bad protocol
- `0x03` - Useless peer
- `0x04` - Too many peers
- `0x05` - Already connected
- `0x06` - Wrong genesis block
- `0x07` - Incompatible network protocols
- `0x08` - Client quitting

#### `peer.sendPing([callback])`
Send Ping
#### `peer.sendPong([callback])`
Send Pong
#### `peer.sendGetPeers([callback])`
Send a get peers reqeust
#### `peer.sendPeers(peers, [callback])`
Send peer list TODO
- `peers` - an array of peers

#### `peer.sendTransactions(transactions, [callback])`
Sends a transaction list TODO
- `transactions` - an array of [transactions](API-transaction) to send

#### `peer.sendBlocks(blocks, [callback])`
Sends blocks
- `blocks` - an array of [blocks](API-Block) to send

#### `peer.sendGetChain(parents, count, [callback])`
Sends a request for part of a block chain TODO
- `parents` - an array of parent block hashes
- `count` - the number of requested blocks

#### `peer.sendNotInChain([callback])`
Sends not in chain message
#### `peer.sendGetTransactions([callback])`
Sends a request for transactions

##`Peer` events
peer events are the same as [`Network` events](#network-events)

# Schemas
After the payload is parsed it passed along to the events in form of these objects
#### `hello`
- `protocolVersion` - the protocol version of the peer
- `networkId` - should be 0 
- `clientId` - Specifies the client software identity, as a human-readable string (e.g. "Ethereum(++)/1.0.0"). 
- `capabilities` - pecifies the capabilities of the client as a set of boolean flags
    - `blockchainQuerying`  
    - `peerDiscovery`
    - `transactionRelaying`
- `port` -  specifies the port that the client is listening on 
- `ip` - the ip of the connecting peer
- `id` - a 512-bit hash that identifies this node

### `peers`
The peers message is an array of object with the following fields
- `ip` - The IP of the peer 
- `port` - The port of the peer
- `id` - The Id of the peer

### `getChain`
- `parents` - An array of parent block hashes
- `count` - The number of request blocks

### `disconnect`
- `reason` - the reason for the disconnect
