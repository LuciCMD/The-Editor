# The Editor - A Discord Bot 🌌

An ancient, sentient machine that can help you with everyday tasks. Built on
[discord.js](https://discord.js.org) v14 with modern **Components V2** interactive UI.

### Features

- **Music Player**: Play music from Spotify & YouTube with an interactive **now-playing panel** —
  pause/resume, skip, stop, volume, and queue, all via buttons (no commands needed). Just
  `/play <song or URL>`; plain text is searched on YouTube automatically. The `yt-dlp` engine
  self-updates on startup so playback keeps working as YouTube changes.

- **Reminders**: Run `/reminder` with no options to open a **fill-in form**, or pass options
  directly. **DST-aware** timezones (e.g. `EST` correctly becomes EDT in summer; IANA names like
  `America/New_York` and numeric offsets like `-5` also work), 12h/24h time, and repeating
  intervals. `/listreminders` shows your reminders with one-click **Cancel** buttons. Reminders fire
  on their original schedule (no drift), keep their local time across DST, and skip occurrences
  missed while the bot was offline.

- **Polls**: `/poll` creates a poll with **button voting** and live tallies. Click again to remove
  your vote. Votes persist across restarts.

- **Channel Watch**: `/watch` opens a **channel picker** to get DMs when a channel has new messages.
  `/listwatched` manages your watches with inline buttons.

- **Magic Conch**, **Roll Dice**, **Coin Flip**, **Special Currency**, **Countdown**,
  **Message Logger**, **VirusTotal Scan**, **Lyric Search**, **Gag Command**.

### Architecture

- `commands/` — slash commands (`{ data, execute }`), auto-loaded from the folder and subfolders.
- `components/` — interaction handlers (`{ id, execute }`) keyed by the customId prefix
  (`music`, `reminder`, `poll`, `watch`); routed from `app.js`.
- `passives/` — event handlers (`{ name, execute }`); `musicEvents.js` wires DisTube events and the
  now-playing panel.
- `utils/` — shared helpers (`config`, `componentsV2`, `reminders`, `polls`, `watch`, `volumeStore`,
  `permissions`).
- `database/dbManager.js` — pooled SQLite connections and schema.
- `test/` — tests for Node's built-in runner.

### Running

Requires Node.js 22.9+. Settings come from environment variables: copy `env.example` to `.env` and
fill in the bot token, API keys and `AUTHORIZED_USERS`. `.env` is git-ignored and never copied into
the Docker image.

```bash
npm install
npm start
```

Or with Docker (installs `ffmpeg` + `python3`, required for music). Compose reads `.env`:

```bash
docker compose up --build
```

### Testing

For a separate test bot, copy `env.test.example` to `.env.test` and fill in its token and your test
server's ID. Commands then register on that server instantly, and its data stays in
`database/sqlite-test/`, apart from the live bot's.

```bash
npm run dev
```

```bash
npm test
```

A lightweight HTTP health endpoint runs on port `3000` for the Docker healthcheck.

## License

This project is licensed under the MIT License.

---

© 2023 [LuciCMD]. All Rights Reserved.
