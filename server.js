/**
 * Lokaler Template-Server für n8n.
 * Starten: node scripts/server.js
 * Läuft auf http://localhost:3001
 *
 * GET  /                   – minimale Browser-UI für LinkedIn Copilot
 * POST /api/linkedin/comment – Kommentarentwürfe aus einem eingefügten Post
 * POST /api/linkedin/dm      – DM-Vorlagen aus Signal/Context
 * POST /generate          – DOCX befüllen + PDF erzeugen
 * POST /linkedin-copilot  – LinkedIn Copilot Report erzeugen
 * GET  /health            – Health check
 */

const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const {
  generateCommentFromBody,
  generateDmFromBody,
  generateRawFromBody,
} = require('./lib/api-runtime');

const PUBLIC_DIR    = path.join(__dirname, 'public');
const PORT          = Number(process.env.N8N_AGENT_SERVER_PORT || 3001);
const SHOULD_OPEN_BROWSER = process.argv.includes('--open');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Ungültiges JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, 'Nicht gefunden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };

  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { status: 'ok' });
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }

  if (req.method === 'GET' && req.url === '/app.js') {
    return sendFile(res, path.join(PUBLIC_DIR, 'app.js'));
  }

  if (req.method === 'GET' && req.url === '/app.css') {
    return sendFile(res, path.join(PUBLIC_DIR, 'app.css'));
  }

  if (req.method === 'POST' && req.url === '/api/linkedin/comment') {
    try {
      return send(res, 200, await generateCommentFromBody(await parseBody(req)));
    } catch (e) {
      console.error('LinkedIn Kommentar Fehler:', e.message);
      return send(res, e.statusCode || 500, { error: e.message });
    }
  }

  if (req.method === 'POST' && req.url === '/api/linkedin/dm') {
    try {
      return send(res, 200, await generateDmFromBody(await parseBody(req)));
    } catch (e) {
      console.error('LinkedIn DM Fehler:', e.message);
      return send(res, e.statusCode || 500, { error: e.message });
    }
  }

  if (req.method === 'POST' && req.url === '/linkedin-copilot') {
    try {
      return send(res, 200, await generateRawFromBody(await parseBody(req)));
    } catch (e) {
      console.error('LinkedIn Copilot Fehler:', e.message);
      return send(res, e.statusCode || 500, { error: e.message });
    }
  }

  send(res, 404, { error: 'Nicht gefunden' });
});

server.listen(PORT, () => {
  console.log(`LinkedIn Copilot laeuft auf http://localhost:${PORT}`);
  console.log(`   GET  /                   – LinkedIn Copilot UI`);
  console.log(`   POST /api/linkedin/comment – Kommentarentwuerfe`);
  console.log(`   POST /api/linkedin/dm      – DM-Vorlagen`);
  console.log(`   POST /linkedin-copilot  – LinkedIn Copilot Report erzeugen`);
  console.log(`   GET  /health            – Status pruefen`);

  if (SHOULD_OPEN_BROWSER) {
    const url = `http://localhost:${PORT}`;
    execFile('open', [url], (error) => {
      if (error) console.error(`Browser konnte nicht geoeffnet werden: ${error.message}`);
    });
  }
});
