import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashText, parseSrc, spliceTopLevel, editableView, validateEdit } from './srcio.mjs';

let checks = 0;
function test(name, run) {
  run();
  checks++;
  console.log(`PASS ${name}`);
}
const sourceDir = new URL('../areas/', import.meta.url);
const files = readdirSync(sourceDir).filter(file => file.endsWith('.src.json')).sort();
const sources = new Map(files.map(file => [file, readFileSync(new URL(file, sourceDir), 'utf8')]));
assert(files.length > 0, 'Real sources must be present');

// Both untouched prefixes/suffixes and every unrelated value must remain exact.
function onlyValueChanged(before, after, key) {
  const a = parseSrc(before), b = parseSrc(after);
  assert.equal(after.slice(0, b.spans[key].start), before.slice(0, a.spans[key].start));
  assert.equal(after.slice(b.spans[key].end), before.slice(a.spans[key].end));
  for (const name of Object.keys(a.spans)) if (name !== key) {
    assert.equal(after.slice(b.spans[name].start, b.spans[name].end), before.slice(a.spans[name].start, a.spans[name].end));
  }
}

test('SHA256 UTF-8 and known digest', () => {
  assert.equal(hashText('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hashText(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.notEqual(hashText('á'), hashText('a'));
  assert.notEqual(hashText('abc'), hashText('abc\n'));
});

for (const [file, text] of sources) test(`real round-trip ${file}`, () => {
  const { obj, spans } = parseSrc(text);
  assert.deepEqual(obj, JSON.parse(text));
  assert.deepEqual(Object.keys(spans), Object.keys(obj));
  for (const [key, span] of Object.entries(spans)) assert.deepEqual(JSON.parse(text.slice(span.start, span.end)), obj[key]);
  assert.equal(spliceTopLevel(text, {}), text);
  // Cloning proves this is value equality, not object identity.
  if (Object.hasOwn(obj, 'pieces')) {
    assert.equal(spliceTopLevel(text, { pieces: structuredClone(obj.pieces) }), text);
    assert.equal(spliceTopLevel(text, { kits: structuredClone(obj.kits), pieces: structuredClone(obj.pieces) }), text);
  }
});

test('move one of 140 real HVQ placements, only pieces bytes change', () => {
  const text = sources.get('huyen-van-quan-v2.src.json'), { obj } = parseSrc(text);
  assert.equal(obj.pieces.length, 140);
  const expected = structuredClone(obj);
  expected.pieces[0].x += 5;
  expected.pieces[0].y += 3;
  const next = spliceTopLevel(text, { pieces: expected.pieces });
  onlyValueChanged(text, next, 'pieces');
  assert.deepEqual(JSON.parse(next), expected);
  assert.equal(next.endsWith('\n'), text.endsWith('\n'));
  assert.equal(next.slice(parseSrc(next).spans.pieces.start, parseSrc(next).spans.pieces.end), JSON.stringify(expected.pieces));
  assert.equal(spliceTopLevel(next, { pieces: obj.pieces }), text, 'Undo restores exact original bytes');
});

test('add pieces and kits to real hau-son-v3, preserve all existing bytes', () => {
  const text = sources.get('hau-son-v3.src.json'), { obj, spans } = parseSrc(text);
  assert(!Object.hasOwn(obj, 'pieces') && !Object.hasOwn(obj, 'kits'));
  const edits = { pieces: [{ k: 'C-R1/example', x: 12, y: 34 }], kits: { 'C-R1': 'assets/kits/C-R1/kit.json' } };
  const next = spliceTopLevel(text, edits), parsed = parseSrc(next);
  assert.deepEqual(parsed.obj, { ...obj, ...edits });
  for (const [key, span] of Object.entries(spans)) {
    assert.equal(next.slice(parsed.spans[key].start, parsed.spans[key].end), text.slice(span.start, span.end));
  }
  const close = text.lastIndexOf('}');
  assert.equal(next.slice(0, close), text.slice(0, close));
  assert.equal(next.slice(-2), text.slice(-2));
  assert.equal(spliceTopLevel(next, { pieces: undefined, kits: undefined }), text);
});

test('tokenizer handles escaped quotes, backslashes, Unicode, numbers and nesting', () => {
  const text = String.raw` { "a\"\\á\u0062": "á \" \\ \uD83D\uDE00 ,}:[", "n": -1.5e3, "list": [1, [true, null, {"x": [false, 2.4E-2]}]], "obj": {"pieces": [1]}, "pieces": [{"y":2,"k":"A/x","x":1}] }` + '\r\n';
  const { obj, spans } = parseSrc(text);
  assert.equal(obj.n, -1500);
  assert.equal(text.slice(spans.n.start, spans.n.end), '-1.5e3');
  for (const key of Object.keys(obj)) assert.deepEqual(JSON.parse(text.slice(spans[key].start, spans[key].end)), obj[key]);
  assert.equal(spliceTopLevel(text, { n: -1500 }), text, 'Do not normalize number notation');
  const pieces = [{ y: 2, k: 'A/x', x: 3 }], next = spliceTopLevel(text, { pieces });
  onlyValueChanged(text, next, 'pieces');
  assert(next.includes('[{"y":2,"k":"A/x","x":3}]'), 'Keep input property order');
  assert(next.endsWith('\r\n'));
});

test('multiline insert uses root indentation and CRLF, final LF unchanged', () => {
  for (const newline of ['\n', '\r\n']) for (const indent of [' ', '  ', '\t']) for (const suffix of ['', newline]) {
    const text = ['{', `${indent}"old": {"v":1}`, '}'].join(newline) + suffix;
    const edits = { pieces: [{ k: 'A/x', x: 1, y: 2 }], kits: { A: 'assets/kits/A/kit.json' } };
    const next = spliceTopLevel(text, edits);
    assert.deepEqual(JSON.parse(next), { old: { v: 1 }, ...edits });
    assert(next.includes(`,${newline}${indent}"pieces": [{"k":"A/x","x":1,"y":2}]`));
    assert.equal(next.endsWith(newline), Boolean(suffix));
    assert.equal(spliceTopLevel(next, { pieces: undefined, kits: undefined }), text);
  }
});

test('delete every subset of root keys, including adjacent and all keys', () => {
  for (const text of ['{"a":1,"b":2,"c":3,"d":4}', '{\r\n  "a": 1,\r\n  "b": 2,\r\n  "c": 3,\r\n  "d": 4\r\n}\r\n']) {
    for (let mask = 0; mask < 16; mask++) {
      const expected = JSON.parse(text), edits = {};
      for (const [index, key] of ['a', 'b', 'c', 'd'].entries()) if (mask & (1 << index)) {
        edits[key] = undefined;
        delete expected[key];
      }
      assert.deepEqual(JSON.parse(spliceTopLevel(text, edits)), expected);
    }
    assert.deepEqual(JSON.parse(spliceTopLevel(text, { b: undefined, c: 8, d: undefined, e: 9 })), { a: 1, c: 8, e: 9 });
  }
});

test('empty roots, escaped keys, duplicate keys and prototype-named keys', () => {
  for (const text of ['{}', '{ }\n', '{\r\n}\r\n']) {
    const next = spliceTopLevel(text, { pieces: [], kits: {} });
    assert.deepEqual(JSON.parse(next), { pieces: [], kits: {} });
    assert.equal(next.endsWith('\n'), text.endsWith('\n'));
  }
  const text = String.raw`{"\u0070ieces":[1],"pieces":[2],"__proto__":{"a":1},"constructor":5}`;
  assert.equal(parseSrc(text).spans.pieces.start, text.indexOf('[2]'));
  const next = spliceTopLevel(text, { pieces: [3] });
  assert.equal(next.match(/\[3\]/g).length, 2);
  assert(!spliceTopLevel(text, { pieces: undefined }).includes('pieces'));
  assert.deepEqual(parseSrc(text).obj, JSON.parse(text));
  assert.equal(parseSrc(text).spans.__proto__.start, text.indexOf('{"a"'));
  assert.deepEqual(JSON.parse(spliceTopLevel('{}', JSON.parse('{"__proto__":1}'))), JSON.parse('{"__proto__":1}'));
});

test('invalid JSON and non-object source fail before scanning', () => {
  for (const text of ['', '{', '{"a": [}', '{"a": 1,}', '{"a":"\\q"}', '{} garbage', '[]', 'null', '3']) {
    assert.throws(() => parseSrc(text));
    assert.throws(() => spliceTopLevel(text, {}));
  }
});

const kit = { kit: 'TEST', pieces: {
  base: { file: 'base.png', layer: 'base', anchor: [0, 0], footprint: [8, 8], collide: [], pair: 'roof' },
  roof: { file: 'roof.png', layer: 'roof', anchor: [0, 0], footprint: [8, 8], collide: [] }
} };
const obj = { area: { id: 'test-area' }, bake: { width: 100, height: 80 },
  kits: { TEST: 'assets/kits/TEST/kit.json' }, pieces: [{ k: 'TEST/base', x: 10, y: 20 }] };
const args = { id: 'test-area', fileId: 'test-area', obj, edits: {}, kitsJson: { TEST: kit } };
function rejected(change, pattern) {
  const result = validateEdit({ ...args, ...change });
  assert.equal(result.ok, false);
  assert(result.errors.length > 0);
  if (pattern) assert(result.errors.some(error => pattern.test(error)), JSON.stringify(result));
}

test('editableView reads root fields and bake size, supports legacy area fields', () => {
  assert.deepEqual(editableView(obj), { id: 'test-area', width: 100, height: 80, kits: obj.kits, pieces: obj.pieces });
  assert.deepEqual(editableView({ area: { ...obj.area, kits: obj.kits, pieces: obj.pieces }, bake: obj.bake }), editableView(obj));
  assert.deepEqual(editableView({ area: obj.area, bake: obj.bake }), { id: 'test-area', width: 100, height: 80, kits: {}, pieces: [] });
});

test('validate valid kit, paired roof, boundary coordinates and deletion', () => {
  assert.deepEqual(validateEdit(args), { ok: true, errors: [] });
  for (const [x, y] of [[0, 0], [100, 80]]) {
    assert.equal(validateEdit({ ...args, edits: { pieces: [{ k: 'TEST/base', x, y }] } }).ok, true);
  }
  assert.equal(validateEdit({ ...args, edits: { kits: undefined, pieces: undefined } }).ok, true);
  assert.deepEqual(validateEdit({ ...args, obj: { area: obj.area, bake: obj.bake }, edits: { pieces: obj.pieces, kits: obj.kits } }), { ok: true, errors: [] });
});

test('validate rejects mismatched id, unknown edit keys and unsafe kit URLs', () => {
  rejected({ id: 'other' }, /id/);
  rejected({ fileId: 'other' }, /id/);
  rejected({ obj: { ...obj, area: { id: 'other' } } }, /id/);
  rejected({ id: '../test-area' }, /id/);
  rejected({ id: 'test-area\n', fileId: 'test-area\n', obj: { ...obj, area: { id: 'test-area\n' } } }, /id/);
  rejected({ edits: { area: obj.area } }, /area/);
  rejected({ edits: { kits: { 'TEST\n': 'assets/kits/TEST\n/kit.json' } } }, /URL/);
  for (const url of ['../x', 'assets/kits/../kit.json', '/assets/kits/TEST/kit.json', 'assets/kits/OTHER/kit.json', 'assets/kits/TEST/kit.json?x', 'assets/areas/x/floor-kit.json']) {
    rejected({ edits: { kits: { TEST: url } } }, /URL/);
  }
});

test('validate rejects missing KIT, fractional/outside coordinates, missing piece', () => {
  rejected({ edits: { pieces: [{ k: 'OTHER/base', x: 1, y: 1 }] } }, /KIT/);
  for (const [x, y] of [[1.5, 0], [-1, 0], [0, 81], [101, 0], [0, -1], [0, 1.5], [NaN, 0], [Infinity, 0], ['1', 0]]) {
    rejected({ edits: { pieces: [{ k: 'TEST/base', x, y }] } }, /coordinates/);
  }
  for (const k of ['TEST/missing', 'TEST/toString', 'TEST/__proto__', '/base', 'TEST/', 'base', null]) {
    rejected({ edits: { pieces: [{ k, x: 1, y: 1 }] } });
  }
});

test('shared validateKit checks manifests and pair targets; bad shapes do not throw', () => {
  rejected({ kitsJson: {} }, /Missing kit JSON/);
  rejected({ kitsJson: { TEST: { ...kit, kit: 'OTHER' } } }, /Invalid kit/);
  const broken = structuredClone(kit);
  broken.pieces.base.pair = 'absent';
  rejected({ kitsJson: { TEST: broken } }, /Invalid roof pair/);
  const brokenCollision = structuredClone(kit);
  brokenCollision.pieces.base.collide = [[0, 0, -1, 5]];
  rejected({ kitsJson: { TEST: brokenCollision } }, /Invalid piece/);
  for (const edits of [null, [], { pieces: null }, { pieces: {} }, { pieces: [null] }, { kits: null }, { kits: [] }, { kits: {} }]) rejected({ edits });
  rejected({ obj: { ...obj, bake: { width: -1, height: 80 } } });
});

test('all real kit manifests used by valid URLs load through shared validator', () => {
  const kitsJson = {};
  for (const dir of readdirSync(new URL('../../public/assets/kits/', import.meta.url), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const url = new URL(`../../public/assets/kits/${dir.name}/kit.json`, import.meta.url);
    try { kitsJson[dir.name] = JSON.parse(readFileSync(url, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let valid = 0, legacy = 0;
  for (const [file, text] of sources) {
    const obj = JSON.parse(text), id = file.slice(0, -'.src.json'.length);
    const result = validateEdit({ id, fileId: id, obj, edits: {}, kitsJson });
    const invalidUrls = Object.entries(obj.kits ?? {}).filter(([key, url]) => url !== `assets/kits/${key}/kit.json`);
    if (invalidUrls.length) {
      assert.equal(result.ok, false);
      for (const [key] of invalidUrls) assert(result.errors.includes(`Invalid kit URL for ${key}`));
      legacy += invalidUrls.length;
    } else { assert.deepEqual(result, { ok: true, errors: [] }); valid++; }
  }
  console.log(`REAL VALIDATION ${valid}/${sources.size} accepted; ${legacy} legacy URL(s) rejected per R3`);
});

test('real source files remained byte-identical on disk', () => {
  for (const [file, text] of sources) {
    assert.deepEqual(readFileSync(new URL(file, sourceDir)), Buffer.from(text, 'utf8'), fileURLToPath(new URL(file, sourceDir)));
  }
});

console.log(`REAL SOURCES ${sources.size} (brief expected 5; checkout contains ${sources.size})`);
console.log(`SRCIO PASS (${checks} test groups)`);
