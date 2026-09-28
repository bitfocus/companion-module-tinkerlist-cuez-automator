# companion-module-tinkerlist-cuez-automator

[Bitfocus Companion](https://bitfocus.io/companion) module for Cuez Automator. User help: [companion/HELP.md](companion/HELP.md).

Version 2 is a rewrite in TypeScript on module API 2.x (Companion 4.3 and newer). It keeps the 1.x action ids, option names and variables, so existing buttons keep working.

## Develop

```sh
corepack enable
yarn install
yarn build        # tsc → dist/
yarn test         # node --experimental-strip-types test/cuez.test.ts
yarn lint
yarn dev          # rebuild on save
```

To run it in Companion: in the launcher window, click the cog (**Advanced Settings**). Under **Developer**, click **Select** and choose the folder that _contains_ this checkout, not the checkout itself. Then turn on **Enable Developer Modules** and add the connection. Companion reloads the module when `dist/` changes.

## Layout

- `src/cuez.ts`: the API surface: request building, error hints, tolerant list and rundown parsing. The Cuez Automator Stream Deck plugin shares this code, so fix bugs in both.
- `src/main.ts`: the connection. One WebSocket to `/ws` tells the module that something changed; the documented REST endpoints are then re-read, with a 2s poll when the socket is down. It also runs the `app/init` handshake, which the Automator requires before it sends the info that fills the automator/project/episode variables.
- `src/definitions.ts`: actions, feedbacks, variables and presets.
- `UpgradeScripts` in `src/main.ts`: never remove or reorder one. Companion counts them by position, and the first one is 1.x's placeholder.

## Release

1. Bump `version` in `package.json`. `companion/manifest.json` stays at `0.0.0`; the build fills it in.
2. Commit, then tag and push: `git tag v2.0.0 && git push origin main --tags`.
3. On the [Bitfocus Developer Portal](https://developer.bitfocus.io/), open **My Connections → Cuez Automator → Submit Version**, pick the tag, and submit.
4. Bitfocus volunteers review it. Once approved, it shows up in Companion's module store.

To test a build before submitting: `yarn package` makes `tinkerlist-cuez-automator-<version>.tgz`, which you can import under **Modules → Import module package** in Companion.
