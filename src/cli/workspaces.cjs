const fs = require("node:fs");
const path = require("node:path");

function normalizePathForMatch(filePath) {
  return filePath.replace(/\\/g, "/");
}

function readPackageWorkspacePatterns(projectRoot, readJsonFile) {
  const packageJson = readJsonFile(path.join(projectRoot, "package.json"));
  const workspaces = packageJson?.workspaces;

  if (Array.isArray(workspaces)) {
    return workspaces;
  }

  if (Array.isArray(workspaces?.packages)) {
    return workspaces.packages;
  }

  return [];
}

function readPnpmWorkspacePatterns(projectRoot) {
  const workspacePath = path.join(projectRoot, "pnpm-workspace.yaml");

  if (!fs.existsSync(workspacePath)) {
    return [];
  }

  const workspaceFile = fs.readFileSync(workspacePath, "utf8");
  const packageLines = workspaceFile
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  return packageLines.map((line) => line.slice(2).replace(/^["']|["']$/g, ""));
}

function expandWorkspacePattern(projectRoot, workspacePattern) {
  if (!workspacePattern.endsWith("/*")) {
    return fs.existsSync(path.join(projectRoot, workspacePattern))
      ? [workspacePattern]
      : [];
  }

  const parentPattern = workspacePattern.slice(0, -2);
  const parentDirectory = path.join(projectRoot, parentPattern);

  if (!fs.existsSync(parentDirectory)) {
    return [];
  }

  return fs
    .readdirSync(parentDirectory, { withFileTypes: true })
    .filter((directoryEntry) => directoryEntry.isDirectory())
    .map((directoryEntry) =>
      normalizePathForMatch(path.join(parentPattern, directoryEntry.name)),
    )
    .filter((workspacePath) =>
      fs.existsSync(path.join(projectRoot, workspacePath, "package.json")),
    );
}

function discoverWorkspaces(projectRoot, readJsonFile) {
  const workspacePatterns = [
    ...readPackageWorkspacePatterns(projectRoot, readJsonFile),
    ...readPnpmWorkspacePatterns(projectRoot),
  ];
  const workspacePaths = [
    ...new Set(
      workspacePatterns.flatMap((workspacePattern) =>
        expandWorkspacePattern(projectRoot, workspacePattern),
      ),
    ),
  ].sort();

  return workspacePaths.map((workspacePath) => {
    const workspaceRoot = path.join(projectRoot, workspacePath);
    const workspacePackageJson =
      readJsonFile(path.join(workspaceRoot, "package.json")) ?? {};

    return {
      name: workspacePackageJson.name ?? workspacePath,
      path: workspacePath,
      root: workspaceRoot,
    };
  });
}

function selectWorkspace(projectRoot, workspaceTarget, readJsonFile) {
  const workspaces = discoverWorkspaces(projectRoot, readJsonFile);
  const normalizedTarget = normalizePathForMatch(workspaceTarget);
  const workspace = workspaces.find(
    (candidateWorkspace) =>
      candidateWorkspace.name === workspaceTarget ||
      candidateWorkspace.path === normalizedTarget,
  );

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceTarget}`);
  }

  return workspace;
}

module.exports = {
  normalizePathForMatch,
  readPackageWorkspacePatterns,
  readPnpmWorkspacePatterns,
  expandWorkspacePattern,
  discoverWorkspaces,
  selectWorkspace,
};
