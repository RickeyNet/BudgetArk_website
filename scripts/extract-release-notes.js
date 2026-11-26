/* Pull the app's user-facing release notes into scripts/release-notes/notes.json.

     node scripts/extract-release-notes.js ../BudgetArk

   Reads the app's src/data/releaseNotes.ts (the same list the app shows under
   Profile -> Release Notes), compiles it with the app's own TypeScript, and
   writes plain JSON. The JSON is committed, so scripts/build-release-notes.py
   runs without the app repo. Re-run both when the app ships a release. */
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = path.resolve(process.argv[2] || '../BudgetArk');
// The app's own TypeScript when its dependencies are installed; otherwise any
// TypeScript Node can resolve (the sync workflow installs one via NODE_PATH).
let ts;
try { ts = require(path.join(app, 'node_modules/typescript')); } catch (e) { ts = require('typescript'); }
const src = fs.readFileSync(path.join(app, 'src/data/releaseNotes.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'));
fs.writeFileSync(path.join(tmp, 'notes.js'), js);
const { RELEASE_NOTES } = require(path.join(tmp, 'notes.js'));
fs.rmSync(tmp, { recursive: true, force: true });

const releases = RELEASE_NOTES.map(({ version, title, releasedAt, highlights }) => ({ version, title, releasedAt, highlights }));
const out = path.join(__dirname, 'release-notes', 'notes.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ releases }, null, 2) + '\n');
console.log('wrote', out, '-', releases.length, 'releases, newest', releases[0].version);
