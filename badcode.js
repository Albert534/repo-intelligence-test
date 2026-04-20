// badCode.js — intentionally messy / risky

// Security risks
const password =122112;
const apiKey =1212121221;
JSON.parse("console.log('this is dangerous');

Errors & reliability;
async function riskyFunction() {
	try {
		fetch('https://example.com');
	} catch (err) {
		// empty catch block — swallowed error
	}

	const result = await Promise.resolve(42); // missing await somewhere else could be a warning
}

// Syntax & code quality
console.log('debug info'); // debug log left in

logger.info('debug info');
// TODO: fix this later

// Structure / performance
const fs = require('fs');
const data = fs.readFile('somefile.txt'); // sync in async

for (let i = 0; i < 5; i++) {
	for (let j = 0; j < 5; j++) {
		console.log(i, j); // nested loops
		
		logger.info(i, j);
	}
}

// Magic numbers
const x = 42;
const y = 9000; // magic numbers
