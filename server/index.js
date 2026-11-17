/**
 * Pecut AI — Lightweight Self-Hosted Backend Server
 * Apache-2.0 License
 *
 * Zero external dependencies. Uses Node.js native http, fs, and fetch.
 * Reads API keys strictly from process.env / .env file.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGeminiOptimizer, callGeminiGenerate } from './providers/gemini.js';
import { handleProxyRequest } from '../api/ai/proxy.js';

// Load .env if present
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (_) {
  // .env loading is optional if environment variables are injected by host
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
export const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json'
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(DIST_DIR, reqPath);

  // Security: prevent path traversal outside DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Not Found. Run "npm run build" to generate production assets.');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });
}

export function createPecutServer() {
  return http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    const url = req.url.split('?')[0];

    // API Route: Universal BYOK Proxy
    if (url === '/api/ai/proxy') {
      return handleProxyRequest(req, res);
    }

    // API Route: Check AI status
    if (url === '/api/ai/status' && req.method === 'GET') {
      const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
      return sendJSON(res, 200, {
        status: hasGemini ? 'ready' : 'demo',
        provider: 'gemini',
        model: process.env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash',
        hasKey: hasGemini,
        engine: hasGemini ? 'Google Gemini' : 'Demo Engine (Local Structural)'
      });
    }

    // API Route: Optimize prompt
    if (url === '/api/ai/optimize' && req.method === 'POST') {
      try {
        const body = await parseJSONBody(req);
        const rawPrompt = (body.prompt || '').trim();
        const goals = Array.isArray(body.goals) ? body.goals : [];

        if (!rawPrompt) {
          return sendJSON(res, 400, { error: 'Prompt content is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || !apiKey.trim()) {
          return sendJSON(res, 200, {
            mode: 'demo',
            message: 'No GEMINI_API_KEY configured on server. Use demo mode or add key to .env.',
            hasKey: false
          });
        }

        const model = process.env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash';
        const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '30000', 10);

        const result = await callGeminiOptimizer({
          apiKey,
          model,
          prompt: rawPrompt,
          goals,
          timeoutMs
        });

        return sendJSON(res, 200, {
          mode: 'ai',
          provider: 'gemini',
          model,
          hasKey: true,
          ...result
        });
      } catch (err) {
        return sendJSON(res, 500, {
          error: err.message || 'Internal AI execution error'
        });
      }
    }

    // API Route: Execute workflow flow step
    if (url === '/api/ai/flow/step' && req.method === 'POST') {
      try {
        const body = await parseJSONBody(req);
        const { flowId, stepIndex, stepTitle, stepInstruction, inputData, previousOutput } = body;

        if (!inputData || !inputData.trim()) {
          return sendJSON(res, 400, { error: 'Workflow input data is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash';

        if (!apiKey || !apiKey.trim()) {
          const mockOutput = `### [DEMO STEP ${Number(stepIndex) + 1}: ${stepTitle || 'Step'}]\n\nProcessed Input:\n${inputData}\n\nOutcome:\n- Successfully generated output for step ${Number(stepIndex) + 1} per directives.\n- Ready to chain into subsequent workflow stages.\n\n(Note: Set GEMINI_API_KEY in .env to run with real Gemini AI)`;
          return sendJSON(res, 200, {
            mode: 'demo',
            flowId,
            stepIndex,
            stepTitle,
            output: mockOutput,
            hasKey: false
          });
        }

        const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '30000', 10);
        const promptText = `WORKFLOW INPUT:\n${inputData}\n\nPREVIOUS STEP OUTPUT:\n${previousOutput || '(Initial step - no previous output)'}\n\nTASK INSTRUCTIONS:\n${stepInstruction}`;
        const sysInstruction = `You are Pecut AI Workflow Engine executing Step ${Number(stepIndex) + 1}: "${stepTitle}". Provide a direct, authoritative, structured output. Avoid filler text.`;

        const result = await callGeminiGenerate({
          apiKey,
          model,
          prompt: promptText,
          systemInstruction: sysInstruction,
          timeoutMs
        });

        return sendJSON(res, 200, {
          mode: 'ai',
          flowId,
          stepIndex,
          stepTitle,
          output: result.text,
          provider: 'gemini',
          model,
          hasKey: true
        });
      } catch (err) {
        return sendJSON(res, 500, {
          error: err.message || 'Flow step execution error'
        });
      }
    }

    // Default: Serve static files
    serveStatic(req, res);
  });
}

export function startServer(port = DEFAULT_PORT) {
  const srv = createPecutServer();
  srv.listen(port, () => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    console.log(`[Pecut AI] Server listening on http://localhost:${port}`);
    console.log(`[Pecut AI] AI Provider: Gemini (${process.env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash'})`);
    console.log(`[Pecut AI] BYOK Key Status: ${hasKey ? 'Configured (Active)' : 'Not Configured (Demo Mode)'}`);
  });
  return srv;
}

// Auto-start if executed directly via `node server/index.js`
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  startServer(DEFAULT_PORT);
}
