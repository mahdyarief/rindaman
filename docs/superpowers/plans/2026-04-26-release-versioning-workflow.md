# Release Versioning Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a documented, repeatable GitHub-only release workflow with version alignment, changelog discipline, and verified tag releases.

**Architecture:** Keep Rindaman private and GitHub-only. Add release documentation, release scripts, changelog structure, and a tag-triggered GitHub workflow that runs the existing verification stack and uploads the packed tarball as a release asset.

**Tech Stack:** GitHub Actions, npm scripts, changelog docs, git tags.

---

## File Structure

- Modify: `README.md` for release workflow references.
- Modify: `CHANGELOG.md` to add `Unreleased` and version section structure.
- Modify: `package.json` to add release-oriented scripts.
- Create: `docs/releasing.md` for the maintainer checklist.
- Create: `.github/workflows/release.yml` for tag-based releases.

## Task 1: Add Release Scripts and Changelog Scaffold

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add release scripts**

In `package.json`, extend `scripts` with:

```json
"release:check": "npm run typecheck && npm run build && npm test && node bin/rindaman.cjs doctor --json && npm pack --dry-run",
"release:pack": "npm pack"
```

- [ ] **Step 2: Add changelog scaffold**

Ensure `CHANGELOG.md` starts with:

```md
# Changelog

## Unreleased

### Added

### Changed

### Fixed
```

Keep any existing historical entries below that scaffold.

- [ ] **Step 3: Run release check command manually**

Run: `npm run release:check`

Expected: the new script succeeds locally.

## Task 2: Add Release Documentation

**Files:**
- Create: `docs/releasing.md`
- Modify: `README.md`

- [ ] **Step 1: Create release checklist document**

Create `docs/releasing.md` with these sections:

```md
# Releasing Rindaman

## Versioning

- Tags use `vX.Y.Z`
- `package.json.version` must match the tag without the `v`
- Patch: fixes, docs, internal improvements
- Minor: new backward-compatible CLI or plugin capability
- Major: breaking CLI JSON, command, config, or plugin behavior

## Checklist

1. Update `package.json.version`
2. Move relevant notes from `## Unreleased` into a new release section in `CHANGELOG.md`
3. Run `npm run release:check`
4. Commit the release metadata
5. Create tag `vX.Y.Z`
6. Push commit and tag
7. Confirm the GitHub release workflow succeeds

## Recovery

- If a tag was cut incorrectly, delete the local and remote tag, fix the metadata, and cut a new tag.
```

- [ ] **Step 2: Link release docs from README**

Add a short section near installation or maintenance docs:

```md
## Releasing

Rindaman uses a GitHub-only tag-based release workflow. See `docs/releasing.md` for the release checklist.
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: no behavior regressions from docs and script changes.

## Task 3: Add Tag-Based GitHub Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create release workflow**

Create `.github/workflows/release.yml` with:

```yaml
name: release

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
      - run: node bin/rindaman.cjs doctor --json
      - run: npm pack

      - name: Create GitHub release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh release create "${GITHUB_REF_NAME}" *.tgz --generate-notes
```

- [ ] **Step 2: Add version mismatch guard**

Add a workflow step before install:

```yaml
      - name: Verify package version matches tag
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PACKAGE_VERSION=$(node -p "require('./package.json').version")
          test "$TAG_VERSION" = "$PACKAGE_VERSION"
```

- [ ] **Step 3: Run existing CI-equivalent checks locally**

Run: `npm run release:check`

Expected: passes.

## Task 4: Final Verification

**Files:**
- All files above.

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: build passes.

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: tests pass.

- [ ] **Step 3: Run doctor JSON**

Run: `node bin/rindaman.cjs doctor --json`

Expected: JSON output with `status` equal to `passed`.

- [ ] **Step 4: Run package dry-run**

Run: `npm pack --dry-run`

Expected: package dry-run succeeds.

- [ ] **Step 5: Inspect git status**

Run: `git status --short`

Expected: only intended release workflow files are modified.
