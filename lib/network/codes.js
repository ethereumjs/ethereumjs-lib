var command = exports.command = {
  0x00: 'hello',
  0x01: 'disconnect',
  0x02: 'ping',
  0x03: 'pong',
  0x04: 'getPeers',
  0x05: 'peers',
  0x10: 'status',
  0x11: 'getTransactions',
  0x12: 'transactions',
  0x13: 'getBlockHashes',
  0x14: 'blockHashes',
  0x15: 'getBlocks',
  0x16: 'blocks',
  0x17: 'newBlock'
};

var code = exports.code = {};

for (var prop in command) {
  if (command.hasOwnProperty(prop)) {
    code[command[prop]] = Number(prop);
  }
}

exports.disconnect = {
  0x00: 'Disconnect requested',
  0x01: 'TCP sub-system error',
  0x02: 'Bad protocol',
  0x03: 'Useless peer',
  0x04: 'Too many peers',
  0x05: 'Already connected',
  0x06: 'Wrong genesis block',
  0x07: 'Incompatible network protocols',
  0x08: 'Client quitting'
};

exports.syncToken = '22400891';
