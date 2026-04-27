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
