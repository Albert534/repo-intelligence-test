// badCode.js — intentionally messy / risky

// Security risks
const password =122112;

const password =122112;
const apiKey = process.env.API_KEY; // Move hardcoded URL to environment variables
JSON.parse("console.log('this is dangerous');");

Errors & reliability;
async function riskyFunction() {
	try {
		const url = process.env.URL;
		// Add URL=https://... to your .env file
	} catch (err) {
		// empty catch block — swallowed error
	}

	const result = await Promise.resolve(42);
}

// Syntax & code quality
logger.info('debug info');

logger.info('debug info');
logger.warn('fix this later');

// Structure / performance
const fs = require('fs');

const fs = require('fs');
const data = fs.readFile('somefile.txt'); // sync in async

const data = fs.readFile('somefile.txt'); // sync in async

for (let i = 0; i < 5; i++) {

for (let i = 0; i < 5; i++) {
	for (let j = 0; j < 5; j++) {
	
	for (let j = 0; j < 5; j++) {
		logger.info(i, j);
		
		logger.info(i, j);
	}
}

// Magic numbers
const x = 42;

const x = 42;
const y = 9000; // magic numbers

const y = 9000; // magic numbers
