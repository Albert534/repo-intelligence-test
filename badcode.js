// badCode.js — intentionally messy / risky

// Security risks
const password = process.env.DB_PASSWORD; // use environment variable
const apiKey = process.env.API_KEY; // exposed API key
console.log('this is dangerous'); // replaced eval with direct log

function riskyFunction() {
	try {
		await fetch('https://example.com');
	} catch (err) {
		// empty catch block — swallowed error
	}

	const result = await Promise.resolve(42); // missing await somewhere else could be a warning
	
	// (delete this line)
	
	const _result = await Promise.resolve(42); // missing await somewhere else could be a warning
}

// Syntax & code quality
logger.info('debug info'); // debug log left in
// TODO: fix this later

// Structure / performance
const fs = require('fs');

// (delete this line)

const _fs = require('fs');
const data = fs.readFileSync('somefile.txt'); // sync in async

// (delete this line)

const _data = fs.readFileSync('somefile.txt'); // sync in async

for (let i = 0; i < 5; i++) {

// (delete this line)

for (let _i = 0; i < 5; i++) {
	for (let j = 0; j < 5; j++) {
	
	// (delete this line)
	
	for (let _j = 0; j < 5; j++) {
		logger.info(i, j); // nested loops
	}
}

// Magic numbers
const x = 42;

// (delete this line)

const _x = 42;
const y = 9000; // magic numbers

// (delete this line)

const _y = 9000; // magic numbers
