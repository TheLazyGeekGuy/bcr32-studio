# Security policy

## Reporting

Please report security problems privately through GitHub: Security > "Report a vulnerability" on this repository.
Do not open a public issue for them.

## Scope

- The web app (XSS, unsafe handling of imported preset files, Content-Security-Policy weaknesses).
- Anything that could make the app send an unintended **write** to a device (SysEx STORE, bootloader or firmware
  update, unverified configuration writes). These are treated as security issues because they can damage hardware.
- Leaks of secrets or personal data in the repository or the deployed site.

The app runs entirely in the browser: no account, no server-side storage, no analytics. Presets and settings stay in
the browser's local storage.
