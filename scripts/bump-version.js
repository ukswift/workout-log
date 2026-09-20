const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const [major, minor, patch] = packageJson.version.split(".").map(Number);
const increment = process.argv[2] || "patch";

const nextVersion = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}[increment];

if (!nextVersion) {
  console.error(`Unknown version increment: ${increment}`);
  process.exit(1);
}

packageJson.version = nextVersion;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const indexPath = path.join(root, "index.html");
const indexSource = fs.readFileSync(indexPath, "utf8");
const updatedIndex = indexSource.replace(
  /const APP_VERSION = "[^"]+";/,
  `const APP_VERSION = "${nextVersion}";`,
);
if (updatedIndex === indexSource) {
  console.error("Could not find APP_VERSION in index.html");
  process.exit(1);
}
fs.writeFileSync(indexPath, updatedIndex);

const readmePath = path.join(root, "README.md");
const readmeSource = fs.readFileSync(readmePath, "utf8");
const updatedReadme = readmeSource.replace(
  /### Current version: \d+\.\d+\.\d+/,
  `### Current version: ${nextVersion}`,
);
if (updatedReadme !== readmeSource) fs.writeFileSync(readmePath, updatedReadme);

console.log(`Version bumped to ${nextVersion}`);
