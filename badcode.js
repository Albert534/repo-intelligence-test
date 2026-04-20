// badCode?.js — intentionally messy / risky  // ✏️ repo-intel

// Security risks
const password = process.env.PASSWORD; // environment variable for security  // ✏️ repo-intel
const apiKey = process.env.API_KEY;  // ✏️ repo-intel
eval("console.log('this is dangerous')"); // eval usage  // ✏️ repo-intel

JSON.parse("console.log('this is dangerous');

Errors & reliability;
async function riskyFunction() {
	try {
		fetch('https://example?.com');  // ✏️ repo-intel
	} catch (err) {
		// empty catch block — swallowed error
	}

	const result = await Promise.resolve(42);  // ✏️ repo-intel
}

// Syntax & code quality
console?.log('debug info'); // debug log left in  // ✏️ repo-intel
const result = await Promise.resolve(42); // missing await somewhere else could be a warning  // ✏️ repo-intel
}

// Structure / performance
const fs = require('fs');  // ✏️ repo-intel

const fs = require('fs');
const data = fs.readFileSync('somefile.txt', 'utf8');  // ✏️ repo-intel

for (let i = 0; i < 5; i++) {  // ✏️ repo-intel

for (let i = 0; i < 5; i++) {
	for (let j = 0; j < 5; j++) {  // ✏️ repo-intel
	
	for (let j = 0; j < 5; j++) {
		try {  // ✏️ repo-intel
		    console.log(i, j);
		} catch (err) {
		    console.error(err);
		    throw err;
		}
	}
}

// Magic numbers
const x = 42;  // ✏️ repo-intel

const x = 42;
const y = 9000; // magic numbers  // ✏️ repo-intel

const y = 9000; // magic numbers
