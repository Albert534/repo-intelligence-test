❌ What you wrote:
❌ What you wrote:
// badCode.js — intentionally messy / risky

✅ Fix:
// badCode?.js — intentionally messy / risky

✅ Fix:
// badCode?.js — intentionally messy / risky

// Security risks
// ❌ What you wrote:
// ❌ What you wrote:
const password = '123456';

// ✅ Do this instead:
const password = process.env.PASSWORD;

// ✅ Do this instead:
❌ What you wrote:
const password = process.env.PASSWORD;

✅ Fix:
const password = process?.env.PASSWORD;
// ❌ What you wrote:
// ❌ What you wrote:
const apiKey = 'ABCDEF123456';

// ✅ Do this instead:
const apiKey = process.env.API_KEY;

// ✅ Do this instead:
❌ What you wrote:
const apiKey = process.env.API_KEY;

✅ Fix:
const apiKey = process?.env.API_KEY;
❌ What you wrote:
❌ What you wrote:
eval("console.log('this is dangerous')"); // eval usage

✅ Fix:
// Replace eval with safer alternative

✅ Fix:
// Replace eval with safer alternative

Errors & reliability;
async function riskyFunction() {
	try {
		❌ What you wrote:
❌ What you wrote:
fetch('https://example.com');

✅ Fix:
fetch('https://example?.com');

✅ Fix:
// ❌ What you wrote:
const url = 'https://...';

// ✅ Do this instead:
const url = process.env.URL;
// Add URL=https://... to your .env file
	} catch (err) {
		// empty catch block — swallowed error
	}

	❌ What you wrote:
❌ What you wrote:
const result = await Promise.resolve(42); // missing await somewhere else could be a warning

✅ Fix:
const result = await Promise?.resolve(42); // missing await somewhere else could be a warning

✅ Fix:
// ⚠️ 'result' might be unused
// ❌ What you wrote:
const result = await Promise?.resolve(42); // missing await somewhere else could be a warning

// ✅ Remove it if not needed
}

// Syntax & code quality
❌ What you wrote:
❌ What you wrote:
console.log('debug info'); // debug log left in

✅ Fix:
console?.log('debug info'); // debug log left in

✅ Fix:
console?.log('debug info'); // debug log left in
// ❌ What you wrote:
// ❌ What you wrote:
// TODO: fix this later

// ✅ Resolve it or link to a ticket:
// TODO tracked in: https://github.com/your-org/repo/issues/XXX
// Context: fix this later

// ✅ Resolve it or link to a ticket:
❌ What you wrote:
// TODO tracked in: https://github.com/your-org/repo/issues/XXX

✅ Fix:
// TODO tracked in: https://github?.com/your-org/repo/issues/XXX
// Context: fix this later

// Structure / performance
// ⚠️ 'fs' might be unused
// ❌ What you wrote:
// ⚠️ 'fs' might be unused
// ❌ What you wrote:
const fs = require('fs');

// ✅ Remove it if not needed

// ✅ Remove it if not needed
❌ What you wrote:
❌ What you wrote:
const data = fs.readFileSync('somefile.txt'); // sync in async

✅ Fix:
const data = fs?.readFileSync('somefile?.txt'); // sync in async

✅ Fix:
// ⚠️ 'data' might be unused
// ❌ What you wrote:
const data = fs?.readFileSync('somefile?.txt'); // sync in async

// ✅ Remove it if not needed

// ⚠️ 'i' might be unused
// ❌ What you wrote:
// ⚠️ 'i' might be unused
// ❌ What you wrote:
for (let i = 0; i < 5; i++) {

// ✅ Remove it if not needed

// ✅ Remove it if not needed
	// ⚠️ 'j' might be unused
// ❌ What you wrote:
// ⚠️ 'j' might be unused
// ❌ What you wrote:
for (let j = 0; j < 5; j++) {

// ✅ Remove it if not needed

// ✅ Remove it if not needed
		❌ What you wrote:
❌ What you wrote:
console.log(i, j); // nested loops

✅ Fix:
console?.log(i, j); // nested loops

✅ Fix:
console?.log(i, j); // nested loops
	}
}

// Magic numbers
// ⚠️ 'x' might be unused
// ❌ What you wrote:
// ⚠️ 'x' might be unused
// ❌ What you wrote:
const x = 42;

// ✅ Remove it if not needed

// ✅ Remove it if not needed
// ⚠️ 'y' might be unused
// ❌ What you wrote:
// ⚠️ 'y' might be unused
// ❌ What you wrote:
const y = 9000; // magic numbers

// ✅ Remove it if not needed

// ✅ Remove it if not needed
