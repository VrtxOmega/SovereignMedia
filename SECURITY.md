# Security Policy

## Supported Versions

Sovereign Media is a sealed desktop application in stable/frozen operational status. Security-relevant patches are applied at the operator's discretion.

| Version | Supported |
|---|---|
| 2.x (current) | Yes |
| < 2.0 | No |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Sovereign Media, please report it privately:

1. **Email:** Open a [GitHub Security Advisory](https://github.com/VrtxOmega/SovereignMedia/security/advisories/new) (preferred — keeps disclosure private and tracked).
2. Alternatively, contact the repository owner directly via GitHub: [@VrtxOmega](https://github.com/VrtxOmega).

Please include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested mitigations (optional)

You will receive an acknowledgment within **7 business days**. We ask that you allow reasonable time for assessment and patching before any public disclosure.

---

## Security Architecture Notes

The following are design decisions relevant to the security posture of Sovereign Media. See [README.md — Security & Sovereignty](./README.md#security--sovereignty) for the full summary.

- **Context isolation** is enabled; the renderer process does not have direct Node.js access.
- **webSecurity is disabled** in the current build to support local file protocol loading. Operators should be aware this relaxes certain same-origin enforcement in the renderer.
- **Mobile remote bridge** (`localtunnel`) exposes a local port externally when enabled. Disable in high-security environments.
- No credentials, tokens, or secrets are stored by the application by default.

---

## Dependency Vulnerabilities

To audit current dependencies:

```bash
npm audit
```

Submit a pull request or open an issue for dependency version bumps addressing CVEs. Reference the CVE number and the `npm audit` advisory ID in your submission.

---

<div align="center">
  <sub>SOVEREIGN MEDIA — VERITAS &amp; Omega Universe</sub>
</div>
