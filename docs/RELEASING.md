# Releasing

The package is published to npm as `@random-lunacy/rezrov-zmachine`.

## One-time setup

1. **npm**: an account with 2FA, and the `random-lunacy` organization.
2. **First publish** (manual, because trusted publishing can only be configured for a package that exists):

   ```bash
   git checkout main && git pull
   npm ci
   npm login
   npm publish --tag next --access public --provenance=false
   ```

   `--provenance=false` is needed because provenance only works from CI. `prepublishOnly` runs lint, build and the
   tests first. npm asks for a one-time 2FA code.

3. **Trusted publisher**: on npmjs.com open the package, then Settings, then Trusted Publisher, and add GitHub Actions
   with these values:

   | Field                | Value             |
   | -------------------- | ----------------- |
   | Organization or user | `Random-Lunacy`   |
   | Repository           | `rezrov-zmachine` |
   | Workflow filename    | `publish.yml`     |
   | Environment          | leave blank       |

   Afterwards, in the package's publishing access settings, you can require 2FA and disallow tokens, so only the
   workflow can publish.

4. Tag the first publish without making a release (a release would run the workflow):

   ```bash
   git tag v1.0.0-rc.0 && git push origin v1.0.0-rc.0
   ```

## Each release

1. Set `version` in `package.json` (`npm version <version> --no-git-tag-version`) and merge it to `main`.
   Use `1.0.0-rc.1` style versions for release candidates.
2. On GitHub, create a release with the tag `v<version>` targeting `main`. Tick **Set as a pre-release** for an rc.
3. Publishing the release runs `publish.yml`: it runs the full test workflow, checks the tag matches `package.json`,
   and publishes with provenance. Prereleases go to the `next` dist-tag and stable versions to `latest`.
4. Check it: `npm view @random-lunacy/rezrov-zmachine dist-tags`.

To check the workflow without publishing, run **Publish to npm** from the Actions tab (a dry run).

## Promoting or fixing dist-tags

```bash
npm dist-tag ls @random-lunacy/rezrov-zmachine
npm dist-tag add @random-lunacy/rezrov-zmachine@1.0.0 latest
```

A published version can't be republished. Fix forward with a new version, or `npm deprecate` a bad one.
