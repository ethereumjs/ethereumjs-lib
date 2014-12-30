- [`Bloom`](#bloom)
  - [`new Bloom([bitvector])`](#new-bloom-bitvector)
  - [`Bloom` Properties](#bloom-properties)
  - [`Bloom` Methods](#bloom-methods)
    - [`bloom.add(element)`](#bloomaddelement)
    - [`bloom.check(element)`](#bloomcheckelement)
    - [`bloom.or(bloom)`] (#bloomorbloom)

## `Bloom`
Implements a 64 byte bloom filter  
- file - [lib/bloom.js](../lib/bloom.js)

### `new Bloom([bitvector])`
Creates a new transaction object
- `data` - the RLP serialized `Buffer` or an `Array` of `Buffers`

### `Account` Properties
- `bitvector` - The account's bitvector as a buffer.

### `Account` Methods
#### `bloom.add(element)`
Adds an element to the bloom
- `element` - a `Buffer` to add

#### `bloom.check(element)`
Checks if element is the bloom
- `element` - a `Buffer` to check

#### `bloom.or(bloom)`
bitwise ORs blooms together
- `bloom` - another `Bloom` to OR
