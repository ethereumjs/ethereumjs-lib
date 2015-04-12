// test.js
// Tim Hughes <tim@twistedfury.com>

/*jslint node: true, shadow:true */
"use strict";

var ethash = require('./ethash');
var util = require('./util');
var Keccak = require('./keccak');

// init params
var ethashParams = ethash.defaultParams();
//ethashParams.cacheRounds = 0;

console.log(ethashParams);
// create hasher
ethash.defaultParams.mixSize = 1024;
var seed = util.hexStringToBytes("7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e")
var hasher = new ethash.Ethash(ethashParams, seed);
console.log('Ethash cache hash: ' + util.bytesToHexString(hasher.cacheDigest()));

// var testHexString = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
// if (testHexString != util.bytesToHexString(util.hexStringToBytes(testHexString)))
//   throw Error("bytesToHexString or hexStringToBytes broken");


// var header = util.hexStringToBytes("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
// var nonce = util.hexStringToBytes("0000000000000000");
// var hash;

// startTime = new Date().getTime();
// var trials = 10;
// for (var i = 0; i < trials; ++i) {
//   hash = hasher.hash(header, nonce);
// }
// console.log("Light client hashes averaged: " + (new Date().getTime() - startTime) / trials + "ms");
// console.log("Hash = " + util.bytesToHexString(hash));
