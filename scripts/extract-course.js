/* Pull the Captain's Course out of the app repo into scripts/course/lessons.json.

     node scripts/extract-course.js ../BudgetArk

   Reads the app's src/data/lessonChapters.ts, src/data/lessons/*.ts, and the
   English learning disclaimer, compiles them with the app's own TypeScript,
   and writes plain JSON. The JSON is committed, so scripts/build-course.py
   runs without the app repo. Re-run both when the app changes a lesson. */
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = path.resolve(process.argv[2] || '../BudgetArk');
const ts = require(path.join(app, 'node_modules/typescript'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'course-'));

function load(rel) {
  const src = fs.readFileSync(path.join(app, rel), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const out = path.join(tmp, rel.replace(/[\\/]/g, '_').replace(/\.ts$/, '.js'));
  fs.writeFileSync(out, js);
  return require(out);
}

const { CHAPTERS } = load('src/data/lessonChapters.ts');
const disclosures = load('src/i18n/locales/en/dataDisclosures.ts');
const disclaimer = Object.values(disclosures).map((v) => v && v.learningDisclaimer).find(Boolean);
if (!disclaimer) throw new Error('learningDisclaimer not found in dataDisclosures.ts');

const chapters = CHAPTERS.map((ch) => ({
  id: ch.id,
  number: ch.number,
  title: ch.title,
  subtitle: ch.subtitle,
  glyph: ch.glyph,
  lessons: ch.lessons.map((stub) => {
    const file = `src/data/lessons/${stub.id}.ts`;
    if (!fs.existsSync(path.join(app, file))) throw new Error(`no lesson body for ${stub.id}`);
    const lesson = load(file).default;
    if (lesson.id !== stub.id) throw new Error(`id mismatch in ${file}`);
    // Course order and titles come from the chapter outline, like the app.
    return { ...lesson, number: stub.number, title: stub.title, readMin: stub.readMin, topics: stub.topics };
  }),
}));

const out = path.join(__dirname, 'course', 'lessons.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ disclaimer, chapters }, null, 2) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out, '-', chapters.reduce((n, c) => n + c.lessons.length, 0), 'lessons in', chapters.length, 'chapters');
