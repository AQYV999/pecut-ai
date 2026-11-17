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

- **Bring Your Own Key (BYOK) Privacy**: In the client web application, user-supplied API keys (e.g. OpenRouter, Gemini, Groq, OpenAI) reside exclusively in the user's browser `localStorage` (`pecut_byok_config`) on their own private device. Keys are never transmitted to, stored on, or logged by any server database.
- **Universal Forwarder (Anti-SSRF)**: The `/api/ai/proxy` serverless endpoint enforces a strict domain allowlist (`openrouter.ai`, `generativelanguage.googleapis.com`, `api.groq.com`, `api.openai.com`) and HTTPS-only protocols to prevent open proxy abuse or internal network scanning.
- **Untrusted Input**: Treat all AI-generated output as untrusted text and sanitize properly via `escapeHtml()` before rendering to prevent cross-site scripting (XSS).
