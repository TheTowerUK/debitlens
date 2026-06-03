# DebitLens — App Operations Documentation

This `docs/` folder follows the standard app operations template used across all app repositories. Copy structure and filenames stay consistent; contents are app-specific.

Replace placeholder entries with DebitLens details as you ship releases and update platform configuration.

## Folder structure

```
docs/
├── README.md
├── platform/
├── release/
├── operations/
└── product/
```

## Operations index

### Platform

- [platform.md](./platform/platform.md) — Stack, APIs, identifiers, secrets
- [release-process.md](./platform/release-process.md) — Deployment cheat sheet
- [ios-submission-guide.md](./platform/ios-submission-guide.md) — App Store Connect submission
- [android-submission-guide.md](./platform/android-submission-guide.md) — Google Play Console submission
- [troubleshooting.md](./platform/troubleshooting.md) — Build, submit, and runtime issues

### Release

- [release-notes.md](./release/release-notes.md) — Current version notes for store submissions
- [release-history.md](./release/release-history.md) — Full version log and changelog
- [build-history.md](./release/build-history.md) — EAS build and submit records

### Operations

- [app-store-checklist.md](./operations/app-store-checklist.md) — iOS pre-submission checklist
- [play-store-checklist.md](./operations/play-store-checklist.md) — Android pre-submission checklist
- [eas-commands.md](./operations/eas-commands.md) — Common EAS CLI commands

### Product

- [app-content.md](./product/app-content.md) — App overview for onboarding developers and AI assistants

## Related documentation (repo root)

These files predate the structured `docs/` layout and are preserved at the repository root:

- [debit_lens_claude_optimised_context_brief.md](../debit_lens_claude_optimised_context_brief.md) — App context brief
- [RECOVERY_POINTS.md](../RECOVERY_POINTS.md) — Recovery and checkpoint notes
