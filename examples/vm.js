//This will demonstrate running code contained within a transaction.
//First import the necessary libraries and initailize some varibles.

var async = require('async'),
    Ethereum = require('../'),
    VM = Ethereum.VM,
    Account = Ethereum.Account,
    Transaction = Ethereum.Transaction,
    Trie = Ethereum.Trie,
    rlp = Ethereum.rlp;

//creating a trie that just resides in memory
var stateTrie = new Trie();

//create a new VM instance
var vm = new VM(stateTrie);

//we will use this later
var storageRoot;

//This transaction contains the initializtion code for the name register
var rawTx = ['00',
    '09184e72a000',
    '2710',
    '0000000000000000000000000000000000000000',
    '00',
    '7f4e616d65526567000000000000000000000000000000000000000000000000003057307f4e616d6552656700000000000000000000000000000000000000000000000000577f436f6e666967000000000000000000000000000000000000000000000000000073661005d2720d855f1d9976f88bb10c1a3398c77f5773661005d2720d855f1d9976f88bb10c1a3398c77f7f436f6e6669670000000000000000000000000000000000000000000000000000573360455760c75160c46000396000f2007f72656769737465720000000000000000000000000000000000000000000000006000350e0f604859602035560f6032590033560f603d596000335657336020355760203533570060007f756e7265676973746572000000000000000000000000000000000000000000006000350e0f6076595033560f6084596000335657600033570060007f6b696c6c000000000000000000000000000000000000000000000000000000006000350e0f60b55950604556330e0f60bb5933ff6000355660005460206000f2',
    '1b',
    '1da35136b9e0a791450628096b10bc51792aa1c21117c518d81d34aa032c23ff',
    '5d818440711a8b234ffea2bcb32932aa011fc87889725afd9d62c079f84e6ea5'
];

//This transaction should register the sending address as "null_radix"
var rawTx2 = ['01',
    '09184e72a000',
    '2710',
    'c8b97e77d29c5ccb5e9298519c707da5fb83c442',
    '00',
    '72656769737465720000000000000000000000000000000000000000000000006e756c6c5f726164697800000000000000000000000000000000000000000000',
    '1b',
    'a1f22689203a3303552b5360c28f7153ac31de94ad4db8ef80307acd02a9951d',
    '3522808a9024b67a0b3ba800536c8b06d09fab134c8d7a15486960ef073f0c40'
];


//Lets set up the state trie. We need to give the account which is sending the
//transaction enougth wei to send transaction and run the code.


//sets up the initial state and runs the callback when complete
function setup(cb) {
    //the address we are sending from
    var address = new Buffer('9bdf9e2cc4dfa83de3c35da792cdf9b9e9fcfabd', 'hex');
    //create a new account
    var account = new Account();
    
    //give the account some wei. 
    //This needs to be a `Buffer` or a string. all strings need to be in hex.
    account.balance = 'f00000000000000000'; 
    
    //store in the trie
    stateTrie.put(address, account.serialize(), cb);
}

//runs a transaction through the vm
function runTx(raw, cb) {
    //create a new transaction out of the raw json
    var tx = new Transaction(raw);
    
    //run the tx
    vm.runTx(tx, function (err, results) {
        var createdAddress = results.createdAddress;
        //log some results 
        console.log('gas used: ' + results.gasUsed.toString());
        if (createdAddress) console.log('address created: ' + createdAddress.toString('hex'));
        cb(err);
    });
}


// Now lets look at what we created.The transaction should have created a new account
// for the contranct in the trie.Lets test to see
// if it did.

function checkResults(cb) {
    var createdAddress = new Buffer('c8b97e77d29c5ccb5e9298519c707da5fb83c442', 'hex');
    
    //fetch the new account from the trie.
    stateTrie.get(createdAddress, function (err, val) {

        var account = new Account(val);
        
        //we will use this later! :)
        storageRoot = account.stateRoot;

        console.log('------results------');
        console.log('nonce: ' + account.nonce.toString('hex'));
        console.log('blance in wei: ' + account.balance.toString('hex'));
        console.log('stateRoot: ' + storageRoot.toString('hex'));
        console.log('codeHash:' + account.codeHash.toString('hex'));
        console.log('-------------------');
        cb(err);
    });
}

// So if everything went right we should have  "null_radix" stored at
// "0x9bdf9e2cc4dfa83de3c35da792cdf9b9e9fcfabd". To see this we need to print 
// out the name register's storage trie.

//reads and prints the storage of a contract
function readStorage(cb) {
    //we need to create a copy of the state root
    var storageTrie = stateTrie.copy();
    
    //Since we are using a copy we won't change the root of `stateTrie` 
    storageTrie.root = storageRoot;

    var stream = storageTrie.createReadStream();

    console.log('------Storage------');
    
    //prints all of the keys and values in the storage trie
    stream.on('data', function (data) {
        console.log('key: ' + data.key.toString('hex'));
        //remove the 'hex' if you want to see the ascii values
        console.log('Value: ' + rlp.decode(data.value).toString('hex'));
    });

    stream.on('end', cb);
}


// Lastly lets create a trace of the EMV code. This can be very usefully for
// debugging (and deherbing, don't smoke and code m'kay?) contracts.

//The VM provides a simple hook for each step the VM takes while running EVM code.

//runs on each opcode
vm.onStep = function (info, done) {
    //prints the program counter, the current opcode and the amount of gas left 
    console.log('[vm] ' + info.pc + ' Opcode: ' + info.opcode + ' Gas: ' + info.gasLeft.toString());

    //prints out the current stack
    info.stack.forEach(function (item) {
        console.log('[vm]    ' + item.toString('hex'));
    });
    //important! call `done` when your done messing around
    done();
};

//and finally 
//run everything
async.series([
    setup,
    async.apply(runTx, rawTx),
    async.apply(runTx, rawTx2),
    checkResults,
    readStorage
]);

// Now when you run you should see a complete trace. `onStep` provodes an 
// object that contians all the information on the current state of the `VM`. 
