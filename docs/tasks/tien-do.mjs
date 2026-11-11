// Đọc các file task trong docs/tasks, in bảng tiến độ, task có thể bắt đầu của từng người, và lỗi phụ thuộc (mã lạ, vòng lặp, "Mở khóa" lệch).
// Cách chạy: node docs/tasks/tien-do.mjs [--nguoi A|B|C|D]   (chỉ đọc, không sửa file nào; trả mã thoát 1 nếu có lỗi)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const PEOPLE = ['A', 'B', 'C', 'D'];
const STATUSES = ['chưa làm', 'đang làm', 'kẹt', 'chờ kiểm', 'làm lại', 'xong'];
const PER_PERSON = new Set(['T0', 'T1']); // task mỗi người làm riêng, trạng thái nằm trong ghi-chep/<mã>-<người>.md
const GROUP_ORDER = ['T', 'A', 'B', 'C', 'D', 'X'];

const args = process.argv.slice(2);
const fi = args.indexOf('--nguoi');
const only = fi >= 0 ? String(args[fi + 1] || '').toUpperCase() : null;
if (fi >= 0 && !PEOPLE.includes(only)) {
  console.error('Dùng: node docs/tasks/tien-do.mjs [--nguoi A|B|C|D]');
  process.exit(2);
}

const errors = [];
const warnings = [];
const norm = (s) => String(s).normalize('NFC').trim();
const idsIn = (v) => (!v || /^không/i.test(v) ? [] : [...new Set(v.match(/\b[A-Z]\d\b/g) || [])]);

function field(lines, label) {
  const prefix = `${label}:`;
  const line = lines.find((l) => norm(l).startsWith(prefix));
  return line === undefined ? undefined : norm(line).slice(prefix.length).trim();
}

function readLines(file) {
  return readFileSync(file, 'utf8').split(/\r?\n/);
}

// ---- Đọc các file task ----
const tasks = new Map();
// Task nằm trong các thư mục con của từng người (A-tai-khoan/, B-do-thi/, …, chung/); bỏ qua ghi-chep/.
const taskFiles = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'ghi-chep')
  .flatMap((e) => readdirSync(join(DIR, e.name)).map((f) => `${e.name}/${f}`))
  .sort();
for (const name of taskFiles) {
  const m = name.match(/\/([A-Z]\d)-[^/]+\.md$/);
  if (!m) continue;
  const id = m[1];
  const lines = readLines(join(DIR, name));
  const title = norm(lines[0] || '').replace(/^#\s*/, '').replace(new RegExp(`^${id}\\s*—\\s*`), '');
  const f = {};
  for (const label of ['Người làm', 'Trạng thái', 'Cần có trước', 'Cần trước bước frontend', 'Mở khóa']) {
    f[label] = field(lines, label);
    if (f[label] === undefined) errors.push(`${name}: thiếu dòng "${label}:"`);
  }
  if (tasks.has(id)) errors.push(`Trùng mã ${id}: ${tasks.get(id).file} và ${name}`);
  const owners = PER_PERSON.has(id)
    ? PEOPLE
    : PEOPLE.filter((p) => new RegExp(`(^|[^A-Za-z0-9])${p}([^A-Za-z0-9]|$)`).test(f['Người làm'] || ''));
  if (owners.length === 0) errors.push(`${name}: dòng "Người làm" không có A, B, C hoặc D`);
  const status = (f['Trạng thái'] || '').toLowerCase();
  if (!PER_PERSON.has(id) && !STATUSES.includes(status)) {
    errors.push(`${name}: trạng thái "${f['Trạng thái']}" không hợp lệ (hợp lệ: ${STATUSES.join(', ')})`);
  }
  tasks.set(id, {
    id,
    file: name,
    title,
    owners,
    status,
    hard: idsIn(f['Cần có trước']),
    soft: idsIn(f['Cần trước bước frontend']),
    unlocks: idsIn(f['Mở khóa']),
  });
}

if (tasks.size === 0) {
  console.error(`Không tìm thấy file task nào trong ${DIR}`);
  process.exit(1);
}

// ---- Trạng thái theo người cho T0, T1 ----
function statusOf(id, person) {
  const t = tasks.get(id);
  if (!t) return undefined;
  if (!PER_PERSON.has(id)) return t.status;
  const file = join(DIR, 'ghi-chep', `${id}-${person}.md`);
  if (!existsSync(file)) return 'chưa làm';
  const s = (field(readLines(file), 'Trạng thái') || 'chưa làm').toLowerCase();
  if (!STATUSES.includes(s)) {
    errors.push(`ghi-chep/${id}-${person}.md: trạng thái "${s}" không hợp lệ`);
  }
  return s;
}

function depDone(dep, owners) {
  if (!tasks.has(dep)) return false;
  if (PER_PERSON.has(dep)) return owners.every((p) => statusOf(dep, p) === 'xong');
  return tasks.get(dep).status === 'xong';
}

// ---- Kiểm mã phụ thuộc lạ ----
for (const t of tasks.values()) {
  for (const d of [...t.hard, ...t.soft, ...t.unlocks]) {
    if (!tasks.has(d)) errors.push(`${t.file}: nhắc tới mã ${d} nhưng không có file task ${d}-*.md trong các thư mục con`);
  }
  if (t.hard.includes(t.id) || t.soft.includes(t.id)) errors.push(`${t.file}: task tự phụ thuộc vào chính nó`);
}

// ---- Kiểm vòng lặp phụ thuộc bằng thuật toán Kahn ----
{
  const indeg = new Map([...tasks.keys()].map((k) => [k, 0]));
  const next = new Map([...tasks.keys()].map((k) => [k, []]));
  for (const t of tasks.values()) {
    for (const d of new Set([...t.hard, ...t.soft])) {
      if (!tasks.has(d) || d === t.id) continue;
      next.get(d).push(t.id);
      indeg.set(t.id, indeg.get(t.id) + 1);
    }
  }
  const queue = [...indeg].filter(([, v]) => v === 0).map(([k]) => k);
  let seen = 0;
  while (queue.length) {
    const u = queue.shift();
    seen += 1;
    for (const v of next.get(u)) {
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  if (seen < tasks.size) {
    // Còn in-degree > 0 = bị chặn (gồm cả task đứng SAU vòng lặp).
    // "Bóc ngược" như đặc tả B1: bỏ dần task không còn cạnh đi ra tới task bị chặn khác, phần còn lại là task nằm trên vòng.
    const blocked = new Set([...indeg].filter(([, v]) => v > 0).map(([k]) => k));
    const onCycle = new Set(blocked);
    let changed = true;
    while (changed) {
      changed = false;
      for (const k of [...onCycle]) {
        if (!next.get(k).some((v) => onCycle.has(v))) {
          onCycle.delete(k);
          changed = true;
        }
      }
    }
    const after = [...blocked].filter((k) => !onCycle.has(k));
    errors.push(
      `Có vòng lặp phụ thuộc giữa các task: ${[...onCycle].join(', ')}` +
        (after.length ? ` (bị kẹt theo: ${after.join(', ')})` : ''),
    );
  }
}

// ---- Kiểm dòng "Mở khóa" khớp với "Cần có trước" + "Cần trước bước frontend" của task khác ----
for (const t of tasks.values()) {
  const expected = [...tasks.values()]
    .filter((o) => o.hard.includes(t.id) || o.soft.includes(t.id))
    .map((o) => o.id);
  const missing = expected.filter((x) => !t.unlocks.includes(x));
  const extra = t.unlocks.filter((x) => !expected.includes(x));
  if (missing.length || extra.length) {
    warnings.push(
      `${t.file}: dòng "Mở khóa" lệch` +
        (missing.length ? ` — thiếu ${missing.join(', ')}` : '') +
        (extra.length ? ` — thừa ${extra.join(', ')}` : ''),
    );
  }
}

// ---- In bảng ----
const ordered = [...tasks.values()].sort((a, b) => {
  const ga = GROUP_ORDER.indexOf(a.id[0]);
  const gb = GROUP_ORDER.indexOf(b.id[0]);
  return ga - gb || Number(a.id.slice(1)) - Number(b.id.slice(1));
});
const visible = ordered.filter((t) => !only || t.owners.includes(only));
const pad = (s, n) => (String(s).length >= n ? String(s).slice(0, n - 1) + '…' : String(s).padEnd(n));

console.log(`\nTIẾN ĐỘ (${only ? 'người ' + only : 'cả nhóm'}) — đọc từ ${DIR}\n`);
console.log(`${pad('Mã', 5)}${pad('Người', 12)}${pad('Trạng thái', 46)}${pad('Cần có trước', 26)}Tên`);
console.log('-'.repeat(120));
for (const t of visible) {
  const who = PER_PERSON.has(t.id) ? 'mỗi người' : t.owners.join(',');
  const st = PER_PERSON.has(t.id)
    ? (only ? [only] : PEOPLE).map((p) => `${p}:${statusOf(t.id, p)}`).join(' ')
    : t.status;
  const owners = PER_PERSON.has(t.id) ? (only ? [only] : PEOPLE) : t.owners;
  const deps = t.hard.length ? t.hard.map((d) => `${d}${depDone(d, owners) ? '✔' : '✗'}`).join(' ') : '—';
  console.log(`${pad(t.id, 5)}${pad(who, 12)}${pad(st, 46)}${pad(deps, 26)}${t.title}`);
}

// ---- Theo từng người ----
for (const p of only ? [only] : PEOPLE) {
  const mine = ordered.filter((t) => t.owners.includes(p));
  const st = (t) => statusOf(t.id, p);
  const canStart = [];
  const waiting = [];
  const active = [];
  let done = 0;
  for (const t of mine) {
    const s = st(t);
    if (s === 'xong') { done += 1; continue; }
    if (['đang làm', 'kẹt', 'chờ kiểm'].includes(s)) { active.push(`${t.id} (${s})`); continue; }
    const owners = PER_PERSON.has(t.id) ? [p] : t.owners;
    const missing = t.hard.filter((d) => !depDone(d, owners));
    if (missing.length === 0) {
      const softMissing = t.soft.filter((d) => !depDone(d, owners));
      canStart.push(`${t.id}${s === 'làm lại' ? ' (làm lại)' : ''}${softMissing.length ? ` [bước FE còn chờ ${softMissing.join(', ')}]` : ''}`);
    } else {
      waiting.push(`${t.id} (chờ ${missing.join(', ')})`);
    }
  }
  console.log(`\n== Người ${p}: xong ${done}/${mine.length} ==`);
  console.log(`  Đang làm / chờ kiểm / kẹt : ${active.join(', ') || '—'}`);
  console.log(`  Có thể bắt đầu ngay       : ${canStart.join(', ') || '—'}`);
  console.log(`  Đang chờ                  : ${waiting.join(', ') || '—'}`);
}

// ---- Lỗi và cảnh báo ----
if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('\nKhông có lỗi phụ thuộc.');
