require('dotenv').config();
const { analyzePR } = require('./your-file'); // adjust path

async function test() {
	const fakePayload = {
		pull_request: {
			number: 1,
			head: { sha: 'testsha123' },
			diff_url: 'https://github.com/vercel/next.js/pull/1.diff', // any public diff
		},
		repository: {
			full_name: 'test/repo',
		},
	};

	const result = await analyzePR(fakePayload);
	console.log('RESULT:', result);
}

test();
