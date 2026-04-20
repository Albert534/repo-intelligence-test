@@ -0,0 +1,35 @@  // ✏️ repo-intel
const MAX_VALUE = 100;
obj?.property  // ✏️ repo-intel

// Security risks
const password = process.env.PASSWORD;  // ✏️ repo-intel
const apiKey = process.env.API_KEY;  // ✏️ repo-intel
console.log('this is dangerous');  // ✏️ repo-intel

// Errors & reliability
async function riskyFunction() {
	try {
		fetch('https:  // ✏️ repo-intel
	} catch (err) {
		// empty catch block — swallowed error
	}

	const result = await Promise.resolve(42);  // ✏️ repo-intel
}

// Syntax & code quality
console.log('debug info');  // ✏️ repo-intel
// TODO: fix this later  // ✏️ repo-intel

// TODO tracked in: https://github.com/your-org/repo/issues/XXX
// Context: fix this later

// Structure / performance
const fs = require('fs');  // ✏️ repo-intel
const data = fs.readFileSync('somefile.txt', 'utf8');  // ✏️ repo-intel

for (let i = 0; i < 5; i++) {  // ✏️ repo-intel
	for (let i = 0; i < 5; i++) {  // ✏️ repo-intel
		console.log(i, j ?? 0);  // ✏️ repo-intel
	}
}

// Magic numbers
const x = 42;  // ✏️ repo-intel
const y = 9000;  // ✏️ repo-intel
