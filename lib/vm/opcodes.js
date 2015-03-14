const codes = {
  // 0x0 range - arithmetic ops
  0x00: ['STOP', 0],
  0x01: ['ADD', 3],
  0x02: ['MUL', 5],
  0x03: ['SUB', 3],
  0x04: ['DIV', 5],
  0x05: ['SDIV', 5],
  0x06: ['MOD', 5],
  0x07: ['SMOD', 5],
  0x08: ['ADDMOD', 8],
  0x09: ['MULMOD', 8],
  0x0a: ['EXP', 10],
  0x0b: ['SIGNEXTEND', 5],

  //0x10 range - bit ops
  0x10: ['LT', 3],
  0x11: ['GT', 3],
  0x12: ['SLT', 3],
  0x13: ['SGT', 3],
  0x14: ['EQ', 3],
  0x15: ['ISZERO', 3],
  0x16: ['AND', 3],
  0x17: ['OR', 3],
  0x18: ['XOR', 3],
  0x19: ['NOT', 3],
  0x1a: ['BYTE', 3],

  //0x20 range - crypto
  0x20: ['SHA3', 30],

  //0x30 range - closure state
  0x30: ['ADDRESS', 2],
  0x31: ['BALANCE', 20],
  0x32: ['ORIGIN', 2],
  0x33: ['CALLER', 2],
  0x34: ['CALLVALUE', 2],
  0x35: ['CALLDATALOAD', 3],
  0x36: ['CALLDATASIZE', 2],
  0x37: ['CALLDATACOPY', 3],
  0x38: ['CODESIZE', 2],
  0x39: ['CODECOPY', 3],
  0x3a: ['GASPRICE', 2],
  0x3b: ['EXTCODESIZE', 20],
  0x3c: ['EXTCODECOPY', 20],

  //'0x40' range - block operations
  0x40: ['BLOCKHASH', 20],
  0x41: ['COINBASE', 2],
  0x42: ['TIMESTAMP', 2],
  0x43: ['NUMBER', 2],
  0x44: ['DIFFICULTY', 2],
  0x45: ['GASLIMIT', 2],

  //0x50 range - 'storage' and execution
  0x50: ['POP', 2],
  0x51: ['MLOAD', 3],
  0x52: ['MSTORE', 3],
  0x53: ['MSTORE8', 3],
  0x54: ['SLOAD', 50],
  0x55: ['SSTORE', 0],
  0x56: ['JUMP', 8],
  0x57: ['JUMPI', 10],
  0x58: ['PC', 2],
  0x59: ['MSIZE', 2],
  0x5a: ['GAS', 2],
  0x5b: ['JUMPDEST', 1],

  //0x60, range
  0x60: ['PUSH', 3],
  0x61: ['PUSH', 3],
  0x62: ['PUSH', 3],
  0x63: ['PUSH', 3],
  0x64: ['PUSH', 3],
  0x65: ['PUSH', 3],
  0x66: ['PUSH', 3],
  0x67: ['PUSH', 3],
  0x68: ['PUSH', 3],
  0x69: ['PUSH', 3],
  0x6a: ['PUSH', 3],
  0x6b: ['PUSH', 3],
  0x6c: ['PUSH', 3],
  0x6d: ['PUSH', 3],
  0x6e: ['PUSH', 3],
  0x6f: ['PUSH', 3],
  0x70: ['PUSH', 3],
  0x71: ['PUSH', 3],
  0x72: ['PUSH', 3],
  0x73: ['PUSH', 3],
  0x74: ['PUSH', 3],
  0x75: ['PUSH', 3],
  0x76: ['PUSH', 3],
  0x77: ['PUSH', 3],
  0x78: ['PUSH', 3],
  0x79: ['PUSH', 3],
  0x7a: ['PUSH', 3],
  0x7b: ['PUSH', 3],
  0x7c: ['PUSH', 3],
  0x7d: ['PUSH', 3],
  0x7e: ['PUSH', 3],
  0x7f: ['PUSH', 3],

  0x80: ['DUP', 3],
  0x81: ['DUP', 3],
  0x82: ['DUP', 3],
  0x83: ['DUP', 3],
  0x84: ['DUP', 3],
  0x85: ['DUP', 3],
  0x86: ['DUP', 3],
  0x87: ['DUP', 3],
  0x88: ['DUP', 3],
  0x89: ['DUP', 3],
  0x8a: ['DUP', 3],
  0x8b: ['DUP', 3],
  0x8c: ['DUP', 3],
  0x8d: ['DUP', 3],
  0x8e: ['DUP', 3],
  0x8f: ['DUP', 3],

  0x90: ['SWAP', 3],
  0x91: ['SWAP', 3],
  0x92: ['SWAP', 3],
  0x93: ['SWAP', 3],
  0x94: ['SWAP', 3],
  0x95: ['SWAP', 3],
  0x96: ['SWAP', 3],
  0x97: ['SWAP', 3],
  0x98: ['SWAP', 3],
  0x99: ['SWAP', 3],
  0x9a: ['SWAP', 3],
  0x9b: ['SWAP', 3],
  0x9c: ['SWAP', 3],
  0x9d: ['SWAP', 3],
  0x9e: ['SWAP', 3],
  0x9f: ['SWAP', 3],

  0xa0: ['LOG', 375],
  0xa1: ['LOG', 375],
  0xa2: ['LOG', 375],
  0xa3: ['LOG', 375],
  0xa4: ['LOG', 375],

  //'0xf0' range - closures
  0xf0: ['CREATE', 32000],
  0xf1: ['CALL', 40],
  0xf2: ['CALLCODE', 40],
  0xf3: ['RETURN', 0],

  //'0x70', range - other
  0xff: ['SUICIDE', 0]
};


module.exports = function(op, full) {

  var code = codes[op] ? codes[op] : codes[0];
  var opcode = code[0];

  if (full) {
    if (opcode === 'LOG') {
      opcode += op - 0x9f;
    }

    if (opcode === 'PUSH') {
      opcode += op - 0x5f;
    }

    if (opcode === 'DUP') {
      opcode += op - 0x7f;
    }

    if (opcode === 'SWAP') {
      opcode += op - 0x8f;
    }
  }

  return {opcode: opcode, fee: code[1]};
};
