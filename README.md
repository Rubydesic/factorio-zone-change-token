# Change Your Factorio Zone Token

A dependency-free userscript for managing server tokens and local save-slot names on Factorio Zone, Valheim Zone, and Satisfactory Zone.

## Install

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. [Install the userscript](https://github.com/Rubydesic/factorio-zone-change-token/raw/master/factoriozone-token.user.js).
3. Open the supported site or reload an existing tab.

Requires a modern browser with native HTML dialog support. No SweetAlert or other remotely loaded JavaScript is required.

## Use

The **Server token** toolbar sits immediately above the site's server controls.

- **Show token / Copy token** reveals or copies the current token. Tokens are hidden by default.
- **Change token** accepts an existing token. Blank input is rejected without changing your server. Cancel or Escape closes the dialog.
- **History** lists previous tokens stored in this browser. **Use token** opens a confirmation dialog before switching.
- **New token** explicitly confirms creating a fresh server identity. The previous token is kept in history so you can return.
- **[rename]** beside the Save upload link assigns a local slot name. Leave the name empty to restore the original label. Parentheses are reserved for save status.
- **Hide help / Show help** remembers your preference on this browser.

Switching tokens reloads the page. It does not delete existing saves. Token history and slot names are local to this browser and website; clearing site data removes them. Tokens grant access to your servers, so keep them private.

Existing history, slot names, and help-visibility settings from earlier versions are retained. The old `reset` text command is replaced by the explicit **New token** button; an empty slot name resets a save label.

## Tests

Node.js 22 or newer:

```sh
npm ci
npm test
```

The DOM regression tests cover missing and delayed controls, empty input, cancelled dialogs, token history, save labels, malformed stored data, storage failures, duplicate initialization, and safe text rendering. jsdom does not verify native browser rendering or focus trapping.

For an opt-in test against the real Factorio Zone website:

```sh
npx playwright install --with-deps firefox
npm run test:live
```

Run from a full Git checkout: the live test reads the original script from commit `318f1fe122c2e70fafe149046ad2f898218f38e1` to reproduce its failures. It uses disposable browser contexts, creates only temporary server identities, and never starts a game server or uploads/deletes saves. Screenshots and completed checks are written to `test-results/`. GitHub Actions also runs this test on pushes.

Before release, review desktop/mobile screenshots and test installation in your userscript manager. The live suite injects the exact script into Firefox; it does not install a userscript-manager extension. Valheim Zone and Satisfactory Zone retain their match entries but need separate live compatibility checks.
