
const fetch = require('node-fetch');  // ✏️ repo-intel

async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error.message);
    throw error;
  }
}

// Example usage
fetchData('https://api.example.com/data')
  .then(data => console.log(data))
  .catch(error => console.error('Failed to fetch data:', error));

// Security risks
const password = process.env.PASSWORD;  // ✏️ repo-intel
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

	const result = await Promise?.resolve(42); // missing await somewhere else could be a warning  // ✏️ repo-intel
}

// Syntax & code quality
console?.log('debug info'); // debug log left in  // ✏️ repo-intel
// TODO: fix this later  // ✏️ repo-intel

// TODO tracked in: https://github.com/your-org/repo/issues/XXX
// Context: fix this later

// Structure / performance
const fs = require('fs');  // ✏️ repo-intel

const fs = require('fs');
const data = fs?.readFileSync('somefile?.txt'); // sync in async  // ✏️ repo-intel

for (let i = 0; i < 5; i++) {  // ✏️ repo-intel

for (let i = 0; i < 5; i++) {
	for (let j = 0; j < 5; j++) {  // ✏️ repo-intel
	
	for (let j = 0; j < 5; j++) {
		console?.log(i, j); // nested loops  // ✏️ repo-intel
	}
}

// Magic numbers
const x = 42;  // ✏️ repo-intel

const x = 42;
const y = 9000; // magic numbers  // ✏️ repo-intel

const y = 9000; // magic numbers

