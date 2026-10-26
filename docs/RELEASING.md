# Releasing

The package is published to npm as `@random-lunacy/rezrov-zmachine`.

Releases use npm **staged publishing**: the workflow uploads the tarball to a queue, and a maintainer approves it with
2FA before it becomes installable. No token is stored anywhere; the workflow authenticates with trusted publishing
(OIDC).

## One-time setup (done)

1. An npm account with 2FA, and the `random-lunacy` organization.
2. The first version was published by hand, because a trusted publisher can only be added to a package that exists:
   `npm publish --tag next --access public --provenance=false` (this was `1.0.0-rc.0`, tagged `v1.0.0-rc.0`).
3. On the package's npmjs.com Settings page, a **Trusted Publisher** for GitHub Actions:

   | Field                | Value                    |
   | -------------------- | ------------------------ |
   | Organization or user | `Random-Lunacy`          |
   | Repository           | `rezrov-zmachine`        |
   | Workflow filename    | `publish.yml`            |
   | Environment          | blank                    |
   | Allowed actions      | `npm stage publish` only |

   Direct `npm publish` and `npm dist-tag` are not allowed for the workflow. These fields can't be edited, only
   deleted and recreated. A new trusted publisher shows "Pending validation" until its first successful publish.

4. Publishing access is set to require 2FA and disallow bypass-2FA tokens.

## Each release

1. Set `version` in `package.json` (`npm version <version> --no-git-tag-version`) and merge it to `main`. Use
   `1.0.0-rc.1` style versions for release candidates.
2. On GitHub, create a release with the tag `v<version>` targeting `main`. Tick **Set as a pre-release** for an rc.
3. Publishing the release runs `publish.yml`: it runs the full test workflow, checks the tag matches `package.json`,
   and stages the version. Prereleases use the `next` dist-tag and stable versions use `latest`.
4. **Approve the staged version** (this is what makes it live), on the package's page on npmjs.com or with:

   ```bash
   npm stage list @random-lunacy/rezrov-zmachine
   npm stage view <stage-id>      # optional: inspect the tarball
   npm stage approve <stage-id>   # asks for 2FA
   ```

   `npm stage reject <stage-id>` discards it. These commands need npm 11.15 or later and don't work with OIDC, so run
   them yourself, not in CI.

5. Check it: `npm view @random-lunacy/rezrov-zmachine dist-tags` and, for provenance,
   `npm view @random-lunacy/rezrov-zmachine@<version> dist.attestations`.

To check the workflow without publishing, run **Publish to npm** from the Actions tab (a dry run).

## Promoting or fixing dist-tags

The workflow can't change dist-tags, so do it by hand (it needs 2FA):

```bash
npm dist-tag ls @random-lunacy/rezrov-zmachine
npm dist-tag add @random-lunacy/rezrov-zmachine@1.0.0 latest
```

A published version can't be republished. Fix forward with a new version, or `npm deprecate` a bad one.
