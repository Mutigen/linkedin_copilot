# LinkedIn Copilot

Minimaler LinkedIn-Copilot fuer MUT-i-GEN mit Browser-UI, Kommentar-Generierung, DM-Generierung und Anthropic-Moderation.

## Lokal starten

1. `.env` anlegen oder bestehende Werte eintragen.
2. `npm install`
3. `npm run linkedin:ui`
4. Browser auf `http://localhost:3001`

## Vercel

Das Projekt ist so vorbereitet, dass `public/` als statische UI und `api/` als Serverless Functions deployed werden.

### Wichtige Vercel Environment Variables

- `ANTHROPIC_API_KEY`
- `LINKEDIN_SKIP_OUTPUT_WRITE=true`
- `LINKEDIN_COMMENT_MODEL_PROVIDER=anthropic`
- `LINKEDIN_DM_MODEL_PROVIDER=anthropic`
- `ANTHROPIC_COMMENT_MODEL=claude-haiku-4-5-20251001`
- `ANTHROPIC_DM_MODEL=claude-haiku-4-5-20251001`
- `LINKEDIN_MCP_ENABLED=false`
- `LINKEDIN_COPILOT_MAX_PROFILES=10`
- `LINKEDIN_COPILOT_MAX_RECENT_POSTS=5`
- `LINKEDIN_COMMENT_CANDIDATE_LIMIT=12`

### Strategie-Datei auf Vercel

Die App erwartet eine lokale Strategie-Datei. Im Repository liegt sie unter `strategy/linkedin-strategie.md` und wird direkt verwendet. Du musst auf Vercel dafuer keinen externen Pfad mehr setzen.

### Output auf Vercel

Fuer deinen eigentlichen Use Case brauchst du keine persistente Ablage. Die App generiert Kommentar oder DM live im Response, und du copy-pastest direkt nach LinkedIn.

Deshalb ist fuer Vercel `LINKEDIN_SKIP_OUTPUT_WRITE=true` sinnvoll: keine Report-Dateien, keine Dateisystem-Abhaengigkeit, nur Live-Generierung.

Nur wenn du historische Reports dauerhaft speichern willst, brauchst du danach einen externen Speicher:

- Vercel Blob
- Supabase Storage
- Notion oder Airtable als Archiv

Ohne diese Ablage funktioniert die App auf Vercel fuer Live-Generierung praktisch genauso wie lokal, weil Brand, Strategie und Moderation direkt aus dem Repository und den Environment Variables kommen.

## API-Endpunkte

- `GET /api/health`
- `POST /api/linkedin/comment`
- `POST /api/linkedin/dm`
- `POST /api/linkedin-copilot`

## Architektur

- `linkedin-copilot.js`: zentrale Bewertungs- und Moderationslogik
- `lib/api-runtime.js`: gemeinsamer Adapter fuer lokale UI und Vercel API
- `server.js`: lokaler Entwicklungsserver
- `api/`: Vercel Serverless Functions
- `public/`: statische Browser-UI