# Contributing to Pecut AI

Thank you for your interest in contributing to Pecut AI! We welcome community contributions that help make AI workflows more organized, reliable, and accessible.

---

## 1. Development Principles

1. **Lightweight & Modular**: Pecut AI is built with modern vanilla ES Modules and Vite. We avoid heavy framework dependencies without strong justification.
2. **Security First**: Secrets (API keys, tokens, credentials) must never be committed, logged, or stored in browser client storage.
3. **Honest Engineering**: Features should perform real, verifiable work. Do not commit fabricated metrics or mock behavior disguised as functioning AI.

---

## 2. Developer Certificate of Origin (DCO 1.1)

To ensure clear provenance for all open-source contributions, Pecut AI uses the Developer Certificate of Origin (DCO).

Every commit submitted via a Pull Request must include a `Signed-off-by` line indicating agreement with [DCO.txt](DCO.txt).

You can automatically add this line to your commits using the `-s` flag:

```bash
git commit -s -m "feat(builder): add markdown preview export"
```

---

## 3. Getting Started

1. **Fork and clone** the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Run the test suite:
   ```bash
   npm test
   ```
5. Ensure production builds succeed:
   ```bash
   npm run build
   ```

---

## 4. Submitting Changes

- **Discuss Large Changes First**: For major architectural changes or new feature modules, please open an Issue first to align with maintainers.
- **Write Tests**: If you add new utility functions or data transformations, include unit tests under `tests/`.
- **Follow Conventional Commits**: Use clear commit prefixes like `feat:`, `fix:`, `docs:`, `refactor:`, or `test:`.
- **Verify Lint and Build**: Ensure `npm test` and `npm run build` pass with zero errors before submitting your PR.
