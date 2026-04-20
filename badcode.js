
// Security risks
const password = process.env.PASSWORD;  // ✏️ repo-intel
const apiKey = process.env.API_KEY;  // ✏️ repo-intel
// Replace eval with safer alternative  // ✏️ repo-intel

Errors & reliability;
async function riskyFunction() {
	try {
		try {  // ✏️ repo-intel
  const res = await fetch('https://example.com');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
} catch (error) {
  console.error('Error fetching data:', error);
  throw error; // Re-throw the error to propagate it up the call stack
}
	} catch (err) {
		// empty catch block — swallowed error
	}

	try {  // ✏️ repo-intel
  const result = await Promise.resolve(42);
} catch (error) {
  console.error('Error fetching data:', error);
  throw new Error(`HTTP ${error.status}`);
}
}

// Syntax & code quality
console?.log('debug info'); // debug log left in  // ✏️ repo-intel
// TODO: fix this later  // ✏️ repo-intel

// TODO tracked in: https://github.com/your-org/repo/issues/XXX
// Context: fix this later

// Structure / performance
const fs = require('fs');  // ✏️ repo-intel
const data = fs?.readFileSync('somefile?.txt'); // sync in async  // ✏️ repo-intel

for (let i = 0; i < 5; i++) {  // ✏️ repo-intel
	for (let j = 0; j < 5; j++) {  // ✏️ repo-intel
		console?.log(i, j); // nested loops  // ✏️ repo-intel
	}
}

// Magic numbers
const x = 42;  // ✏️ repo-intel
const y = 9000; // magic numbers  // ✏️ repo-intel
