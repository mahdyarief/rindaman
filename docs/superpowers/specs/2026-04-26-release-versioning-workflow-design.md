# Release Versioning Workflow Design

## Purpose

Rindaman now has enough product surface area that maintainers need a repeatable GitHub-only release workflow. Users should be able to reference tagged versions confidently, and maintainers should have a clear checklist for version bumps, changelog updates, verification, and release artifacts.

## Scope

Keep Rindaman as:

- `private: true`
- GitHub/local installation only
- not published to npm

Add a release workflow built around git tags:

- tags use `vX.Y.Z` format
- `package.json.version` matches the tag without the `v`

Release types:

- patch: fixes, docs, internal improvements
- minor: new backward-compatible CLI or plugin capability
- major: breaking CLI JSON, command, config, or plugin behavior

Add:

- `docs/releasing.md`
- release-oriented npm scripts
- GitHub workflow for tag-based releases
- changelog discipline with `Unreleased`

Out of scope:

- npm publishing
- semantic-release or changesets automation
- auto-versioning from commit history
- external package manager distribution

## Architecture

The workflow should remain simple and explicit:

1. Maintainer updates `package.json.version`
2. Maintainer moves relevant notes from `Unreleased` into a versioned changelog section
3. Maintainer runs a release verification command locally
4. Maintainer creates and pushes a `vX.Y.Z` tag
5. GitHub Actions verifies the tagged commit and publishes a GitHub release with the packed artifact

## Data Flow

Local release flow:

1. Update version and changelog
2. Run `npm run release:check`
3. Create tag `vX.Y.Z`
4. Push commit and tag

GitHub release flow:

1. Tag push triggers workflow
2. Workflow runs install, typecheck, build, test, doctor, and pack dry-run or pack
3. Workflow creates GitHub release
4. Workflow uploads the tarball from `npm pack` as a release asset

## Error Handling

The release workflow must fail when:

- version and tag mismatch
- changelog is missing the release version entry
- verification commands fail
- release asset creation fails

`docs/releasing.md` should document recovery steps for a failed tag workflow, including deleting a bad tag and re-cutting it.

## Testing Strategy

Use CI workflow validation and repository-level verification.

Add coverage for:

- release workflow YAML present and valid
- `release:check` script executes the expected checks
- changelog includes `Unreleased` scaffold

Verification commands:

- `npm run typecheck`
- `npm run build`
- `npm test`
- `node bin/rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- Maintainers have a documented, repeatable release checklist.
- Tagged releases run the same verification stack as CI.
- GitHub releases include a packaged tarball asset.
- The repo remains private and avoids npm publishing.
