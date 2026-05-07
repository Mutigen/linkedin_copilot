#!/usr/bin/env node
/**
 * LinkedIn Copilot – File-Drop Runner
 *
 * Lies Posts aus input/posts-today.md, generiere Kommentare.
 *
 * Nutzung:
 *   node run-from-file.js
 *   npm run comments
 *
 * Posts trennen mit --- (drei Bindestriche auf einer eigenen Zeile).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = __dirname;
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

const INPUT_FILE = path.join(ROOT_DIR, 'input', 'posts-today.md');
const COPILOT_SCRIPT = path.join(ROOT_DIR, 'linkedin-copilot.js');

// --- Datei lesen ---

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`Fehler: Datei nicht gefunden – ${INPUT_FILE}`);
  console.error('Lege die Datei an und füge Posts ein, getrennt durch "---".');
  process.exit(1);
}

const raw = fs.readFileSync(INPUT_FILE, 'utf8');

// Abschnitte durch --- (3+ Bindestriche auf eigener Zeile) trennen
const sections = raw
  .split(/^-{3,}\s*$/m)
  .map((s) => s.trim())
  .filter((s) => {
    if (!s) return false;
    // Kommentar-Zeilen (nur # …) und leere Abschnitte ignorieren
    const meaningful = s
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#') && line.trim().length > 0);
    return meaningful.length > 0;
  });

if (sections.length === 0) {
  console.error('Keine Posts gefunden.');
  console.error(`Öffne ${INPUT_FILE} und füge Posts ein, getrennt durch "---".`);
  process.exit(1);
}

console.log(`✓ ${sections.length} Post(s) geladen aus input/posts-today.md`);

// --- Config bauen und linkedin-copilot.js aufrufen ---

const config = {
  useLinkedInMcp: false,
  manualPosts: sections,
};

const configArg = 'b64:' + Buffer.from(JSON.stringify(config)).toString('base64');

const result = spawnSync(process.execPath, [COPILOT_SCRIPT, configArg], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 0);
