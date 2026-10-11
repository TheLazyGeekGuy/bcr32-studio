## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist

- [ ] `npm test` passes locally (tests + type check).
- [ ] UI strings are written in English in the code and have a row in the i18n catalog for all 8 languages.
- [ ] No SysEx that writes to the device was added (no STORE `0x72`, no bootloader `0x77`, no unverified write).
- [ ] Tested with a BCR32: yes / no (say which firmware if yes).
- [ ] No personal data in code, logs or screenshots (paths, names, e-mail, serial numbers).
