import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
async function loadLocalEnvironment() {
  try {
    const contents = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[1].startsWith('#') || process.env[match[1]]) continue;
      const value = match[2].replace(/^(["'])(.*)\1$/, '$2');
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await loadLocalEnvironment();

const DATA_DIR = path.join(ROOT, 'data', 'enquiries');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const MAX_BODY_BYTES = 12_000;
const RATE_LIMIT = new Map();
const WHATSAPP_NUMBER = '919743928204';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function istTimestamp(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} IST`,
  };
}

function csvCell(value) {
  let clean = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').trim();
  if (/^[=+\-@\t\r]/.test(clean)) clean = `'${clean}`;
  return `"${clean.replaceAll('"', '""')}"`;
}

async function saveEnquiry(data) {
  await mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `enquiries-${data.date}.csv`);
  const header = '\uFEFFCreated At (IST),Name,Phone,Address,Service Required,Details\r\n';
  try {
    await writeFile(file, header, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const row = [data.createdAt, data.name, data.phone, data.address, data.request, data.details].map(csvCell).join(',') + '\r\n';
  await appendFile(file, row, 'utf8');
}

async function saveEnquiryToSupabase(data) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw Object.assign(new Error('Supabase is not configured.'), { statusCode: 503 });
  }

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/enquiries`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        created_at_ist: data.createdAt,
        name: data.name,
        phone: data.phone,
        address: data.address,
        service_requested: data.request,
        details: data.details,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    console.error('Supabase enquiry insert request failed:', error.name || 'network error');
    throw Object.assign(new Error('Supabase could not be reached.'), { statusCode: 502 });
  }

  if (!response.ok) {
    console.error('Supabase enquiry insert rejected:', response.status);
    throw Object.assign(new Error('Supabase did not accept the enquiry.'), { statusCode: 502 });
  }
}

async function readRequestBody(request) {
  let body = '';
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error('Request is too large.'), { statusCode: 413 });
    body += chunk.toString('utf8');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error('Please send a valid enquiry.'), { statusCode: 400 });
  }
}

function validateEnquiry(input) {
  const name = String(input.name ?? '').trim().slice(0, 100);
  const phone = String(input.phone ?? '').trim().slice(0, 30);
  const phoneDigits = phone.replace(/\D/g, '');
  const address = String(input.address ?? '').trim().slice(0, 400);
  const request = String(input.request ?? '').trim().slice(0, 100);
  const details = String(input.details ?? '').trim().slice(0, 700);
  if (name.length < 2) throw Object.assign(new Error('Please enter your name.'), { statusCode: 400 });
  if (phoneDigits.length < 8 || phoneDigits.length > 15) throw Object.assign(new Error('Please enter a valid phone number.'), { statusCode: 400 });
  if (address.length < 5) throw Object.assign(new Error('Please enter your address or locality.'), { statusCode: 400 });
  if (request.length < 3) throw Object.assign(new Error('Please choose the service you need.'), { statusCode: 400 });
  return { name, phone, phoneDigits, address, request, details };
}

function allowSubmission(request) {
  const now = Date.now();
  const key = request.socket.remoteAddress || 'unknown';
  const recent = (RATE_LIMIT.get(key) || []).filter((time) => now - time < 15 * 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  RATE_LIMIT.set(key, recent);
  return true;
}

async function handleEnquiry(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  if (!String(request.headers['content-type'] || '').includes('application/json')) {
    return sendJson(response, 415, { error: 'JSON is required.' });
  }
  if (!allowSubmission(request)) return sendJson(response, 429, { error: 'Please wait a few minutes before sending another enquiry.' });
  try {
    const clean = validateEnquiry(await readRequestBody(request));
    const timestamp = istTimestamp();
    const enquiry = { ...clean, createdAt: timestamp.time, date: timestamp.date, phone: clean.phoneDigits };
    await saveEnquiryToSupabase(enquiry);
    try {
      await saveEnquiry(enquiry);
    } catch (error) {
      console.error('Local CSV backup failed after Supabase save:', error.message);
    }
    const message = [
      'Hello Shree Enterprises, I would like help with a water purifier enquiry.',
      `Name: ${clean.name}`,
      `Phone: ${clean.phone}`,
      `Address: ${clean.address}`,
      `Service required: ${clean.request}`,
      clean.details ? `Details: ${clean.details}` : '',
    ].filter(Boolean).join('\n');
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    return sendJson(response, 201, { saved: true, whatsappUrl });
  } catch (error) {
    return sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : 'We could not save the enquiry. Please contact the store directly.' });
  }
}

function isPublicFile(filePath) {
  const relative = path.relative(ROOT, filePath).replaceAll('\\', '/');
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return ['index.html', 'styles.css', 'app.js', 'products.js'].includes(relative) || relative.startsWith('assets/');
}

async function serveStatic(urlPath, response, headOnly = false) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { response.writeHead(400).end('Bad request'); return; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative);
  if (!isPublicFile(filePath)) { response.writeHead(404).end('Not found'); return; }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) { response.writeHead(404).end('Not found'); return; }
    const content = await readFile(filePath);
    const cache = relative.startsWith('assets/') ? 'public, max-age=604800, immutable' : 'no-cache';
    response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Content-Length': content.length, 'Cache-Control': cache });
    response.end(headOnly ? undefined : content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);
  let pathname;
  try { pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname; }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (pathname === '/api/enquiries') return handleEnquiry(request, response);
  if (pathname === '/api/health' && request.method === 'GET') return sendJson(response, 200, { status: 'ok' });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD, POST' }).end('Method not allowed');
    return;
  }
  await serveStatic(pathname, response, request.method === 'HEAD');
});

server.listen(PORT, HOST, () => {
  console.log(`Shree Enterprises is running at http://${HOST}:${PORT}`);
  console.log(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? 'Enquiries are stored in Supabase; a daily CSV backup is also enabled.'
    : 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before accepting enquiries.');
});
