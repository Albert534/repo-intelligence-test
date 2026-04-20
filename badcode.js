// badCode.js — intentionally messy / risky

// Security risks
const password = process.env.PASSWORD;
const apiKey = process.env.API_KEY;
JSON.parse("console.log('this is dangerous');


async function riskyFunction() {
	try {
		const url = process.env.URL;
		// Add URL=https://... to your .env file
	} catch (err) {
		// empty catch block — swallowed error
	}

	const result = await Promise.resolve(42); // missing await somewhere else could be a warning
	
	const result = await Promise.resolve(42); // missing await somewhere else could be a warning
}

// Syntax & code quality
logger.info('debug info');
// TODO: fix this later

// TODO tracked in: https://github.com/your-org/repo/issues/XXX
// Context: fix this later

// Structure / performance
const fs = require('fs');

const fs = require('fs');
const data = fs.readFile('somefile.txt'); // sync in async

for (let i = 0; i < 5; i++) {

for (let i = 0; i < 5; i++) {
	for (let j = 0; j < 5; j++) {
	
	for (let j = 0; j < 5; j++) {
		logger.info(i, j);
	}
}

// Magic numbers
const x = 42;

const x = 42;
const y = 9000; // magic numbers

const y = 9000; // magic numbers
