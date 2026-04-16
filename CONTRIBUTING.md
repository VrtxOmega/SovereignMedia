# Contributing to Sovereign Media

Sovereign Media is a sealed, stable component of the VERITAS & Omega Universe operator stack. The core application is in frozen/stable status; contributions are accepted for **documentation**, **build tooling**, and **operator-authorized feature work** only.

---

## Before You Contribute

1. **Read [DO_NOT_TOUCH.md](./DO_NOT_TOUCH.md)** — The application runtime is sealed. Do not modify `main.js`, `preload.js`, `app.js`, `launcher.js`, or any core application logic without explicit operator authorization.
2. **Open an issue first** for any non-trivial change. Describe what you intend to change and why. Wait for acknowledgment before submitting a pull request.
3. All contributions must be **docs-only or build-tooling-only** unless you have explicit written authorization from the repository owner.

---

## Accepted Contribution Types

| Type | Accepted |
|---|---|
| Documentation improvements (README, SECURITY, CONTRIBUTING) | Yes |
| Build/packaging configuration (`electron-builder`, CI) | Yes, with issue first |
| Dependency version bumps (security patches) | Yes, with issue first |
| New features or refactors to application code | No — requires operator authorization |
| Changes to `main.js`, `preload.js`, `launcher.js`, `app.js` | No — requires operator authorization |

---

## Pull Request Process

1. Fork the repository.
2. Create a branch: `git checkout -b docs/your-change` or `build/your-change`.
3. Make your changes. Keep scope minimal and focused.
4. Open a pull request against `master` with a clear title and description.
5. Reference the related issue number in the PR description.

---

## Code Style

- This project does not enforce a linter for documentation. Follow the existing tone and formatting in the README (corporate-rigorous, zero-emoji in headings).
- JavaScript files follow the existing style in the repository. Do not reformat existing code.

---

## Reporting Issues

Use GitHub Issues. Include:
- Operating system and version
- Node.js version (`node --version`)
- Steps to reproduce
- Expected vs. actual behavior

---

<div align="center">
  <sub>SOVEREIGN MEDIA — VERITAS &amp; Omega Universe</sub>
</div>
