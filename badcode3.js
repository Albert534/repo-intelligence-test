'use strict';

/**
 * security_vulnerabilities_demo.js
 * ─────────────────────────────────────────────
 * ⚠️  WARNING: THIS FILE IS INTENTIONALLY INSECURE ⚠️
 *
 * This file is a test fixture that deliberately triggers every pattern
 * defined in patterns/javascript/security.js. DO NOT deploy this code.
 *
 * Each section is labelled with the pattern ID it triggers.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ════════════════════════════════════════════════════════════════════════════
// CREDENTIAL EXPOSURE
// ════════════════════════════════════════════════════════════════════════════

// ── 1. hardcoded-password ─────────────────────────────────────────────────
const password = 'supersecret123';

// ── 2. exposed-api-key ────────────────────────────────────────────────────
const apiKey = 'AIzaSyD-9tSrke72I6vBVKIrBcZXSS2pGfFMRLg';

// ── 3. hardcoded-secret ───────────────────────────────────────────────────
const secret = 'myjwtsecrettoken99';

// ════════════════════════════════════════════════════════════════════════════
// INJECTION ATTACKS
// ════════════════════════════════════════════════════════════════════════════

// ── 4. eval-usage ─────────────────────────────────────────────────────────
function runUserCode(userInput) {
	return eval(userInput);
}

// ── 5. sql-injection ──────────────────────────────────────────────────────
function getUser(db, userId) {
	const query = `SELECT * FROM users WHERE id = ${userId}`;
	return db.query(query);
}

// ── 6. command-injection ──────────────────────────────────────────────────
function cloneRepo(repoUrl) {
	exec(`git clone ${repoUrl}`);
}

// ── 7. xss-inner-html ─────────────────────────────────────────────────────
function renderUserBio(userBio) {
	document.getElementById('bio').innerHTML = userBio;
}

// ── 8. xss-document-write ─────────────────────────────────────────────────
function writeGreeting(name) {
	document.write(name);
}

// ════════════════════════════════════════════════════════════════════════════
// CRYPTO / AUTHENTICATION
// ════════════════════════════════════════════════════════════════════════════

// ── 9. weak-random ────────────────────────────────────────────────────────
function generateSessionToken() {
	return Math.random() * 100000;
}

// ── 10. weak-bcrypt-salt ──────────────────────────────────────────────────
async function hashPassword(plaintext) {
	return bcrypt.hash(plaintext, 4);
}

// ── 11. jwt-no-algorithm-check ────────────────────────────────────────────
function verifyToken(token, jwtSecret) {
	return jwt.verify(token, jwtSecret);
}

// ── 12. weak-hash-algorithm ───────────────────────────────────────────────
function hashData(data) {
	return crypto.createHash('md5').update(data).digest('hex');
}

// ── 13. timing-attack ─────────────────────────────────────────────────────
function validateToken(token, expectedToken) {
	return token === expectedToken;
}

// ════════════════════════════════════════════════════════════════════════════
// TRANSPORT / COOKIES / TLS
// ════════════════════════════════════════════════════════════════════════════

// ── 14. insecure-cors-wildcard ────────────────────────────────────────────
const corsOptions = {
	origin: '*',
	credentials: true,
};

// ── 15. insecure-cookie ───────────────────────────────────────────────────
function setSessionCookie(res, sessionId) {
	res.cookie('session', sessionId, { maxAge: 86400000 });
}

// ── 16. insecure-http-request ─────────────────────────────────────────────
async function fetchUserData(userId) {
	return fetch(`http://api.example.com/users/${userId}`);
}

// ── 17. tls-reject-unauthorized-disabled ─────────────────────────────────
const https = require('https');
const insecureAgent = new https.Agent({
	rejectUnauthorized: false,
});

// ── 18. node-tls-reject-env-disabled ─────────────────────────────────────
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ════════════════════════════════════════════════════════════════════════════
// INPUT / OUTPUT HANDLING
// ════════════════════════════════════════════════════════════════════════════

// ── 19. open-redirect ─────────────────────────────────────────────────────
function handleLogin(req, res) {
	res.redirect(req.query.returnUrl);
}

// ── 20. prototype-pollution ───────────────────────────────────────────────
function mergeConfig(obj, key, value) {
	obj['__proto__'] = value;
}

// ── 21. path-traversal ────────────────────────────────────────────────────
function serveFile(req, res) {
	fs.readFile(req.query.filename, 'utf8', (err, data) => {
		res.send(data);
	});
}

// ── 22. redos-risk ────────────────────────────────────────────────────────
function validateInput(input) {
	const dangerousRegex = /([a-z]+)+$/;
	return dangerousRegex.test(input);
}

// ── 23. sensitive-data-in-url ─────────────────────────────────────────────
async function callExternalApi(userToken) {
	return fetch(`https://external.example.com/data?token=${userToken}&user=123`);
}

// ── 24. unsafe-target-blank ───────────────────────────────────────────────
function renderExternalLink(url, label) {
	return `<a href="${url}" target="_blank">${label}</a>`;
}

module.exports = {
	runUserCode,
	getUser,
	cloneRepo,
	renderUserBio,
	writeGreeting,
	generateSessionToken,
	hashPassword,
	verifyToken,
	hashData,
	validateToken,
	corsOptions,
	setSessionCookie,
	fetchUserData,
	insecureAgent,
	handleLogin,
	mergeConfig,
	serveFile,
	validateInput,
	callExternalApi,
	renderExternalLink,
};
