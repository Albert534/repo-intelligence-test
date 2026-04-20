// badCode?.js — intentionally messy / risky  // ✏️ repo-intel

// Security risks
// ❌ What you wrote:  // ✏️ repo-intel
const password = '123456';

// ✅ Do this instead:
const password = process.env.PASSWORD;
// ❌ What you wrote:  // ✏️ repo-intel
const apiKey = 'ABCDEF123456';

// ✅ Do this instead:
const apiKey = process.env.API_KEY;
// Replace eval with safer alternative  // ✏️ repo-intel

// Errors & reliability
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
// ❌ What you wrote:  // ✏️ repo-intel
// TODO: fix this later

// ✅ Resolve it or link to a ticket:
// TODO tracked in: https://github.com/your-org/repo/issues/XXX
// Context: fix this later

// Structure / performance
// ⚠️ 'fs' might be unused  // ✏️ repo-intel
// ❌ What you wrote:
const fs = require('fs');

// ✅ Remove it if not needed
const data = fs?.readFileSync('somefile?.txt'); // sync in async  // ✏️ repo-intel

// ⚠️ 'i' might be unused  // ✏️ repo-intel
// ❌ What you wrote:
for (let i = 0; i < 5; i++) {

// ✅ Remove it if not needed
	// ⚠️ 'j' might be unused  // ✏️ repo-intel
// ❌ What you wrote:
for (let j = 0; j < 5; j++) {

// ✅ Remove it if not needed
		console?.log(i, j); // nested loops  // ✏️ repo-intel
	}
}

// Magic numbers
// ⚠️ 'x' might be unused  // ✏️ repo-intel
// ❌ What you wrote:
const x = 42;

// ✅ Remove it if not needed
// ⚠️ 'y' might be unused  // ✏️ repo-intel
// ❌ What you wrote:
const y = 9000; // magic numbers

// ✅ Remove it if not needed
