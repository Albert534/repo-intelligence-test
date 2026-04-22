// badCode.js — intentionally messy / risky

// Security risks
const password = process.env.PASSWORD; // use environment variable instead of hardcoded password
const apiKey = process.env.API_KEY; // moved to process.env and added to .gitignore
eval(JSON.stringify({ message: 'This is safe' }));

async function riskyFunction() {
	try {
		fetch(process.env.EXAMPLE_URL);
	} catch (err) {
		// empty catch block — swallowed error
	}

	const result = await Promise.resolve(42);
}

// Syntax & code quality
console.error('debug info');
const logger = console;
logger.warn('TODO: fix this later');

// Structure / performance
const fs = require('fs');

const fs = require('fs');
try {
  const data = fs.readFileSync('somefile.txt');
} catch (error) {
  throw new Error(`Failed to read file 'somefile.txt': ${error.message}`);
}

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
