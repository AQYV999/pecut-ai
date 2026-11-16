# Security Policy for Pecut AI

The Pecut AI team takes security seriously. We appreciate your efforts to responsibly disclose any vulnerabilities you may discover.

---

## 1. Supported Versions

| Version | Supported |
| :--- | :--- |
| `0.1.x` (current main branch) | :white_check_mark: |
| Legacy pre-release snapshots | :x: |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability within Pecut AI:

1. **Do not open a public GitHub issue.**
2. Send a detailed description of the vulnerability, reproduction steps, and potential impact to the maintainers via security advisory on GitHub or email to `security@pecut.ai`.
3. Please allow reasonable time for the maintainers to review, triage, and patch the issue before public disclosure.

---

## 3. Security Guidelines & BYOK Policy

- **No Secrets in the Browser**: Pecut AI Community Edition does not store raw provider API keys in browser `localStorage` or `sessionStorage`.
- **Environment Variables**: API keys belong strictly in server-side environment variables (`.env`), never exposed to frontend client bundles.
- **Untrusted Input**: Treat all AI-generated output as untrusted text and sanitize properly before rendering to prevent cross-site scripting (XSS).
