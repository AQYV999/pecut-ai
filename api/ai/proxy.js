/**
 * Pecut AI — Universal Serverless AI Proxy
 * Apache-2.0 License
 *
 * Forwards client requests to whitelisted AI providers to eliminate browser CORS
 * while keeping zero secrets or tokens on server disk or database.
 */

export const ALLOWED_DOMAINS = [
  'openrouter.ai',
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'api.openai.com'
];

/**
 * Validates whether a target URL is in the domain allowlist (Anti-SSRF).
 * @param {string} urlString
 * @returns {boolean}
 */
export function isUrlAllowed(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(allowed => hostname === allowed || hostname.endsWith('.' + allowed));
  } catch (_) {
    return false;
  }
}

/**
 * Core proxy request handler compatible with both Node HTTP and Vercel Serverless.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleProxyRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-target-url',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
  }

  const targetUrl = req.headers['x-target-url'];
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Missing required header: x-target-url' }));
  }

  if (!isUrlAllowed(targetUrl)) {
    res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      error: 'Forbidden: Target URL domain is not in the allowed AI provider list.',
      allowedDomains: ALLOWED_DOMAINS
    }));
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Missing required Authorization header.' }));
  }

  // Parse body
  let bodyBuffer = '';
  if (req.body && typeof req.body === 'object') {
    bodyBuffer = JSON.stringify(req.body);
  } else if (typeof req.body === 'string') {
    bodyBuffer = req.body;
  } else {
    bodyBuffer = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', () => resolve(''));
    });
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: bodyBuffer,
      signal: AbortSignal.timeout(12000)
    });

    const responseText = await upstreamRes.text();
    const contentType = upstreamRes.headers.get('content-type') || 'application/json';

    res.writeHead(upstreamRes.status, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(responseText);
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const status = isTimeout ? 504 : 502;
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: isTimeout ? 'Gateway Timeout: AI provider took longer than 12 seconds.' : `Proxy Error: ${err.message}`
    }));
  }
}

// Default export for Vercel Serverless Function
export default handleProxyRequest;
