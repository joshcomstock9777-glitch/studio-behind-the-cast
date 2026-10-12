# Studio Go web preview

This is a web export of the existing `joshcomstock9777-glitch/moonshadow-studio-go` repository, branch `codex/script-workspace-sprint`, commit `e6ceebd6a9567e0e26ee14aefba14ffcc2c02ead`. It is not a new Studio app or writer service. The generated frontend calls the existing same-origin `/api/sessions` routes. Path backend code and secrets are unchanged.

Source of truth: the Studio Go repository. Do not hand-edit the minified bundle. To refresh it, run `npm ci` and `env -u EXPO_PUBLIC_PATH_API_URL CI=1 npx expo export --platform web --output-dir dist-web-proof` in the source checkout. Copy the export into this folder and prefix its HTML asset URLs with `/studio/`. Regenerate `source-manifest.json` from the resulting files and record the exact source commit. Keep the original editor, assets and factory surfaces; this sprint tests only Script.

This branch is intended for preview verification, not an authorized production release. Test actual model completion, selected-passage revision, retained originals, same-browser reload and download before considering release. Browser storage is local to that browser and origin; switching to a production origin does not migrate preview drafts. Download reviewed drafts before moving origins.
