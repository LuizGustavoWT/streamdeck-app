# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

To report a security issue, please use GitHub's **Private Vulnerability Reporting**:

1. Go to the [Security tab](https://github.com/LuizGustavoWT/streamdeck-app/security).
2. Click **Report a vulnerability**.
3. Fill in the details and submit.

Alternatively, email the maintainer directly. Do not include sensitive details in the subject line.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (if known)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity — critical issues addressed as quickly as possible

### Disclosure

We follow coordinated disclosure. Once a fix is released, we will:

1. Publish a security advisory on GitHub.
2. Credit the reporter (unless anonymity is requested).
3. Notify downstream consumers (OpenDeck community).

## Scope

The security policy covers:

- The mobile app (`mobile/`)
- The OpenDeck bridge plugin (`plugin/`)
- The shared protocol (`shared/`)
- The CI/CD pipeline (`.github/workflows/`)

Third-party dependencies are monitored via Dependabot (see `.github/dependabot.yml`).

## Best Practices for Contributors

- Never commit secrets, API keys, or tokens.
- Use `.env.local` (gitignored) for local configuration.
- Review PRs for potential credential leaks.
- Keep dependencies updated — Dependabot PRs should be reviewed promptly.
