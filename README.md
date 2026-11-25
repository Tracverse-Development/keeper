<div align="center">
  <img src="assets/art/app-icon.png" width="120" alt="">
  <h1>Keeper</h1>
  <p><em>by Umoja Ark</em></p>
  <p><strong>A personal assistant you talk to, whose memory lives on your own OriginTrail DKG node.</strong></p>
</div>

Keeper is a desktop app with a 3D character you can speak to. Everything it learns about you,
everything you talk about and everything it does is a **Knowledge Asset in a private Context Graph on
your own DKG node**, and every answer is made from **SPARQL queries over that graph**, which the app
shows you. There is no other database.

## What it does

- **Remembers you, on your DKG.** Facts, conversations, actions and reminders are Knowledge Assets in your node's private working memory. Nothing is shared or published.
- **Thinks with the engine you choose, switchable any time.** Claude Code, Codex or the Gemini CLI with your own subscription, the Hermes agent guarded by [Agent Blackbox](https://github.com/famousamos-chillzone/agent-blackbox), a local model through Ollama, or the built-in mind that needs no model. Say "switch your brain to Claude" or change it in Settings.
- **Acts on your computer, when you allow it.** Agent engines can run commands and work with your files; every tool call is recorded on your graph, so "what did you do?" is a query.
- **Talks.** On-device speech recognition, the Mac's voices or ElevenLabs, a mouth that moves with the words, an always-listening wake word if you want it.
- **Feels alive.** A robot (the default) or a puppy; its eyes follow your pointer; click it and it answers, stroke its head and it enjoys it.
- **Goes with you.** Scan a QR code and talk to it from your phone on the same Wi-Fi.
- **Keeps itself current.** Signed automatic updates from this repository's releases.

## Install

Download the latest `.dmg` from [Releases](../../releases), open it and drag Keeper into Applications.
On first run it finds your DKG node (or installs one), creates your memory graph and introduces your assistant.

## Build from source

```bash
npm install
npm run voice        # the Swift voice helper (macOS)
npm run app:build    # → src-tauri/target/release/bundle/{macos,dmg}
npm run check        # typecheck + tests (Rust and TypeScript, including structure guards)
```

Releases (maintainers): `bash scripts/release.sh "notes"` builds, signs and publishes the update feed.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module map and [docs/SECURITY_LOG.md](docs/SECURITY_LOG.md) for the security design.

## Licence

MIT for the code. The Umoja Ark name and mark are trademarks of Tracverse L.L.C. (see [LICENSE](LICENSE)).
