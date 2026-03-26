#!/usr/bin/env node

/**
 * Google Drive OAuth2 Setup Script
 *
 * Run this ONCE to get a refresh token for Google Drive backup.
 *
 * Usage:
 *   node scripts/gdrive-setup.js <client_id> <client_secret>
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.log('Usage: node scripts/gdrive-setup.js <client_id> <client_secret>');
  process.exit(1);
}

const REDIRECT_PORT = 3333;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file'],
  prompt: 'consent',
});

console.log('');
console.log('Opening browser for authorization...');
console.log('If it does not open, visit this URL manually:');
console.log('');
console.log(authUrl);
console.log('');

// Open URL in default browser
const { exec } = require('child_process');
exec(`open "${authUrl}"`);

// Start a temporary local server to catch the redirect
const server = http.createServer(async (req, res) => {
  const query = url.parse(req.url, true).query;

  if (query.code) {
    try {
      const { tokens } = await oauth2Client.getToken(query.code);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Success! You can close this tab.</h2><p>Go back to your terminal.</p></body></html>');

      console.log('');
      console.log('SUCCESS! Add these to your config.env:');
      console.log('');
      console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
      console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${clientSecret}`);
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('');
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h2>Error</h2><p>${error.message}</p></body></html>`);
      console.error('Error getting token:', error.message);
    }

    server.close();
    process.exit(0);
  } else if (query.error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<html><body><h2>Authorization denied</h2><p>${query.error}</p></body></html>`);
    console.error('Authorization denied:', query.error);
    server.close();
    process.exit(1);
  }
});

server.listen(REDIRECT_PORT, () => {
  console.log(`Waiting for authorization on http://localhost:${REDIRECT_PORT} ...`);
});
