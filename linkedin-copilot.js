/**
 * MUT-i-GEN LinkedIn Copilot.
 *
 * Read-only workflow helper for n8n:
 * - optionally queries stickerdaniel/linkedin-mcp-server via stdio MCP
 * - scores profiles/posts against the local LinkedIn strategy
 * - writes a daily review report with comment, connection, and DM drafts
 *
 * It never calls write/action tools such as connect_with_person or send_message.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = __dirname;
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
const DEFAULT_STRATEGY_PATH = path.resolve(
  ROOT_DIR,
  'strategy',
  'linkedin-strategie.md'
);

function getDefaultOutputDir() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'linkedin-copilot');
  }

  return path.join(ROOT_DIR, 'output', 'linkedin-copilot');
}

const DEFAULT_OUTPUT_DIR = getDefaultOutputDir();

const READ_ONLY_TOOLS = new Set([
  'search_people',
  'get_person_profile',
  'get_sidebar_profiles',
  'get_company_profile',
  'get_company_posts',
]);

const BLOCKED_TOOLS = new Set([
  'connect_with_person',
  'send_message',
]);

const DEFAULT_SEARCH_QUERIES = [
  'Startup Gründer Founder Journey Deutschland',
  'Gründer Rückschlag Startup Deutschland',
  'Founder Journey SaaS Germany',
  'B2B SaaS Gründer Aufbau Deutschland',
  'Startup Gründer Fehler gelernt',
  'Pre-Seed Founder building Germany',
  'Seed Founder fundraising Germany',
  'AI SaaS Founder DACH',
  'Tech Startup Gründer Pre-Seed Deutschland',
  'Gründer Investor Pitch DACH',
];

const DEFAULT_EXCLUDED_PROFILE_URLS = [
  'https://www.linkedin.com/in/levan-lomidze-mutigen/',
];

const DEFAULT_EXCLUDED_NAMES = [
  'Levan Lomidze',
];

const ACTIVE_FOUNDER_TERMS = [
  'founder & ceo',
  'founder and ceo',
  'co-founder',
  'cofounder',
  'founder @',
  'founder of',
  'founder |',
  'founder,',
  'gründer &',
  'gründer bei',
  'gründerin',
  'geschäftsführer & gründer',
  'start-up-gründer',
  'startup-gründer',
  'ceo @',
  'cto @',
  'building ',
  'baue ',
  'wir bauen',
  'bootstrapped',
  'stealth startup',
];

const TECH_STARTUP_TERMS = [
  'saas',
  'software',
  'app',
  'platform',
  'plattform',
  'ai',
  'ki',
  'b2b',
  'deep tech',
  'healthtech',
  'edtech',
  'climate tech',
  'fintech',
  'sports tech',
  'digital tech',
  'data',
  'daten',
  'produkt',
  'product',
  'tech startup',
];

const FUNDRAISING_TERMS = [
  'pre-seed',
  'pre seed',
  'seed',
  'funding',
  'fundraising',
  'pitch',
  'investor-call',
  'investor call',
];

const COMMUNICATION_TERMS = [
  'positionierung',
  'website',
  'pitch deck',
  'story',
  'kommunikation',
  'trust',
  'vertrauen',
  'klarheit',
  'investor-sprache',
];

const INVESTOR_PROFILE_TERMS = [
  'pre-seed investor',
  'seed investor',
  'vc',
  'venture capital',
  'investment manager',
  'investment management',
  'senior investment',
  'head of investment',
  'investment analyst',
  'venture capital analyst',
  'principal@',
  'principal @',
  'general partner',
  'gp @',
  'partner @',
  'angel investment',
  'angel investments',
  'angel investor',
  'startup investor',
  'investor & mentor',
  'private equity',
  'high-tech gründerfonds',
  'htgf',
  'l-bank',
  'capacura',
  '42cap',
  'pre-seed expert',
  'pre-seed expertin',
];

const LOW_FIT_TERMS = [
  'recruiter',
  'headhunter',
  'coach für coaches',
  'crypto trader',
];

const JUNIOR_LOW_FIT_TERMS = [
  'student',
  'praktikant',
];

const POST_DIRECT_RELEVANCE_TERMS = [
  'pre-seed',
  'pre seed',
  'pre-seat',
  'seed round',
  'seed-runde',
  'seed funding',
  'finanzierungsrunde',
  'kapitalrunde',
  'fundraising',
  'funding',
  'raising',
  'investor',
  'investoren',
  'investor-ready',
  'investor ready',
  'investorensprache',
  'investor-sprache',
  'vc',
  'angel',
  'pitch',
  'pitch deck',
];

const POST_STRATEGY_RELEVANCE_TERMS = [
  'positionierung',
  'positioning',
  'website',
  'landing page',
  'story',
  'narrativ',
  'kommunikation',
  'klarheit',
  'trust',
  'vertrauen',
  'go-to-market',
  'gtm',
];

const POST_STARTUP_CONTEXT_TERMS = [
  'startup',
  'start-up',
  'founder',
  'gründer',
  'gründerin',
  'saas',
  'b2b',
  'tech startup',
  'software',
  'app',
  'ai',
  'ki',
];

const POST_FOUNDER_STORY_TERMS = [
  'founder journey',
  'gründerreise',
  'gründer journey',
  'worst advice',
  'aufbau',
  'bauen',
  'building in public',
  'build in public',
  'fehler',
  'mistake',
  'mistakes',
  'rückschlag',
  'ruckschlag',
  'wendepunkt',
  'gelernt',
  'lesson learned',
  'advice',
  'scheitern',
  'gescheitert',
  'growth',
  'sustainability',
  'vanity metrics',
  'solve problems',
  'customers',
  'bank account',
  'cashflow',
  'runway',
  'bootstrapped',
  'pivot',
  'launch',
  'erste kunden',
  'erster kunde',
  'erste nutzer',
  'traction',
  'product-market-fit',
  'product market fit',
];

const POST_ECOSYSTEM_ONLY_TERMS = [
  'matchmaking',
  'industrie-events',
  'industry events',
  'delegationsreisen',
  'ecosystem',
  'ökosystem',
  'oekosystem',
  'industrie',
  'delegation',
];

const GENERIC_INVESTOR_TERMS = new Set(['investor', 'investoren', 'vc', 'angel']);

const BUSINESS_SPECIFIC_FOUNDER_STORY_TERMS = new Set([
  'building in public',
  'build in public',
  'worst advice',
  'mistake',
  'mistakes',
  'growth',
  'sustainability',
  'vanity metrics',
  'solve problems',
  'customers',
  'bank account',
  'cashflow',
  'runway',
  'bootstrapped',
  'pivot',
  'launch',
  'erste kunden',
  'erster kunde',
  'erste nutzer',
  'traction',
  'product-market-fit',
  'product market fit',
]);

const PERSONAL_ONLY_TERMS = [
  'mother',
  'mutter',
  'father',
  'vater',
  'family',
  'familie',
  'grandmother',
  'grandfather',
  'diagnosed',
  'diagnose',
  'wheelchair',
  'rollstuhl',
  'marathon',
  'pilates',
  'hero',
  'heroes',
  'held',
  'heldin',
];

function log(message) {
  process.stderr.write(`[linkedin-copilot] ${message}\n`);
}

function parseCliConfig() {
  const rawArg = process.argv[2];
  if (!rawArg) return {};

  if (rawArg.startsWith('b64:')) {
    return JSON.parse(Buffer.from(rawArg.slice(4), 'base64').toString('utf8'));
  }

  if (fs.existsSync(rawArg)) {
    return JSON.parse(fs.readFileSync(rawArg, 'utf8'));
  }

  if (rawArg.trimStart().startsWith('{')) {
    return JSON.parse(rawArg);
  }

  throw new Error('Ungültiges Argument. Erwartet b64:<base64-json>, JSON oder Pfad zu JSON-Datei.');
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  return ['1', 'true', 'yes', 'ja', 'on'].includes(value.trim().toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : fallback;
  }

  return trimmed
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeConfig(input) {
  const outputDir = input.outputDir || process.env.LINKEDIN_COPILOT_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const configuredStrategyPath = input.strategyPath || process.env.LINKEDIN_STRATEGY_PATH || DEFAULT_STRATEGY_PATH;
  const strategyPath = fs.existsSync(configuredStrategyPath) ? configuredStrategyPath : DEFAULT_STRATEGY_PATH;
  const commentModelProvider = normalizeText(
    input.commentModelProvider || process.env.LINKEDIN_COMMENT_MODEL_PROVIDER || 'none'
  );
  const dmModelProvider = normalizeText(
    input.dmModelProvider || process.env.LINKEDIN_DM_MODEL_PROVIDER || commentModelProvider || 'none'
  );
  const maxProfiles = Math.min(
    parseNumber(input.maxProfiles || process.env.LINKEDIN_COPILOT_MAX_PROFILES, 30),
    60
  );
  const defaultSkipOutputWrite = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const excludedProfileUrls = parseList(
    input.excludedProfileUrls || process.env.LINKEDIN_EXCLUDED_PROFILE_URLS,
    DEFAULT_EXCLUDED_PROFILE_URLS
  );
  const excludedNames = parseList(
    input.excludedNames || process.env.LINKEDIN_EXCLUDED_NAMES,
    DEFAULT_EXCLUDED_NAMES
  );

  return {
    runDate: input.runDate || new Date().toISOString().slice(0, 10),
    strategyPath,
    outputDir,
    useLinkedInMcp: parseBoolean(input.useLinkedInMcp, parseBoolean(process.env.LINKEDIN_MCP_ENABLED, false)),
    location: input.location || process.env.LINKEDIN_SEARCH_LOCATION || 'Germany',
    searchQueries: parseList(input.searchQueries, DEFAULT_SEARCH_QUERIES),
    seedProfileUrls: parseList(input.seedProfileUrls, []),
    excludedProfileUrls,
    excludedNames,
    manualProfiles: parseList(input.manualProfiles, []),
    manualPosts: parseList(input.manualPosts, []),
    warmSignals: parseList(input.warmSignals, []),
    maxProfiles,
    maxRelatedProfilesPerSeed: Math.min(parseNumber(input.maxRelatedProfilesPerSeed, 10), 30),
    maxPostScrolls: Math.min(parseNumber(input.maxPostScrolls, 3), 10),
    maxRecentPosts: Math.min(parseNumber(input.maxRecentPosts || process.env.LINKEDIN_COPILOT_MAX_RECENT_POSTS, 5), 10),
    commentCandidateLimit: Math.min(parseNumber(input.commentCandidateLimit || process.env.LINKEDIN_COMMENT_CANDIDATE_LIMIT, 12), 25),
    commentModelProvider: commentModelProvider === 'anthropic' ? 'anthropic' : 'none',
    dmModelProvider: dmModelProvider === 'anthropic' ? 'anthropic' : 'none',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicCommentModel: input.anthropicCommentModel || process.env.ANTHROPIC_COMMENT_MODEL || 'claude-haiku-4-5-20251001',
    anthropicDmModel: input.anthropicDmModel || process.env.ANTHROPIC_DM_MODEL || input.anthropicCommentModel || process.env.ANTHROPIC_COMMENT_MODEL || 'claude-haiku-4-5-20251001',
    commentModelTimeoutMs: parseNumber(input.commentModelTimeoutMs || process.env.LINKEDIN_COMMENT_MODEL_TIMEOUT_MS, 45000),
    commentModelMaxTokens: Math.min(parseNumber(input.commentModelMaxTokens || process.env.LINKEDIN_COMMENT_MODEL_MAX_TOKENS, 700), 2000),
    dmModelTimeoutMs: parseNumber(
      input.dmModelTimeoutMs || process.env.LINKEDIN_DM_MODEL_TIMEOUT_MS,
      parseNumber(input.commentModelTimeoutMs || process.env.LINKEDIN_COMMENT_MODEL_TIMEOUT_MS, 45000)
    ),
    dmModelMaxTokens: Math.min(
      parseNumber(input.dmModelMaxTokens || process.env.LINKEDIN_DM_MODEL_MAX_TOKENS, 450),
      1500
    ),
    skipOutputWrite: parseBoolean(input.skipOutputWrite, parseBoolean(process.env.LINKEDIN_SKIP_OUTPUT_WRITE, defaultSkipOutputWrite)),
    mcpCommand: input.mcpCommand || process.env.LINKEDIN_MCP_COMMAND || 'uvx',
    mcpArgs: parseList(input.mcpArgs || process.env.LINKEDIN_MCP_ARGS, ['linkedin-scraper-mcp@latest']),
    mcpTimeoutMs: parseNumber(input.mcpTimeoutMs || process.env.LINKEDIN_MCP_TIMEOUT_MS, 180000),
  };
}

function usernameFromLinkedIn(value) {
  if (!value || typeof value !== 'string') return null;
  const decoded = decodeURIComponent(value.trim());
  const match = decoded.match(/(?:linkedin\.com\/in\/|\/in\/)([^/?#\s]+)/i);
  if (match) return match[1].replace(/\/$/, '');
  if (/^[a-z0-9-_%]+$/i.test(decoded)) return decoded.replace(/\/$/, '');
  return null;
}

function extractUsernamesDeep(value, output = new Set()) {
  if (!value) return output;

  if (typeof value === 'string') {
    const regex = /(?:https?:\/\/[^\s"']+)?\/in\/([^/?#\s"']+)/gi;
    let match;
    while ((match = regex.exec(value))) {
      output.add(match[1].replace(/\/$/, ''));
    }
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) extractUsernamesDeep(item, output);
    return output;
  }

  if (typeof value === 'object') {
    for (const item of Object.values(value)) extractUsernamesDeep(item, output);
  }

  return output;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(normalizedText, term) {
  const normalizedTerm = normalizeText(term);
  if (/^[a-z0-9]+$/.test(normalizedTerm) && normalizedTerm.length <= 3) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}($|[^a-z0-9])`).test(normalizedText);
  }
  return normalizedText.includes(normalizedTerm);
}

function matchTerms(text, terms) {
  const normalized = normalizeText(text);
  return terms.filter((term) => containsTerm(normalized, term));
}

function containsStandaloneTerm(normalizedText, term) {
  const normalizedTerm = normalizeText(term);
  if (/^[a-z0-9-]+$/.test(normalizedTerm)) {
    return new RegExp(`(^|[^a-z0-9-])${escapeRegExp(normalizedTerm)}($|[^a-z0-9-])`).test(normalizedText);
  }
  return normalizedText.includes(normalizedTerm);
}

function matchStandaloneTerms(text, terms) {
  const normalized = normalizeText(text);
  return terms.filter((term) => containsStandaloneTerm(normalized, term));
}

function stripHashtags(text) {
  return String(text || '')
    .replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHashtagText(text) {
  return (String(text || '').match(/#[\p{L}\p{N}_-]+/gu) || [])
    .map((tag) => tag.slice(1).replace(/[-_]+/g, ' '))
    .join(' ');
}

function canonicalProfileKey({ username, url, name }) {
  const linkedinUsername = usernameFromLinkedIn(url || '') || username;
  if (linkedinUsername) return `in:${linkedinUsername.toLowerCase()}`;
  return `name:${normalizeText(name)}`;
}

function isExcludedProfile({ username, url, name, text }, config) {
  const excludedUsernames = new Set(
    config.excludedProfileUrls
      .map(usernameFromLinkedIn)
      .filter(Boolean)
      .map((item) => item.toLowerCase())
  );
  const excludedNames = new Set(config.excludedNames.map(normalizeText));
  const profileUsername = (usernameFromLinkedIn(url || '') || username || '').toLowerCase();
  const profileNameNormalized = normalizeText(name);
  const profileTextNormalized = normalizeText(text);

  return (
    (profileUsername && excludedUsernames.has(profileUsername)) ||
    (profileNameNormalized && excludedNames.has(profileNameNormalized)) ||
    profileTextNormalized.includes('• sie')
  );
}

class McpClient {
  constructor({ command, args, timeoutMs }) {
    this.command = command;
    this.args = args;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.process = null;
  }

  async start() {
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, UV_HTTP_TIMEOUT: process.env.UV_HTTP_TIMEOUT || '300' },
    });

    this.process.stdout.on('data', (chunk) => this.handleData(chunk));
    this.process.stderr.on('data', (chunk) => {
      if (parseBoolean(process.env.LINKEDIN_COPILOT_DEBUG, false)) {
        process.stderr.write(chunk);
      }
    });
    this.process.on('exit', (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`MCP-Prozess beendet mit Code ${code}`));
      }
      this.pending.clear();
    });

    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mutigen-linkedin-copilot', version: '0.1.0' },
    });
    this.notify('notifications/initialized', {});
  }

  handleData(chunk) {
    this.buffer += chunk.toString('utf8');

    while (this.buffer.length > 0) {
      const contentLengthIndex = this.buffer.indexOf('Content-Length:');
      if (contentLengthIndex > 0) {
        this.buffer = this.buffer.slice(contentLengthIndex);
      }

      if (this.buffer.startsWith('Content-Length:')) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const header = this.buffer.slice(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          this.buffer = this.buffer.slice(headerEnd + 4);
          continue;
        }

        const length = Number(match[1]);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + length;
        if (this.buffer.length < bodyEnd) return;

        const body = this.buffer.slice(bodyStart, bodyEnd);
        this.buffer = this.buffer.slice(bodyEnd);
        this.dispatch(JSON.parse(body));
        continue;
      }

      const newlineIndex = this.buffer.indexOf('\n');
      if (newlineIndex === -1) return;

      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line || !line.startsWith('{')) continue;
      this.dispatch(JSON.parse(line));
    }
  }

  dispatch(message) {
    if (!Object.prototype.hasOwnProperty.call(message, 'id')) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      return;
    }

    pending.resolve(message.result);
  }

  send(message) {
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params = {}) {
    if (!this.process) throw new Error('MCP-Prozess ist nicht gestartet.');
    const id = this.nextId++;
    const message = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout bei MCP-Methode ${method}`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      this.send(message);
    });
  }

  notify(method, params = {}) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  async callTool(name, args = {}) {
    if (BLOCKED_TOOLS.has(name)) {
      throw new Error(`Blockiertes LinkedIn-Action-Tool: ${name}`);
    }
    if (!READ_ONLY_TOOLS.has(name)) {
      throw new Error(`Nicht freigegebenes LinkedIn-Tool: ${name}`);
    }

    const result = await this.request('tools/call', { name, arguments: args });
    return unwrapToolResult(result);
  }

  close() {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }
  }
}

function unwrapToolResult(result) {
  if (result && result.structuredContent) return result.structuredContent;
  if (!result || !Array.isArray(result.content)) return result;

  const text = result.content
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text)
    .join('\n');

  if (!text) return result;

  try {
    return JSON.parse(text);
  } catch (_) {
    return { text };
  }
}

async function collectWithLinkedInMcp(config, notes) {
  const client = new McpClient({
    command: config.mcpCommand,
    args: config.mcpArgs,
    timeoutMs: config.mcpTimeoutMs,
  });

  const usernames = new Set();
  const rawSearchResults = [];
  const rawSidebarResults = [];

  try {
    log(`Starte MCP: ${config.mcpCommand} ${config.mcpArgs.join(' ')}`);
    await client.start();

    for (const keywords of config.searchQueries.slice(0, 10)) {
      const result = await client.callTool('search_people', {
        keywords,
        location: config.location,
      });
      rawSearchResults.push({ keywords, result });
      for (const username of extractUsernamesDeep(result)) usernames.add(username);
    }

    for (const seedUrl of config.seedProfileUrls.slice(0, 5)) {
      const seedUsername = usernameFromLinkedIn(seedUrl);
      if (!seedUsername) continue;

      const sidebar = await client.callTool('get_sidebar_profiles', {
        linkedin_username: seedUsername,
      });
      rawSidebarResults.push({ seedUsername, result: sidebar });
      for (const username of extractUsernamesDeep(sidebar)) usernames.add(username);

      if (sidebar && sidebar.sidebar_profiles) {
        for (const list of Object.values(sidebar.sidebar_profiles)) {
          for (const profilePath of list.slice(0, config.maxRelatedProfilesPerSeed)) {
            const username = usernameFromLinkedIn(profilePath);
            if (username) usernames.add(username);
          }
        }
      }
    }

    const cappedUsernames = [...usernames].slice(0, config.maxProfiles);
    const profiles = [];
    for (const username of cappedUsernames) {
      const profile = await client.callTool('get_person_profile', {
        linkedin_username: username,
        sections: 'experience,posts',
        max_scrolls: config.maxPostScrolls,
      });
      profiles.push({ username, url: profile.url || `https://www.linkedin.com/in/${username}/`, source: 'linkedin_mcp', profile });
    }

    notes.push(`LinkedIn-MCP aktiv: ${profiles.length} Profile gelesen.`);
    return { profiles, rawSearchResults, rawSidebarResults };
  } finally {
    client.close();
  }
}

function normalizeManualProfile(item) {
  if (typeof item === 'string') {
    const username = usernameFromLinkedIn(item) || item.toLowerCase().replace(/\s+/g, '-');
    return {
      username,
      url: item.startsWith('http') ? item : `https://www.linkedin.com/in/${username}/`,
      source: 'manual',
      profile: { sections: { main_profile: item } },
    };
  }

  const username = usernameFromLinkedIn(item.url || item.username || item.linkedinUrl || '') || item.username || 'manual-profile';
  return {
    username,
    url: item.url || item.linkedinUrl || `https://www.linkedin.com/in/${username}/`,
    source: 'manual',
    profile: {
      sections: {
        main_profile: [item.name, item.headline, item.text].filter(Boolean).join('\n'),
        posts: Array.isArray(item.posts) ? item.posts.join('\n\n') : item.posts || '',
      },
    },
  };
}

function normalizeManualPost(item, index) {
  if (typeof item === 'string') {
    // Put the full text into main_profile so classifyProfile can find founder/tech terms.
    // Also keep it in posts so parseRecentFeedPosts / scoreRecentPostRelevance works.
    return {
      username: `manual-post-${index + 1}`,
      url: '',
      source: 'manual_post',
      profile: { sections: { main_profile: item, posts: item } },
    };
  }

  const username = usernameFromLinkedIn(item.authorUrl || item.url || item.username || '') || item.username || `manual-post-${index + 1}`;
  return {
    username,
    url: item.authorUrl || item.url || '',
    source: 'manual_post',
    profile: {
      sections: {
        main_profile: [item.authorName, item.authorHeadline].filter(Boolean).join('\n'),
        posts: item.text || item.postText || '',
      },
    },
  };
}

function combinedSections(profile) {
  const sections = profile.profile?.sections || {};
  return Object.values(sections).filter(Boolean).join('\n\n');
}

function profileCoreSections(profile) {
  const sections = profile.profile?.sections || {};
  return [sections.main_profile, sections.experience].filter(Boolean).join('\n\n');
}

function classifyProfile(profile, config) {
  const name = profileName(profile);
  const text = [name, profile.username, profile.url, profileCoreSections(profile)].filter(Boolean).join('\n');

  if (isExcludedProfile({ username: profile.username, url: profile.url, name, text }, config)) {
    return {
      category: 'self',
      target: false,
      reason: 'Eigenes Profil ausgeschlossen',
    };
  }

  if (profile.source === 'manual_post') {
    return {
      category: 'manual_post',
      target: true,
      reason: 'Manuell eingefügter Post; Relevanz wird am Beitrag geprüft',
    };
  }

  const activeFounderMatches = matchTerms(text, ACTIVE_FOUNDER_TERMS);
  const techMatches = matchTerms(text, TECH_STARTUP_TERMS);
  const fundraisingMatches = matchTerms(text, FUNDRAISING_TERMS);
  const communicationMatches = matchTerms(text, COMMUNICATION_TERMS);
  const investorMatches = matchTerms(text, INVESTOR_PROFILE_TERMS);
  const lowFitMatches = matchTerms(text, LOW_FIT_TERMS);
  const juniorLowFitMatches = matchTerms(text, JUNIOR_LOW_FIT_TERMS);

  if (investorMatches.length > 0) {
    return {
      category: 'investor_network',
      target: false,
      reason: `Investor-/VC-Profil: ${investorMatches.slice(0, 3).join(', ')}`,
    };
  }

  if (lowFitMatches.length > 0) {
    return {
      category: 'low_fit',
      target: false,
      reason: `Irrelevanzsignal: ${lowFitMatches.slice(0, 3).join(', ')}`,
    };
  }

  if (activeFounderMatches.length === 0) {
    const reason = juniorLowFitMatches.length > 0
      ? `Kein aktives Founder-/Startup-Building-Signal; Junior-Signal: ${juniorLowFitMatches.slice(0, 3).join(', ')}`
      : 'Kein aktives Founder-/Startup-Building-Signal';
    return {
      category: 'not_founder_target',
      target: false,
      reason,
    };
  }

  if (techMatches.length === 0 && fundraisingMatches.length === 0 && communicationMatches.length === 0) {
    return {
      category: 'not_tech_startup_target',
      target: false,
      reason: 'Founder-Signal ohne Tech/Startup/Fundraising/Positionierungsbezug',
    };
  }

  return {
    category: 'target_founder',
    target: true,
    reason: 'Aktiver Founder mit Tech-/Startup- und Strategie-Fit',
  };
}

function scoreText(text) {
  const normalized = normalizeText(text);
  const rules = [
    { label: 'Founder-Signal', weight: 5, terms: ['founder', 'gründer', 'co-founder', 'ceo', 'cto', 'geschäftsführer', 'startup'] },
    { label: 'Pre-Seed/Seed/Funding', weight: 5, terms: ['pre-seed', 'pre seed', 'seed', 'funding', 'fundraising', 'investor', 'vc', 'angel', 'pitch'] },
    { label: 'Tech/B2B/SaaS', weight: 4, terms: ['tech', 'saas', 'software', 'plattform', 'platform', 'ai', 'ki', 'b2b', 'deep tech', 'app'] },
    { label: 'Kommunikationsproblem', weight: 3, terms: ['positionierung', 'website', 'pitch deck', 'story', 'kommunikation', 'trust', 'vertrauen', 'klarheit'] },
    { label: 'DACH-Relevanz', weight: 2, terms: ['deutschland', 'germany', 'dach', 'berlin', 'münchen', 'hamburg', 'frankfurt', 'köln', 'stuttgart'] },
    { label: 'Aufbau/Fehler/Wendepunkt', weight: 2, terms: ['aufbau', 'fehler', 'scheitern', 'neustart', 'lesson learned', 'gelernt', 'bootstrapped'] },
  ];

  let score = 0;
  const reasons = [];
  const matchedTerms = [];

  for (const rule of rules) {
    const matches = rule.terms.filter((term) => containsTerm(normalized, term));
    if (matches.length > 0) {
      score += rule.weight * Math.min(matches.length, 3);
      reasons.push(rule.label);
      matchedTerms.push(...matches);
    }
  }

  return { score, reasons: [...new Set(reasons)], matchedTerms: [...new Set(matchedTerms)] };
}

function splitPosts(rawPosts) {
  if (!rawPosts || typeof rawPosts !== 'string') return [];
  const chunks = rawPosts
    .split(/\n{2,}|(?=\b(?:Post|Beitrag)\b)/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 80);

  if (chunks.length === 0 && rawPosts.trim().length > 80) return [rawPosts.trim()];
  return chunks.slice(0, 8);
}

function isLinkedInUiLine(line) {
  return (
    /^(Alle Aktivitäten|Beiträge|Kommentare|Videos|Bilder|Mehr|Reaktionen)$/i.test(line) ||
    /^\d+\s+„Beiträge“-Beiträge wurden geladen$/i.test(line) ||
    /^Nummer des Feedbeitrags\s+\d+$/i.test(line) ||
    /^(Gefällt mir|Kommentieren|Reposten|Senden)$/i.test(line) ||
    /^(Übersetzung anzeigen|mehr anzeigen|… mehr)$/i.test(line) ||
    /^\d+\s+Kommentare?$/i.test(line) ||
    /^\d+\s+Reposts?$/i.test(line)
  );
}

function isLikelyPostHeaderLine(line, name) {
  const normalizedLine = normalizeText(line);
  const normalizedName = normalizeText(name);
  return (
    (normalizedName && normalizedLine === normalizedName) ||
    /\b(Premium|Verifiziert|Follower:innen|Follower:in|Kontaktinfo|Nachricht|Vernetzen|Folgen)\b/i.test(line) ||
    /^\d+\s*(Sekunde|Sekunden|Minute|Minuten|Stunde|Stunden|Tag|Tage|Woche|Wochen|Monat|Monate|Jahr|Jahre)\(n\)?\s*•?$/i.test(line) ||
    /(^|\s)•\s*[123]\.?\+/.test(line) ||
    /\b(Founder|CEO|CTO|Geschäftsführer|Gründer)\b.*(@|\|)/i.test(line)
  );
}

function cleanPostText(rawText, name = '') {
  const lines = String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/Alle Aktivitäten\s+Beiträge\s+Kommentare\s+Videos\s+Bilder\s+Mehr/gi, '\n')
    .replace(/Alle Aktivitäten\s+Beiträge\s+Kommentare\s+Reaktionen/gi, '\n')
    .replace(/Alle Aktivitäten\s+Beiträge\s+Bilder\s+Reaktionen/gi, '\n')
    .replace(/\d+\s+„Beiträge“-Beiträge wurden geladen/gi, '\n')
    .replace(/Nummer des Feedbeitrags\s+\d+/gi, '\n')
    .replace(/(Gefällt mir|Kommentieren|Reposten|Senden)(?=\s|$)/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isLinkedInUiLine(line));

  let startIndex = 0;
  const linkedinDateIndex = lines
    .slice(0, 8)
    .findIndex((line) => /^\d+\s*(Sekunde|Sekunden|Minute|Minuten|Stunde|Stunden|Tag|Tage|Woche|Wochen|Monat|Monate|Jahr|Jahre)\(n\)?\s*•?$/i.test(line));
  if (linkedinDateIndex >= 0) {
    startIndex = linkedinDateIndex + 1;
  }

  while (startIndex < lines.length && startIndex < 8 && isLikelyPostHeaderLine(lines[startIndex], name)) {
    startIndex += 1;
  }

  const cleanedLines = lines.slice(startIndex);
  const cleaned = (cleanedLines.length > 0 ? cleanedLines : lines).join('\n');

  return cleaned
    .replace(/\s*Übersetzung anzeigen\s*/gi, ' ')
    .replace(/\s*… mehr\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingLinkedInHeader(text, name = '') {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';

  const head = compact.slice(0, 420);
  const normalizedHead = normalizeText(head);
  const normalizedName = normalizeText(name);
  const hasHeader = (
    (normalizedName && normalizedHead.includes(normalizedName)) ||
    /hat dies repostet|Premium|Verifiziert|Follower:innen|Kontaktinfo/i.test(head) ||
    /(^|\s)•\s*[123]\.?\+/.test(head) ||
    /\b(Founder|CEO|CTO|Geschäftsführer|Gründer)\b.*(@|\|)/i.test(head)
  );

  if (!hasHeader) return compact;

  const bodyCues = [
    ' Bei ',
    ' Wir ',
    ' Ich ',
    ' Du ',
    ' Der ',
    ' Die ',
    ' Das ',
    ' Wenn ',
    ' Warum ',
    ' Heute ',
    ' Unser ',
    ' Unsere ',
    ' Meine ',
    ' Mein ',
    ' Dein ',
    ' Eine ',
    ' Ein ',
    ' Hashtag #',
    ' 🚀',
  ];

  const cueIndex = bodyCues
    .map((cue) => compact.indexOf(cue, 140))
    .filter((index) => index >= 0 && index <= 700)
    .sort((a, b) => a - b)[0];

  if (Number.isInteger(cueIndex)) return compact.slice(cueIndex).trim();
  if (compact.length > 420) return compact.slice(420).trim();
  return compact;
}

function parseRecentFeedPosts(rawPosts, maxPosts, name = '', options = {}) {
  const source = Array.isArray(rawPosts) ? rawPosts.join('\n\n') : String(rawPosts || '');
  if (!source.trim()) return [];

  if (options.singlePost) {
    const text = stripLeadingLinkedInHeader(cleanPostText(source, name), name);
    return text.length >= 80
      ? [{ feedIndex: 1, rawText: source.trim(), text }]
      : [];
  }

  const posts = [];
  const markerRegex = /Nummer des Feedbeitrags\s+(\d+)([\s\S]*?)(?=Nummer des Feedbeitrags\s+\d+|$)/gi;
  let match;
  while ((match = markerRegex.exec(source))) {
    const feedIndex = Number(match[1]);
    const rawText = match[0].trim();
    const text = stripLeadingLinkedInHeader(cleanPostText(match[2], name), name);
    if (text.length >= 80) {
      posts.push({ feedIndex, rawText, text });
    }
  }

  if (posts.length > 0) return posts.slice(0, maxPosts);

  return splitPosts(source)
    .slice(0, maxPosts)
    .map((text, index) => ({
      feedIndex: index + 1,
      rawText: text,
      text: stripLeadingLinkedInHeader(cleanPostText(text, name), name),
    }))
    .filter((post) => post.text.length >= 80);
}

function scoreRecentPostRelevance(postText) {
  const textWithoutHashtags = stripHashtags(postText);
  const hashtagText = extractHashtagText(postText);
  const directMatches = matchStandaloneTerms(textWithoutHashtags, POST_DIRECT_RELEVANCE_TERMS);
  const strategyMatches = matchTerms(textWithoutHashtags, POST_STRATEGY_RELEVANCE_TERMS);
  const startupMatches = matchTerms(textWithoutHashtags, POST_STARTUP_CONTEXT_TERMS);
  const founderStoryMatches = matchTerms(textWithoutHashtags, POST_FOUNDER_STORY_TERMS);
  const ecosystemOnlyMatches = matchTerms(textWithoutHashtags, POST_ECOSYSTEM_ONLY_TERMS);
  const hashtagOnlyMatches = matchStandaloneTerms(hashtagText, POST_DIRECT_RELEVANCE_TERMS);
  const personalOnlyMatches = matchTerms(textWithoutHashtags, PERSONAL_ONLY_TERMS);
  const businessSpecificFounderStoryMatches = founderStoryMatches.filter((term) => (
    BUSINESS_SPECIFIC_FOUNDER_STORY_TERMS.has(normalizeText(term))
  ));
  const genericFounderStoryMatches = founderStoryMatches.filter((term) => (
    !BUSINESS_SPECIFIC_FOUNDER_STORY_TERMS.has(normalizeText(term))
  ));
  const hasOnlyGenericInvestorSignal = directMatches.length > 0
    && directMatches.every((term) => GENERIC_INVESTOR_TERMS.has(normalizeText(term)));
  const hasStrongDirectSignal = directMatches.length > 0 && !hasOnlyGenericInvestorSignal;
  const hasGenericInvestorWithFounderContext = hasOnlyGenericInvestorSignal
    && (startupMatches.length > 0 || founderStoryMatches.length > 0)
    && ecosystemOnlyMatches.length === 0;
  const hasFounderStorySignal = businessSpecificFounderStoryMatches.length > 0
    || (genericFounderStoryMatches.length > 0 && (startupMatches.length > 0 || strategyMatches.length > 0 || directMatches.length > 0));
  const hasStrategyStartupSignal = strategyMatches.length > 0 && startupMatches.length > 0;
  const hasOnlyHashtagBusinessSignals = directMatches.length === 0
    && strategyMatches.length === 0
    && startupMatches.length === 0
    && founderStoryMatches.length === 0
    && hashtagOnlyMatches.length > 0;
  const isPersonalOnlyPost = personalOnlyMatches.length > 0
    && directMatches.length === 0
    && strategyMatches.length === 0
    && businessSpecificFounderStoryMatches.length === 0;
  const relevant = !hasOnlyHashtagBusinessSignals
    && !isPersonalOnlyPost
    && (hasStrongDirectSignal || hasGenericInvestorWithFounderContext || hasFounderStorySignal || hasStrategyStartupSignal);

  if (!relevant) {
    return {
      relevant: false,
      score: 0,
      reasons: [],
      matchedTerms: [],
      directMatchedTerms: [],
      contextMatchedTerms: [],
      founderStoryMatchedTerms: [],
      hashtagOnlyMatchedTerms: [...new Set(hashtagOnlyMatches)],
    };
  }

  const reasons = [];
  if (directMatches.length > 0) reasons.push('Aktueller Post: Pre-Seed/Investor/Pitch-Bezug');
  if (founderStoryMatches.length > 0) reasons.push('Aktueller Post: Founder-Story/Erfahrung');
  if (strategyMatches.length > 0) reasons.push('Aktueller Post: Positionierung/Kommunikation');
  if (startupMatches.length > 0) reasons.push('Aktueller Post: Startup-/Tech-Kontext');

  return {
    relevant: true,
    score: directMatches.length * 8 + founderStoryMatches.length * 6 + strategyMatches.length * 5 + startupMatches.length * 2,
    reasons,
    matchedTerms: [...new Set([...directMatches, ...founderStoryMatches, ...strategyMatches, ...startupMatches])],
    directMatchedTerms: [...new Set(directMatches)],
    contextMatchedTerms: [...new Set([...strategyMatches, ...startupMatches])],
    founderStoryMatchedTerms: [...new Set(founderStoryMatches)],
    hashtagOnlyMatchedTerms: [...new Set(hashtagOnlyMatches)],
  };
}

function profileName(profile) {
  const main = profile.profile?.sections?.main_profile || '';
  return main.split('\n').map((line) => line.trim()).find(Boolean) || profile.username;
}

function buildOpportunities(profiles, config) {
  const opportunities = [];
  const excludedProfiles = [];
  const seenProfiles = new Set();
  let duplicateProfileCount = 0;
  let evaluatedOpportunityCount = 0;

  for (const profile of profiles) {
    const name = profileName(profile);
    const key = canonicalProfileKey({ username: profile.username, url: profile.url, name });
    if (seenProfiles.has(key)) {
      duplicateProfileCount += 1;
      continue;
    }
    seenProfiles.add(key);

    const classification = classifyProfile(profile, config);
    if (!classification.target) {
      excludedProfiles.push({
        name,
        url: profile.url,
        category: classification.category,
        reason: classification.reason,
      });
      continue;
    }

    const profileText = profileCoreSections(profile);
    const profileScore = profile.source === 'manual_post'
      ? { score: 0, reasons: [], matchedTerms: [] }
      : scoreText(profileText);
    const recentPosts = parseRecentFeedPosts(
      profile.profile?.sections?.posts || '',
      config.maxRecentPosts,
      name,
      { singlePost: profile.source === 'manual_post' }
    );

    if (recentPosts.length === 0) {
      excludedProfiles.push({
        name,
        url: profile.url,
        category: 'no_recent_posts',
        reason: 'Keine auswertbaren aktuellen Beiträge gefunden',
      });
      continue;
    }

    let relevantPostCount = 0;
    for (const post of recentPosts) {
      if (profile.source === 'manual_post') {
        relevantPostCount += 1;
        evaluatedOpportunityCount += 1;
        opportunities.push({
          username: profile.username,
          name,
          url: profile.url,
          source: profile.source,
          category: classification.category,
          classificationReason: 'Vom Nutzer ausgewählter Beitrag; keine Code-Relevanzfilter',
          postIndex: post.feedIndex,
          postText: post.text,
          rawPostText: post.rawText,
          postRelevance: {
            relevant: true,
            score: 1,
            reasons: ['Nutzer hat den Beitrag ausgewählt'],
            matchedTerms: [],
            directMatchedTerms: [],
            contextMatchedTerms: [],
            founderStoryMatchedTerms: [],
            hashtagOnlyMatchedTerms: [],
          },
          score: 1,
          reasons: ['Nutzer hat den Beitrag ausgewählt'],
          matchedTerms: [],
          voiceAgent: true,
        });
        continue;
      }

      const postScore = scoreRecentPostRelevance(post.text);
      evaluatedOpportunityCount += 1;
      if (!postScore.relevant) continue;

      relevantPostCount += 1;
      opportunities.push({
        username: profile.username,
        name,
        url: profile.url,
        source: profile.source,
        category: classification.category,
        classificationReason: classification.reason,
        postIndex: post.feedIndex,
        postText: post.text,
        rawPostText: post.rawText,
        postRelevance: postScore,
        score: profileScore.score + postScore.score,
        reasons: [...new Set([...profileScore.reasons, ...postScore.reasons])],
        matchedTerms: [...new Set([...profileScore.matchedTerms, ...postScore.matchedTerms])],
      });
    }

    if (relevantPostCount === 0) {
      excludedProfiles.push({
        name,
        url: profile.url,
        category: 'irrelevant_recent_posts',
        reason: `Letzte ${recentPosts.length} Beiträge ohne Pre-Seed-/Investor-/Pitch-Bezug`,
      });
    }
  }

  const sortedOpportunities = opportunities.sort((a, b) => b.score - a.score);
  const uniqueOpportunities = [];
  const seenOpportunityProfiles = new Set();

  for (const opportunity of sortedOpportunities) {
    const key = canonicalProfileKey(opportunity);
    if (seenOpportunityProfiles.has(key)) continue;
    seenOpportunityProfiles.add(key);
    uniqueOpportunities.push(opportunity);
  }

  return {
    opportunities: uniqueOpportunities,
    excludedProfiles,
    duplicateProfileCount,
    evaluatedOpportunityCount,
  };
}

function inferTopic(opportunity) {
  const postRelevance = opportunity.postRelevance || {};
  const directTerms = (postRelevance.directMatchedTerms || []).join(' ');
  const founderStoryTerms = (postRelevance.founderStoryMatchedTerms || []).join(' ');
  const terms = [
    ...(postRelevance.directMatchedTerms || []),
    ...(postRelevance.founderStoryMatchedTerms || []),
    ...(postRelevance.contextMatchedTerms || []),
  ].join(' ');

  if (/worst advice|mistake|fehler|rückschlag|ruckschlag|scheitern|gescheitert|vanity metrics|growth|sustainability|solve problems|customers|bank account/.test(founderStoryTerms)
    && !/funding|fundraising|pre-seed|pre seed|seed/.test(directTerms)) {
    return 'Founder-Realität';
  }
  if (/funding|fundraising|investor|vc|angel|pitch|pre-seed|pre seed|seed/.test(terms)) return 'Investor-Sprache';
  if (/fehler|rückschlag|ruckschlag|scheitern|gescheitert|cashflow|runway|lesson learned|gelernt|wendepunkt/.test(terms)) return 'Founder-Realität';
  if (/aufbau|bauen|building in public|build in public|launch|erste kunden|erster kunde|traction|pivot/.test(terms)) return 'frühen Aufbau';
  if (/positionierung|website|story|kommunikation|klarheit|trust|vertrauen/.test(terms)) return 'Positionierung';
  return 'Aufbau und Klarheit';
}

function commentVariantsForTopic(topic) {
  if (topic === 'Investor-Sprache') {
    return [
      'Das ist ein wichtiger Punkt bei Investorengesprächen: Oft hängt es nicht daran, ob das Produkt gut ist, sondern ob Markt, Timing und Risiko schnell verständlich werden. Welche Stelle im Pitch hat bei euch am meisten Klarheit gebracht?',
      'Bei Funding-Gesprächen wird Klarheit schnell zum Hebel. Nicht mehr Buzzwords, sondern eine sauberere Verbindung aus Problem, Markt und Momentum. Was war für euch der größte Aha-Moment im Gespräch mit Investoren?',
      'Das trifft genau die Übersetzungsarbeit im frühen Fundraising: technische Substanz so erklären, dass ein Investor Risiko, Timing und Potenzial greifen kann. Welche Frage kam in euren Gesprächen immer wieder zurück?',
    ];
  }

  if (topic === 'Founder-Realität') {
    return [
      'Genau solche Aufbau-Momente sind oft wertvoller als die glatten Erfolgsgeschichten. Weil sie zeigen, wo aus Theorie echte Entscheidungen werden. Was war für dich der Punkt, an dem du gemerkt hast: Das muss ich jetzt anders lösen?',
      'Das ist ein ehrlicher Punkt, den viele erst rückblickend aussprechen. Im Aufbau sieht man oft erst am Rückschlag, welche Annahme wirklich getragen hat. Was würdest du heute früher prüfen?',
      'Daran merkt man, wie wenig linear Aufbau wirklich ist. Von außen sieht man meist nur Ergebnis, aber die eigentliche Arbeit steckt in diesen Korrekturen. Was war deine wichtigste Konsequenz daraus?',
    ];
  }

  if (topic === 'frühen Aufbau') {
    return [
      'Das trifft einen wichtigen Punkt im frühen Aufbau: Nicht mehr Aktivität macht ein System besser, sondern klarere Entscheidungen. Gerade am Anfang ist das schwer, weil alles gleichzeitig wichtig wirkt. Was hat dir geholfen, Priorität reinzubringen?',
      'Bei deinem Punkt zum Aufbau bleibt für mich hängen, wie viel Klarheit erst durch Umsetzung entsteht. Man kann viel planen, aber die harten Signale kommen meistens erst im Kontakt mit Markt und Nutzern. Was war bei euch so ein Signal?',
      'Das ist genau die Art von Aufbau-Erfahrung, die man selten sauber in Frameworks bekommt. Am Ende entscheidet oft nicht die Idee allein, sondern wie schnell man falsche Annahmen erkennt. Welche Annahme hat sich bei euch am stärksten verändert?',
    ];
  }

  if (topic === 'Positionierung') {
    return [
      'Dein Punkt zu Klarheit ist stark. Gerade bei technischen Themen ist das oft die eigentliche Übersetzungsarbeit: nicht mehr erklären, sondern verständlich machen, warum es jetzt relevant ist. Was hat bei dir den größten Unterschied gemacht?',
      'Bei Positionierung unterschätzen viele, wie stark sie Vertrauen vor dem ersten Gespräch prägt. Nicht als schöne Verpackung, sondern als Orientierung: Wofür steht das wirklich, und warum sollte ich zuhören? Genau da wird es spannend.',
      'Das trifft einen Punkt, den ich im Aufbau oft sehe: Klarheit entsteht nicht durch mehr Worte, sondern durch bessere Auswahl. Was lässt man weg, damit das Wesentliche endlich sichtbar wird?',
    ];
  }

  return [
    'Dein Gedanke rund um Aufbau und Klarheit trifft einen Punkt, der oft unterschätzt wird: Zwischen Idee, Markt und Vertrauen liegt Übersetzungsarbeit. Genau dort entscheidet sich, ob andere wirklich andocken können.',
    'Bei deinem Post bleibt für mich hängen, wie stark gute Entscheidungen von Klarheit abhängen. Nicht als Theorie, sondern ganz praktisch: Was ist wirklich wichtig, was ist nur laut? Das ist im Aufbau oft der Unterschied.',
    'Das ist ein relevanter Punkt. Gerade im frühen Aufbau reicht Tempo allein selten aus, wenn die Richtung noch unscharf ist. Was hat bei dir geholfen, daraus eine klarere Entscheidung zu machen?',
  ];
}

function compactSnippet(text, maxLength = 220) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .replace(/\s+\S*$/, '');
}

function extractOfferOneLiner(strategyText) {
  const match = String(strategyText || '').match(/"Ich übersetze technische Startup-Ideen[^"]+"/i);
  return match ? match[0].replace(/^"|"$/g, '') : 'Ich übersetze technische Startup-Ideen in Investor-Sprache — Website, Pitch, Positionierung — damit der nächste Investor-Call nicht an Kommunikation scheitert.';
}

function buildCommentVoiceGuide(strategyText) {
  return [
    'MUT-i-GEN LinkedIn Voice Guide fuer Kommentare und Verbindungsnachrichten',
    '',
    `Offer-Kern: ${extractOfferOneLiner(strategyText)}`,
    'ICP: Tech-Startup-Gruender in DACH, Pre-Seed bis Seed. Sie haben oft eine starke Idee, aber noch keine klare Sprache, kein digitales Fundament und zu wenig Vertrauen im ersten Investor-/Kundenkontakt.',
    'Kernschmerz: Nicht die Idee scheitert zuerst, sondern die Uebersetzung: Website, Pitch, Positionierung, Story, Vertrauen.',
    '',
    'Stimme: Deutsch, du-Form, ehrlich, direkt, ruhig, Founder-zu-Founder. Kein Marketing-Sound. Kein generisches Lob. Keine Emoji. Keine Links.',
    'Kommentar-Ziel: am konkreten Post andocken, einen Gedanken schaerfen, eine Spannung sichtbar machen oder eine echte Folgefrage stellen.',
    'Kommentar-Regeln: ein Absatz, 180 bis 420 Zeichen, maximal ein Fragezeichen. Kein Pitch, kein Angebot, kein Hinweis auf mutigen.de.',
    'Erlaubte Moves: spezifischen Punkt spiegeln, Kontrast herausarbeiten, blinden Fleck benennen, ruhige Folgefrage stellen.',
    'Nicht behaupten: dass Levan diese Situation selbst erlebt hat, mit solchen Kunden arbeitet oder das staendig sieht. Keine erfundenen Ich-/Wir-Geschichten.',
    '',
    'Verbindungsnachricht: nur wenn natuerlich. Konkreten Post referenzieren, kurz sagen warum der Punkt haengen bleibt, Einladung zum Vernetzen. Kein Angebot, kein Service-Pitch.',
  ].join('\n');
}

function buildDmVoiceGuide(strategyText) {
  return [
    'MUT-i-GEN LinkedIn Voice Guide fuer DMs',
    '',
    `Offer-Kern: ${extractOfferOneLiner(strategyText)}`,
    'ICP: Tech-Startup-Gruender in DACH, Pre-Seed bis Seed. Fokus: Investor-Sprache, Website, Pitch, Positionierung, digitales Fundament, Vertrauen.',
    'Stimme: Deutsch, du-Form, ehrlich, direkt, ruhig, Founder-zu-Founder. Kein Marketing-Sound. Keine Emoji. Keine Links.',
    '',
    'DM-Prinzip: warmes Signal ernst nehmen, konkret auf den Punkt reagieren, eine echte Rueckfrage stellen.',
    'Verbindungsanfrage nach echter Interaktion: kurze Einladung zum Vernetzen. Konkreten Bezug nennen. Kein Pitch.',
    'DM an warmen Lead nach Signal oder Antwort: bedanken, konkreten Punkt spiegeln, fragen wo die Person gerade damit steht. Kein Pitch, solange kein echtes Interesse oder Bedarf signalisiert wurde.',
    'Nicht behaupten: dass Levan dieselbe Situation gerade hat, mit solchen Kunden arbeitet oder eine Beziehung besteht, die nicht genannt wurde.',
    'Maximal 500 Zeichen. Ein kurzer Absatz. Hoechstens eine konkrete Rueckfrage am Ende.',
  ].join('\n');
}

function snippetAroundTerms(text, terms, maxLength = 220) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';

  const normalized = normalizeText(compact);
  const matchedIndex = terms
    .map((term) => normalizeText(term))
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (!Number.isInteger(matchedIndex) || matchedIndex <= maxLength / 2) return compactSnippet(compact, maxLength);

  const start = Math.max(0, matchedIndex - Math.floor(maxLength / 2));
  const snippet = compact.slice(start, start + maxLength).trim();
  return `${start > 0 ? '...' : ''}${snippet}`.replace(/\s+\S*$/, '');
}

function opportunityKey(value) {
  return [value.profileUrl || value.url || value.profile || value.name || '', value.postIndex || ''].join('#');
}

function sanitizeDraftText(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/Wenn es die zweite ist, jagst du deinen eigenen Schwanz\./gi, 'Wenn es die zweite ist, drehst du dich im Kreis.')
    .replace(/jagst du deinen eigenen Schwanz/gi, 'drehst du dich im Kreis')
    .replace(/den eigenen Schwanz jagen/gi, 'sich im Kreis drehen')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonFromModelText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Leere Modellantwort');

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Modellantwort enthaelt kein JSON: ${trimmed.slice(0, 200)}`);
    return JSON.parse(match[0]);
  }
}

function looksLikeMetaModerationText(text) {
  return /(dein kommentar|dein entwurf|der post dreht sich|das passt thematisch nicht|schreib einen kommentar|rewrite:|thematischer mismatch|pitch-coaching|kommentar spricht)/i.test(String(text || ''));
}

function looksLikeInventedFirstPersonText(text) {
  return /\b(als ich|bei mir|bei uns|wir haben|ich habe|ich machte|ich sehe das staendig|ich sehe das ständig|ich arbeite mit|mein(?:e[nsrm]?|em)?\s+(bankkonto|pitch|zahlen|team|startup|produkt)|unsere seed|unser pitch)\b/i.test(String(text || ''));
}

function commentVariantsForOpportunity(opportunity, topic) {
  const founderStoryTerms = (opportunity.postRelevance?.founderStoryMatchedTerms || []).join(' ');
  if (topic === 'Founder-Realität' && /worst advice|growth|sustainability|vanity metrics|solve problems|customers|bank account/.test(founderStoryTerms)) {
    return [
      'Das ist ein harter, aber wichtiger Punkt: Wachstum sieht im Pitch Deck schnell gut aus, aber ohne echten Kundennutzen bleibt es nur eine Zahl. Bank Account statt Vanity Metrics ist wahrscheinlich eine der ehrlichsten Prüfungen im Aufbau.',
      'Der Unterschied zwischen Wachstum und Substanz wird im Aufbau oft zu spät sichtbar. Große Zahlen beeindrucken kurz, aber echte Probleme lösen bleibt das, was trägt. Genau diese Lernkurve ist wertvoll.',
      'Starker Founder-Learning. Wachstum ohne Nachhaltigkeit kann wie Fortschritt aussehen, bis man merkt, dass Kundenwert und Cash-Realität nicht mitziehen. Genau da trennt sich Signal von Theater.',
    ];
  }

  return commentVariantsForTopic(topic);
}

function fallbackVoiceAgentComment(postText) {
  const snippet = compactSnippet(postText, 180);
  return `Für mich steckt hier ein wichtiger Punkt drin: ${snippet}. Genau solche Stellen zeigen oft, wo aus einer Idee echte Klarheit werden muss.`;
}

function fallbackVoiceAgentConnection(postText) {
  return 'Ich habe deinen Post gelesen. Der Punkt hat bei mir hängen geblieben, weil er sehr ehrlich auf Aufbau und Klarheit schaut. Lass uns gern verbinden.';
}

function makeCommentDraft(opportunity, index) {
  if (opportunity.voiceAgent) {
    return {
      opportunityKey: opportunityKey(opportunity),
      voiceAgent: true,
      topic: 'Claude LinkedIn Voice Agent',
      profile: opportunity.name,
      profileUrl: opportunity.url,
      postIndex: opportunity.postIndex,
      score: opportunity.score,
      why: 'Nutzer hat den Beitrag ausgewählt; Claude formuliert nach MUT-i-GEN Strategie und Levans LinkedIn-Stimme.',
      postSnippet: compactSnippet(opportunity.postText, 320),
      postMatchedTerms: [],
      postFounderStoryTerms: [],
      postContextTerms: [],
      text: fallbackVoiceAgentComment(opportunity.postText),
      connectionText: fallbackVoiceAgentConnection(opportunity.postText),
    };
  }

  const topic = inferTopic(opportunity);
  const directTerms = opportunity.postRelevance?.directMatchedTerms || opportunity.postRelevance?.matchedTerms || [];
  const founderStoryTerms = opportunity.postRelevance?.founderStoryMatchedTerms || [];
  const anchorTerms = directTerms.length > 0 ? directTerms : founderStoryTerms;
  const postSnippet = snippetAroundTerms(opportunity.postText, anchorTerms, 220);
  const variants = commentVariantsForOpportunity(opportunity, topic);

  return {
    opportunityKey: opportunityKey(opportunity),
    topic,
    profile: opportunity.name,
    profileUrl: opportunity.url,
    postIndex: opportunity.postIndex,
    score: opportunity.score,
    why: opportunity.reasons.join(', ') || 'Strategie-Fit noch manuell prüfen',
    postSnippet,
    postMatchedTerms: directTerms,
    postFounderStoryTerms: founderStoryTerms,
    postContextTerms: opportunity.postRelevance?.contextMatchedTerms || [],
    text: variants[index % variants.length],
  };
}

async function callAnthropicCommentAgent({ draft, opportunity, config, strategyText }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.commentModelTimeoutMs);
  const system = [
    'Du bist der spezialisierte LinkedIn-Kommentar-Agent fuer Levan Lomidze / MUT-i-GEN.',
    'Levan entscheidet die Relevanz selbst, indem er einen Beitrag in das Tool einfuegt. Deine Aufgabe ist nicht, den Beitrag auszusortieren, sondern Levans bestmoegliche Antwort zu formulieren.',
    'Nutze den konkreten Beitrag als Quelle. Erfinde keine eigenen Erfahrungen, keine Zahlen, keine Ich-/Wir-Story und keine Fakten ueber Levan.',
    'Behaupte nicht, dass Levan etwas staendig sieht, mit bestimmten Kunden arbeitet oder genau diese Situation selbst erlebt hat. Keine Saetze wie "Ich sehe das staendig", "Ich arbeite mit", "bei uns", "wir haben".',
    'Auch im reason-Feld keine Behauptungen ueber Levans Erfahrung, Kundenarbeit oder Biografie. Begruende nur mit Post-Inhalt, Strategie und Tonalitaet.',
    'Schreibe auf Deutsch, du-Form, ruhig, ehrlich, direkt, Founder-zu-Founder.',
    'Ton: kein generisches Lob, kein Sales-Pitch, keine Emoji, keine Links, kein Calendly, kein Hashtag-Spam.',
    'Der Kommentar soll wie ein echter Levan-Kommentar klingen: konkret am Post, mit einem klaren Gedanken, nicht wie Marketing-Copy.',
    'Wenn der Post Englisch ist, antworte trotzdem auf Deutsch, aber greife die echten Begriffe und Spannung des Posts sauber auf.',
    'Laenge Kommentar: 180 bis 420 Zeichen. Ein Absatz. Optional eine echte Rueckfrage, aber nur wenn sie natuerlich wirkt. Maximal ein Fragezeichen.',
    'Erzeuge auch eine optionale Verbindungsnachricht. Nur wenn sie natuerlich ist. Maximal 300 Zeichen, ruhig, nicht pushy, kein Pitch, kein Service-Angebot.',
    'Die Verbindungsnachricht darf nicht behaupten "ich arbeite mit...". Besser: "Ich beschaeftige mich viel mit..." oder direkt beim Post bleiben.',
    'Wenn eine Verbindungsnachricht unpassend waere, gib connectionText als leeren String zurueck.',
    'Antworte ausschliesslich als JSON: {"topic":"...","comment":"...","connectionText":"...","reason":"..."}',
  ].join('\n');

  const userPayload = {
    postText: compactSnippet(opportunity.postText, 5000),
    rawPostText: compactSnippet(opportunity.rawPostText, 5000),
    existingFallbackComment: draft.text,
    existingFallbackConnection: draft.connectionText || '',
    mutigenVoiceGuide: buildCommentVoiceGuide(strategyText),
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropicCommentModel,
        max_tokens: config.commentModelMaxTokens,
        temperature: 0.35,
        system,
        messages: [
          {
            role: 'user',
            content: `Formuliere Kommentar und optionale Verbindungsnachricht fuer diesen LinkedIn-Beitrag.\n\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Anthropic API ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const data = JSON.parse(responseText);
    const modelText = (data.content || [])
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n');
    const parsed = parseJsonFromModelText(modelText);
    const text = sanitizeDraftText(parsed.comment || parsed.text || draft.text);
    const connectionText = sanitizeDraftText(parsed.connectionText || '');
    const reason = sanitizeDraftText(parsed.reason || 'Claude LinkedIn Voice Agent');
    const topic = sanitizeDraftText(parsed.topic || 'Claude LinkedIn Voice Agent');

    if (!text || looksLikeMetaModerationText(text)) {
      return { decision: 'rewrite', text: draft.text, connectionText: draft.connectionText || '', topic, reason: `Claude lieferte keinen postbaren Kommentar; Fallback verwendet. ${reason}` };
    }

    if (looksLikeInventedFirstPersonText(text)) {
      return { decision: 'rewrite', text: draft.text, connectionText, topic, reason: `Claude erfand eine Ich-/Wir-Erfahrung; Fallback verwendet. ${reason}` };
    }

    if (connectionText && looksLikeInventedFirstPersonText(connectionText)) {
      return { decision: 'rewrite', text, connectionText: '', topic, reason: `Claude erfand eine Ich-/Wir-Erfahrung in der Verbindungsnachricht; Verbindungsnachricht verworfen. ${reason}` };
    }

    return { decision: 'rewrite', text, connectionText, topic, reason };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropicCommentModerator({ draft, opportunity, config, strategyText }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.commentModelTimeoutMs);
  const system = [
    'Du bist Redaktionspruefer und Kommentar-Coach fuer MUT-i-GEN.',
    'Stimme: Deutsch, du-Form, ehrlich, direkt, Founder-zu-Founder.',
    'Aufgabe: Pruefe den Kommentar-Entwurf gegen den konkreten LinkedIn-Post.',
    'Strategie-relevante Posts sind: Founder erzaehlt echte Erfahrung, Fehler, Rueckschlag, Wendepunkt, Aufbau, Cashflow, Runway, Launch, erste Kunden, Lernen; oder Pre-Seed, Seed, Fundraising, Investoren, Pitch, Investorensprache; oder Positionierung, Klarheit, Story, Website, Vertrauen im Startup-Kontext.',
    'Wenn der Post selbst nicht in diese Strategie passt, lehne ab.',
    'Wenn nur der Entwurf thematisch nicht passt, der Post aber strategie-relevant ist, schreibe ihn als echten Kommentar neu.',
    'Erfinde keine eigenen Erfahrungen, keine Zahlen und keine Ich-/Wir-Story. Schreibe nicht so, als haette Levan die beschriebene Situation selbst erlebt.',
    'Ich-Form ist nur erlaubt fuer neutrale Wahrnehmung wie "Für mich" oder "Ich lese daraus". Keine Formulierungen wie "Als ich", "bei uns", "wir haben", "mein Bankkonto".',
    'Keine derben oder wortwoertlichen Uebersetzungen. "Chase your own tail" auf Deutsch als "sich im Kreis drehen" formulieren.',
    'Wenn der Entwurf generisch klingt, Sales-CTA enthaelt, Links enthaelt, Emoji nutzt oder zu werblich ist, schreibe ihn um oder lehne ihn ab.',
    'Der finale Kommentar darf keine Links, keine Emoji, kein Calendly, keinen Pitch und kein generisches Lob enthalten.',
    'Das Feld text muss bei approve/rewrite ein direkt postbarer LinkedIn-Kommentar sein, kein Review, keine Analyse, keine Anweisung an Levan.',
    'Maximal 420 Zeichen. Ein Absatz. Keine Anfuehrungszeichen um kaputte Snippets.',
    'Antworte ausschliesslich als JSON: {"decision":"approve|rewrite|reject","text":"...","reason":"..."}',
  ].join('\n');
  const userPayload = {
    profile: draft.profile,
    profileUrl: draft.profileUrl,
    feedPost: draft.postIndex,
    inferredTopic: draft.topic,
    qualifyingSignals: draft.postMatchedTerms,
    founderStorySignals: draft.postFounderStoryTerms,
    contextSignals: draft.postContextTerms,
    postSnippet: draft.postSnippet,
    postText: compactSnippet(opportunity.postText, 3000),
    originalDraft: draft.text,
    relevantStrategyExcerpt: compactSnippet(strategyText, 2500),
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropicCommentModel,
        max_tokens: config.commentModelMaxTokens,
        temperature: 0.3,
        system,
        messages: [
          {
            role: 'user',
            content: `Pruefe und moderiere diesen Kommentar.\n\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Anthropic API ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const data = JSON.parse(responseText);
    const modelText = (data.content || [])
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n');
    const parsed = parseJsonFromModelText(modelText);
    const decision = ['approve', 'rewrite', 'reject'].includes(parsed.decision) ? parsed.decision : 'reject';
    let text = sanitizeDraftText(parsed.text || (decision === 'approve' ? draft.text : ''));
    const reason = sanitizeDraftText(parsed.reason || 'Keine Begruendung geliefert');

    if ((decision === 'approve' || decision === 'rewrite') && looksLikeMetaModerationText(text)) {
      return { decision: 'reject', text: '', reason: `Modell lieferte Meta-Review statt postbarem Kommentar: ${reason}` };
    }

    if ((decision === 'approve' || decision === 'rewrite') && looksLikeInventedFirstPersonText(text)) {
      return {
        decision: 'rewrite',
        text: draft.text,
        reason: `Modell erfand eine Ich-/Wir-Erfahrung; sicherer regelbasierter Entwurf verwendet. ${reason}`,
      };
    }

    return { decision, text, reason };
  } finally {
    clearTimeout(timeout);
  }
}

async function moderateCommentDrafts(commentDrafts, opportunities, config, strategyText, notes, errors) {
  const summary = {
    provider: config.commentModelProvider,
    model: config.commentModelProvider === 'anthropic' ? config.anthropicCommentModel : '',
    enabled: false,
    attempted: 0,
    approved: 0,
    rewritten: 0,
    rejected: 0,
    failed: 0,
  };

  if (config.commentModelProvider !== 'anthropic') {
    return { drafts: commentDrafts, rejectedKeys: new Set(), summary };
  }

  if (!config.anthropicApiKey) {
    notes.push('Claude-Kommentar-Moderation ist angefragt, aber ANTHROPIC_API_KEY fehlt. Entwuerfe bleiben regelbasiert.');
    return { drafts: commentDrafts, rejectedKeys: new Set(), summary };
  }

  summary.enabled = true;
  const moderatedDrafts = [];
  const rejectedKeys = new Set();

  for (let index = 0; index < commentDrafts.length; index += 1) {
    const draft = commentDrafts[index];
    const opportunity = opportunities[index];
    summary.attempted += 1;

    try {
      const result = draft.voiceAgent
        ? await callAnthropicCommentAgent({ draft, opportunity, config, strategyText })
        : await callAnthropicCommentModerator({ draft, opportunity, config, strategyText });
      if (result.decision === 'reject' || !result.text) {
        summary.rejected += 1;
        rejectedKeys.add(draft.opportunityKey);
        continue;
      }

      if (result.decision === 'rewrite') summary.rewritten += 1;
      else summary.approved += 1;

      moderatedDrafts.push({
        ...draft,
        topic: result.topic || draft.topic,
        text: result.text,
        connectionText: result.connectionText || draft.connectionText || '',
        modelModeration: {
          provider: 'anthropic',
          model: config.anthropicCommentModel,
          decision: result.decision,
          reason: result.reason,
        },
      });
    } catch (error) {
      summary.failed += 1;
      errors.push(`Claude-Kommentar-Moderation fehlgeschlagen fuer ${draft.profile}: ${error.message}`);
      moderatedDrafts.push({
        ...draft,
        modelModeration: {
          provider: 'anthropic',
          model: config.anthropicCommentModel,
          decision: 'error',
          reason: error.message,
        },
      });
    }
  }

  notes.push(`Claude-Kommentar-Moderation: ${summary.attempted} geprueft, ${summary.rewritten} umgeschrieben, ${summary.approved} freigegeben, ${summary.rejected} verworfen.`);
  return { drafts: moderatedDrafts, rejectedKeys, summary };
}

async function callAnthropicDmModerator({ draft, signal, config, strategyText }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.dmModelTimeoutMs);
  const system = [
    'Du bist DM-Redakteur fuer MUT-i-GEN.',
    'Stimme: Deutsch, du-Form, ehrlich, direkt, Founder-zu-Founder.',
    'Aufgabe: Pruefe oder ueberarbeite den DM-Entwurf auf Basis eines warmen Signals.',
    'Erlaubt sind nur Nachrichten, die ruhig, konkret und nicht pushy sind.',
    'Keine Emoji, keine Links, kein Calendly, kein Sales-Druck, kein generisches Lob.',
    'Die DM muss direkt sendbar sein und wie eine echte 1:1-Nachricht klingen, nicht wie Copywriting-Kommentar.',
    'Wenn das Signal zu duenn oder unklar ist, lehne ab.',
    'Wenn der Entwurf brauchbar ist, approve. Wenn er zu generisch, zu lang oder zu werblich ist, rewrite.',
    'Maximal 500 Zeichen. Ein kurzer Absatz. Hoechstens eine konkrete Rueckfrage am Ende.',
    'Antworte ausschliesslich als JSON: {"decision":"approve|rewrite|reject","text":"...","reason":"..."}',
  ].join('\n');
  const userPayload = {
    stage: draft.stage,
    trigger: draft.trigger,
    profile: draft.profile,
    postTopic: signal.postTopic || '',
    userPoint: signal.userPoint || '',
    signalText: signal.signalText || signal.trigger || signal.reactionType || '',
    originalDraft: draft.text,
    relevantStrategyExcerpt: compactSnippet(strategyText, 1800),
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropicDmModel,
        max_tokens: config.dmModelMaxTokens,
        temperature: 0.25,
        system,
        messages: [
          {
            role: 'user',
            content: `Pruefe und moderiere diese DM.\n\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Anthropic API ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const data = JSON.parse(responseText);
    const modelText = (data.content || [])
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n');
    const parsed = parseJsonFromModelText(modelText);
    const decision = ['approve', 'rewrite', 'reject'].includes(parsed.decision) ? parsed.decision : 'reject';
    const text = sanitizeDraftText(parsed.text || (decision === 'approve' ? draft.text : ''));
    const reason = sanitizeDraftText(parsed.reason || 'Keine Begruendung geliefert');

    if ((decision === 'approve' || decision === 'rewrite') && looksLikeMetaModerationText(text)) {
      return { decision: 'reject', text: '', reason: `Modell lieferte Meta-Review statt sendbarer DM: ${reason}` };
    }

    return { decision, text, reason };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropicDmAgent({ draft, signal, config, strategyText }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.dmModelTimeoutMs);
  const system = [
    'Du bist der spezialisierte LinkedIn-DM-Agent fuer Levan Lomidze / MUT-i-GEN.',
    'Levan entscheidet, dass ein warmes Signal relevant ist. Deine Aufgabe ist, daraus eine ruhige, echte 1:1-Nachricht zu formulieren.',
    'Schreibe Deutsch, du-Form, ehrlich, direkt, Founder-zu-Founder.',
    'Keine Emoji, keine Links, kein Calendly, kein Pitch, kein Sales-Druck, kein generisches Lob.',
    'Die DM soll wie eine echte kurze Nachricht klingen, nicht wie Copywriting.',
    'Nutze Signal, Profil, Thema und Levans Strategie. Erfinde keine Fakten und keine Beziehung, die nicht genannt wurde.',
    'Behaupte nicht "bei uns", "wir haben", "ich arbeite mit" oder dass Levan gerade dasselbe Problem hat, ausser es steht explizit im Signal.',
    'Auch im reason-Feld keine Behauptungen ueber Levans Erfahrung, Kundenarbeit oder Biografie. Begruende nur mit Signal, Strategie und Tonalitaet.',
    'Maximal 500 Zeichen. Ein kurzer Absatz. Hoechstens eine konkrete Rueckfrage am Ende.',
    'Antworte ausschliesslich als JSON: {"text":"...","reason":"..."}',
  ].join('\n');
  const userPayload = {
    stage: draft.stage,
    trigger: draft.trigger,
    profile: draft.profile,
    postTopic: signal.postTopic || draft.postTopic || '',
    userPoint: signal.userPoint || draft.userPoint || '',
    signalText: signal.signalText || draft.signalText || signal.trigger || signal.reactionType || '',
    fallbackDm: draft.text,
    mutigenVoiceGuide: buildDmVoiceGuide(strategyText),
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropicDmModel,
        max_tokens: config.dmModelMaxTokens,
        temperature: 0.3,
        system,
        messages: [
          {
            role: 'user',
            content: `Formuliere eine LinkedIn-DM aus diesem warmen Signal.\n\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Anthropic API ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const data = JSON.parse(responseText);
    const modelText = (data.content || [])
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n');
    const parsed = parseJsonFromModelText(modelText);
    const text = sanitizeDraftText(parsed.text || draft.text);
    const reason = sanitizeDraftText(parsed.reason || 'Claude LinkedIn DM Agent');

    if (!text || looksLikeMetaModerationText(text)) {
      return { decision: 'rewrite', text: draft.text, reason: `Claude lieferte keine sendbare DM; Fallback verwendet. ${reason}` };
    }

    if (looksLikeInventedFirstPersonText(text)) {
      return { decision: 'rewrite', text: draft.text, reason: `Claude erfand eine Ich-/Wir-Erfahrung; Fallback verwendet. ${reason}` };
    }

    return { decision: 'rewrite', text, reason };
  } finally {
    clearTimeout(timeout);
  }
}

async function moderateDmDrafts(dmDrafts, warmSignals, config, strategyText, notes, errors) {
  const summary = {
    provider: config.dmModelProvider,
    model: config.dmModelProvider === 'anthropic' ? config.anthropicDmModel : '',
    enabled: false,
    attempted: 0,
    approved: 0,
    rewritten: 0,
    rejected: 0,
    failed: 0,
  };

  if (config.dmModelProvider !== 'anthropic') {
    return { drafts: dmDrafts, summary };
  }

  if (!config.anthropicApiKey) {
    notes.push('Claude-DM-Moderation ist angefragt, aber ANTHROPIC_API_KEY fehlt. DM-Entwuerfe bleiben regelbasiert.');
    return { drafts: dmDrafts, summary };
  }

  summary.enabled = true;
  const moderatedDrafts = [];

  for (let index = 0; index < dmDrafts.length; index += 1) {
    const draft = dmDrafts[index];
    const signal = warmSignals[index] || {};
    summary.attempted += 1;

    try {
      const result = draft.voiceAgent
        ? await callAnthropicDmAgent({ draft, signal, config, strategyText })
        : await callAnthropicDmModerator({ draft, signal, config, strategyText });
      if (result.decision === 'reject' || !result.text) {
        summary.rejected += 1;
        continue;
      }

      if (result.decision === 'rewrite') summary.rewritten += 1;
      else summary.approved += 1;

      moderatedDrafts.push({
        ...draft,
        text: result.text,
        modelModeration: {
          provider: 'anthropic',
          model: config.anthropicDmModel,
          decision: result.decision,
          reason: result.reason,
        },
      });
    } catch (error) {
      summary.failed += 1;
      errors.push(`Claude-DM-Moderation fehlgeschlagen fuer ${draft.profile || 'unbekannt'}: ${error.message}`);
      moderatedDrafts.push({
        ...draft,
        modelModeration: {
          provider: 'anthropic',
          model: config.anthropicDmModel,
          decision: 'error',
          reason: error.message,
        },
      });
    }
  }

  notes.push(`Claude-DM-Moderation: ${summary.attempted} geprueft, ${summary.rewritten} umgeschrieben, ${summary.approved} freigegeben, ${summary.rejected} verworfen.`);
  return { drafts: moderatedDrafts, summary };
}

function makeConnectionDraft(opportunity) {
  const topic = inferTopic(opportunity);
  const topicLabel = topic === 'Investor-Sprache'
    ? 'Funding, Pitch und Klarheit'
    : topic;
  const reason = topic === 'Investor-Sprache'
    ? 'weil frühe Tech-Ideen genau an dieser Übersetzung zwischen Produkt, Markt und Risiko oft gewinnen oder verlieren'
    : 'weil offene Aufbau-Momente oft mehr zeigen als glatte Erfolgsgeschichten';
  return {
    opportunityKey: opportunityKey(opportunity),
    profile: opportunity.name,
    profileUrl: opportunity.url,
    postIndex: opportunity.postIndex,
    text: `Ich habe deinen aktuellen Post über ${topicLabel} gelesen. Das hat mich angesprochen, ${reason}. Ich baue gerade ein Netzwerk mit Gründern, die offen über Aufbau und Klarheit sprechen. Wenn du magst, lass uns verbinden.`,
  };
}

function makeDmDrafts(warmSignals) {
  if (warmSignals.length === 0) return [];

  return warmSignals.map((signal) => ({
    stage: signal.stage || 'DM an warmen Lead nach Signal oder Antwort',
    trigger: signal.trigger || signal.reactionType || 'Warme Reaktion',
    profile: signal.name || signal.profile || '',
    postTopic: signal.postTopic || '',
    userPoint: signal.userPoint || '',
    signalText: signal.signalText || signal.trigger || signal.reactionType || '',
    voiceAgent: true,
    text: `Danke für deine Reaktion zu ${signal.postTopic || 'dem Thema'}. Was du geschrieben hast, hat bei mir angedockt. Wo stehst du gerade damit konkret?`,
  }));
}

function makeDmTemplates() {
  return [
    {
      stage: 'Verbindungsanfrage nach echter Interaktion',
      trigger: 'echte Interaktion mit fremdem Post',
      text: 'Ich habe deinen Beitrag zu [Post-Thema] gelesen. Der Punkt zu [ihr Punkt] ist hängen geblieben. Lass uns gern verbinden.',
    },
    {
      stage: 'DM an warmen Lead nach Signal oder Antwort',
      trigger: 'warmes Signal oder Antwort',
      text: 'Danke für deine Reaktion auf meinen Post zu [Post-Thema]. Was du geschrieben hast über [ihr Punkt] hat bei mir angedockt. Wo stehst du gerade damit konkret?',
    },
  ];
}

function renderMarkdown(report) {
  const lines = [];
  const recentPostExcludedCount = report.excludedProfiles.filter((profile) => (
    profile.category === 'no_recent_posts' || profile.category === 'irrelevant_recent_posts'
  )).length;

  lines.push(`# MUT-i-GEN LinkedIn Copilot — ${report.runDate}`);
  lines.push('');
  lines.push('## Status');
  lines.push('');
  lines.push(`- LinkedIn-MCP: ${report.mcpEnabled ? 'aktiv' : 'inaktiv'}`);
  lines.push(`- Profile gelesen: ${report.profileCount}`);
  lines.push(`- Zielkunden-Profile nach Filter: ${report.targetProfileCount}`);
  lines.push(`- Aktuelle Beiträge geprüft: ${report.recentPostsChecked}`);
  lines.push(`- Beitragsfenster pro Profil: letzte ${report.maxRecentPosts} Feedbeiträge`);
  if (report.commentModeration) {
    lines.push(`- Kommentar-Modell: ${report.commentModeration.enabled ? `${report.commentModeration.provider} (${report.commentModeration.model})` : 'inaktiv'}`);
  }
  lines.push(`- Ausgefilterte Profile: ${report.excludedProfiles.length}`);
  lines.push('- Aktionen: keine automatischen Kommentare, keine Verbindungsanfragen, keine DMs');
  lines.push('');

  if (report.notes.length > 0) {
    lines.push('## Hinweise');
    lines.push('');
    for (const note of report.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  if (report.errors.length > 0) {
    lines.push('## Fehler / Setup-Lücken');
    lines.push('');
    for (const error of report.errors) lines.push(`- ${error}`);
    lines.push('');
  }

  lines.push('## Tagesmetriken');
  lines.push('');
  lines.push('| Metrik | Ziel | Heute vorbereitet |');
  lines.push('|---|---:|---:|');
  lines.push(`| Kommentare auf fremden Posts | 5 | ${report.commentDrafts.length} |`);
  lines.push(`| Verbindungsanfragen mit Nachricht | 2 | ${report.connectionDrafts.length} |`);
  lines.push(`| DMs an warme Leads | nach Signal | ${report.dmDrafts.length} |`);
  lines.push('');

  if (report.commentModeration) {
    lines.push('## Kommentar-Moderation');
    lines.push('');
    lines.push(`- Provider: ${report.commentModeration.provider}`);
    if (report.commentModeration.model) lines.push(`- Modell: ${report.commentModeration.model}`);
    lines.push(`- Aktiv: ${report.commentModeration.enabled ? 'ja' : 'nein'}`);
    lines.push(`- Geprüft: ${report.commentModeration.attempted}`);
    lines.push(`- Freigegeben: ${report.commentModeration.approved}`);
    lines.push(`- Umgeschrieben: ${report.commentModeration.rewritten}`);
    lines.push(`- Verworfen: ${report.commentModeration.rejected}`);
    lines.push(`- Fehler: ${report.commentModeration.failed}`);
    lines.push('');
  }

  lines.push('## Filter-Ergebnis');
  lines.push('');
  lines.push(`- Doppelte Profile entfernt: ${report.duplicateProfileCount}`);
  lines.push(`- Eigene/Investor-/Low-Fit-/Nicht-Founder-Profile ausgeschlossen: ${report.excludedProfiles.length - recentPostExcludedCount}`);
  lines.push(`- Founder-Profile ohne relevanten aktuellen Beitrag ausgeschlossen: ${recentPostExcludedCount}`);
  lines.push(`- Verwendbare Zielkunden-Profile: ${report.targetProfileCount}`);
  if (report.excludedProfiles.length > 0) {
    lines.push('');
    for (const profile of report.excludedProfiles.slice(0, 10)) {
      lines.push(`- ${profile.name || 'Unbekannt'} — ${profile.category} — ${profile.reason}`);
    }
  }
  lines.push('');

  lines.push('## Top-Profile');
  lines.push('');
  if (report.topProfiles.length === 0) {
    lines.push('Noch keine Profile gefunden. Aktiviere LinkedIn-MCP oder füge manuelle Profile/Post-Texte in der n8n-Konfiguration ein.');
  } else {
    for (const profile of report.topProfiles) {
      lines.push(`- ${profile.name} — Score ${profile.score} — ${profile.url || 'ohne URL'}`);
      if (profile.why) lines.push(`  Grund: ${profile.why}`);
      if (profile.postIndex) lines.push(`  Passender Beitrag: Feedbeitrag ${profile.postIndex}`);
    }
  }
  lines.push('');

  lines.push('## 5 Kommentar-Entwürfe');
  lines.push('');
  if (report.commentDrafts.length === 0) {
    lines.push('Keine Kommentar-Entwürfe erzeugt, weil keine passenden Posts/Profile vorlagen.');
  } else {
    report.commentDrafts.forEach((draft, index) => {
      lines.push(`### Kommentar ${index + 1} — ${draft.profile}`);
      lines.push('');
      lines.push(`Profil: ${draft.profileUrl || 'ohne URL'}`);
      lines.push('');
      if (draft.postIndex) {
        lines.push(`Beitrag: Feedbeitrag ${draft.postIndex}`);
        lines.push('');
      }
      if (draft.topic) {
        lines.push(`Thema: ${draft.topic}`);
        lines.push('');
      }
      lines.push(`Warum: ${draft.why}`);
      lines.push('');
      if (draft.modelModeration) {
        lines.push(`Modellprüfung: ${draft.modelModeration.provider} ${draft.modelModeration.model} — ${draft.modelModeration.decision} — ${draft.modelModeration.reason}`);
        lines.push('');
      }
      if (draft.postMatchedTerms && draft.postMatchedTerms.length > 0) {
        lines.push(`Post-Signale: ${draft.postMatchedTerms.join(', ')}`);
        lines.push('');
      }
      if (draft.postFounderStoryTerms && draft.postFounderStoryTerms.length > 0) {
        lines.push(`Founder-Story-Signale: ${draft.postFounderStoryTerms.join(', ')}`);
        lines.push('');
      }
      if (draft.postContextTerms && draft.postContextTerms.length > 0) {
        lines.push(`Kontext-Signale: ${draft.postContextTerms.join(', ')}`);
        lines.push('');
      }
      lines.push(`Post-Snippet: ${draft.postSnippet || 'kein Snippet'}`);
      lines.push('');
      lines.push('```text');
      lines.push(draft.text);
      lines.push('```');
      lines.push('');
    });
  }

  lines.push('## 2 Verbindungsanfragen');
  lines.push('');
  if (report.connectionDrafts.length === 0) {
    lines.push('Keine Verbindungsanfragen erzeugt, weil keine passenden Profile vorlagen.');
  } else {
    report.connectionDrafts.forEach((draft, index) => {
      lines.push(`### Anfrage ${index + 1} — ${draft.profile}`);
      lines.push('');
      lines.push(`Profil: ${draft.profileUrl || 'ohne URL'}`);
      lines.push('');
      if (draft.postIndex) {
        lines.push(`Auslöser: Feedbeitrag ${draft.postIndex}`);
        lines.push('');
      }
      lines.push('```text');
      lines.push(draft.text);
      lines.push('```');
      lines.push('');
    });
  }

  lines.push('## DM-Entwürfe nach Signal');
  lines.push('');
  if (report.dmDrafts.length === 0) {
    lines.push('Keine warmen Signale übergeben. Deshalb werden keine konkreten DMs vorbereitet.');
    lines.push('');
  } else {
    report.dmDrafts.forEach((draft) => {
      lines.push(`### ${draft.stage}`);
      lines.push('');
      lines.push(`Trigger: ${draft.trigger}`);
      lines.push('');
      if (draft.profile) {
        lines.push(`Profil: ${draft.profile}`);
        lines.push('');
      }
      if (draft.modelModeration) {
        lines.push(`Modellprüfung: ${draft.modelModeration.provider} ${draft.modelModeration.model} — ${draft.modelModeration.decision} — ${draft.modelModeration.reason}`);
        lines.push('');
      }
      lines.push('```text');
      lines.push(draft.text);
      lines.push('```');
      lines.push('');
    });
  }

  lines.push('## Sicherheitsgrenze');
  lines.push('');
  lines.push('- Dieses System recherchiert und formuliert nur Entwürfe.');
  lines.push('- Nicht automatisch senden. Nicht automatisch verbinden. Nicht automatisch kommentieren.');
  lines.push('- Vor dem Posten jeden Text gegen die LinkedIn-Strategie prüfen: echte Erfahrung, kein Sales-CTA, kein Link, kein generischer Lob-Kommentar.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function persistReportArtifacts(report, config, notes, errors) {
  if (config.skipOutputWrite) {
    notes.push('Output-Schreiben ist deaktiviert. Report wird nur im API-Response zurueckgegeben.');
    return { jsonPath: '', markdownPath: '' };
  }

  try {
    fs.mkdirSync(config.outputDir, { recursive: true });
    const baseName = `${config.runDate}-linkedin-copilot`;
    const jsonPath = path.join(config.outputDir, `${baseName}.json`);
    const markdownPath = path.join(config.outputDir, `${baseName}.md`);

    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(markdownPath, renderMarkdown(report));
    return { jsonPath, markdownPath };
  } catch (error) {
    errors.push(`Report-Dateien konnten nicht geschrieben werden: ${error.message}`);
    return { jsonPath: '', markdownPath: '' };
  }
}

async function runCopilot(rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  const notes = [];
  const errors = [];

  const strategyText = fs.existsSync(config.strategyPath)
    ? fs.readFileSync(config.strategyPath, 'utf8')
    : '';

  if (!strategyText) {
    notes.push(`Strategie-Datei nicht gefunden oder leer: ${config.strategyPath}`);
  }

  let profiles = [];
  let rawSearchResults = [];
  let rawSidebarResults = [];

  if (config.useLinkedInMcp) {
    try {
      const mcpResult = await collectWithLinkedInMcp(config, notes);
      profiles = profiles.concat(mcpResult.profiles);
      rawSearchResults = mcpResult.rawSearchResults;
      rawSidebarResults = mcpResult.rawSidebarResults;
    } catch (error) {
      errors.push(`LinkedIn-MCP konnte nicht ausgeführt werden: ${error.message}`);
      errors.push('Prüfe: uv installiert, LinkedIn-Login vorhanden, LINKEDIN_MCP_ENABLED=true nur nach Setup aktivieren.');
    }
  } else {
    notes.push('LinkedIn-MCP ist deaktiviert. Der Lauf nutzt nur manuelle Inputs aus der n8n-Konfiguration.');
  }

  profiles = profiles.concat(config.manualProfiles.map(normalizeManualProfile));
  profiles = profiles.concat(config.manualPosts.map(normalizeManualPost));

  const opportunityResult = buildOpportunities(profiles, config);
  const opportunities = opportunityResult.opportunities;
  const commentCandidateOpportunities = opportunities.slice(0, config.commentCandidateLimit);
  const initialCommentDrafts = commentCandidateOpportunities.map(makeCommentDraft);
  const commentModerationResult = await moderateCommentDrafts(initialCommentDrafts, commentCandidateOpportunities, config, strategyText, notes, errors);
  const commentDrafts = commentModerationResult.drafts.slice(0, 5);
  const finalCommentKeys = new Set(commentDrafts.map((draft) => draft.opportunityKey));
  const connectionDrafts = commentDrafts
    .filter((draft) => draft.connectionText)
    .slice(0, 2)
    .map((draft) => ({
      opportunityKey: draft.opportunityKey,
      profile: draft.profile,
      profileUrl: draft.profileUrl,
      postIndex: draft.postIndex,
      text: draft.connectionText,
      modelModeration: draft.modelModeration || null,
    }));
  if (connectionDrafts.length === 0) {
    connectionDrafts.push(...opportunities
      .filter((opportunity) => finalCommentKeys.has(opportunityKey(opportunity)))
      .slice(0, 2)
      .map(makeConnectionDraft));
  }
  const initialDmDrafts = makeDmDrafts(config.warmSignals);
  const dmModerationResult = await moderateDmDrafts(initialDmDrafts, config.warmSignals, config, strategyText, notes, errors);
  const dmDrafts = dmModerationResult.drafts.slice(0, 5);

  const topProfiles = opportunities.slice(0, 10).map((item) => ({
    name: item.name,
    url: item.url,
    score: item.score,
    why: item.reasons.join(', '),
    postIndex: item.postIndex,
    postSnippet: snippetAroundTerms(
      item.postText,
      (item.postRelevance?.directMatchedTerms || []).length > 0
        ? item.postRelevance.directMatchedTerms
        : item.postRelevance?.founderStoryMatchedTerms || []
    ),
    postMatchedTerms: item.postRelevance?.directMatchedTerms || [],
    postFounderStoryTerms: item.postRelevance?.founderStoryMatchedTerms || [],
    postContextTerms: item.postRelevance?.contextMatchedTerms || [],
  }));

  const report = {
    runDate: config.runDate,
    mcpEnabled: config.useLinkedInMcp,
    profileCount: profiles.length,
    opportunityCount: opportunities.length,
    targetProfileCount: opportunities.length,
    rawOpportunityCount: opportunityResult.evaluatedOpportunityCount,
    recentPostsChecked: opportunityResult.evaluatedOpportunityCount,
    maxRecentPosts: config.maxRecentPosts,
    commentModeration: commentModerationResult.summary,
    dmModeration: dmModerationResult.summary,
    excludedProfiles: opportunityResult.excludedProfiles,
    duplicateProfileCount: opportunityResult.duplicateProfileCount,
    notes,
    errors,
    topProfiles,
    commentDrafts,
    connectionDrafts,
    dmDrafts,
    rawSearchResults,
    rawSidebarResults,
  };

  const { jsonPath, markdownPath } = persistReportArtifacts(report, config, notes, errors);

  return {
    runDate: report.runDate,
    profileCount: report.profileCount,
    opportunityCount: report.opportunityCount,
    targetProfileCount: report.targetProfileCount,
    recentPostsChecked: report.recentPostsChecked,
    excludedProfileCount: report.excludedProfiles.length,
    commentDraftCount: report.commentDrafts.length,
    connectionDraftCount: report.connectionDrafts.length,
    dmDraftCount: report.dmDrafts.length,
    commentModeration: report.commentModeration,
    dmModeration: report.dmModeration,
    jsonPath,
    markdownPath,
    errors,
    notes,
    report,
  };
}

async function main() {
  const result = await runCopilot(parseCliConfig());
  const { report, ...summary } = result;
  process.stdout.write(JSON.stringify(summary));
}

module.exports = {
  runCopilot,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  });
}