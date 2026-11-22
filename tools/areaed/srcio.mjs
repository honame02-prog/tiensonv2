import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validateKit, resolveKitPieces } from '../../src/areaKits.js';

const own = (obj, key) => Object.hasOwn(obj, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) && !/[\r\n]/.test(value);

export function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// Offsets are JS string offsets (end exclusive), suitable for text.slice().
// JSON.parse checks grammar first; this scanner only locates complete tokens.
function scanRoot(text) {
  const obj = JSON.parse(text);
  if (!record(obj)) throw new TypeError('Source must be a JSON object');
  let pos = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[pos] ?? '\0')) pos++; };
  const string = () => {
    pos++;
    while (text[pos] !== '"') {
      if (text[pos] === '\\') pos++;
      pos++;
    }
    pos++;
  };
  const value = () => {
    if (text[pos] === '"') return string();
    if (text[pos] === '[' || text[pos] === '{') {
      const close = text[pos++] === '[' ? ']' : '}';
      whitespace();
      while (text[pos] !== close) {
        if (text[pos] === ',' || text[pos] === ':') pos++;
        else value();
        whitespace();
      }
      pos++;
    } else {
      while (pos < text.length && !/[\x20\t\r\n,}\]]/.test(text[pos])) pos++;
    }
  };
  whitespace();
  const open = pos++;
  const members = [], spans = Object.create(null);
  whitespace();
  while (text[pos] !== '}') {
    const keyStart = pos;
    string();
    const keyEnd = pos, key = JSON.parse(text.slice(keyStart, keyEnd));
    whitespace();
    pos++; // colon
    whitespace();
    const start = pos;
    value();
    const end = pos;
    members.push({ key, keyStart, keyEnd, start, end });
    spans[key] = { start, end };
    whitespace();
    if (text[pos] === ',') { pos++; whitespace(); }
  }
  return { obj, spans, members, open, close: pos };
}

export function parseSrc(text) {
  const { obj, spans } = scanRoot(text);
  return { obj, spans };
}

function styleOf(text, root) {
  const prefixes = root.members.map((m, i) => text.slice(i ? root.members[i - 1].end : root.open + 1, m.keyStart));
  const linePrefix = prefixes.find(s => /[\r\n]/.test(s));
  const multiline = linePrefix !== undefined || (!root.members.length && /[\r\n]/.test(text.slice(root.open + 1, root.close)));
  const indent = linePrefix?.match(/(?:\r\n|\n|\r)([\t ]*)$/)?.[1] ?? '  ';
  const newline = text.match(/\r\n|\n|\r/)?.[0] ?? '\n';
  const first = root.members[0];
  const colon = first ? text.slice(first.keyEnd, first.start) : (multiline ? ': ' : ':');
  return { multiline, indent, newline, colon };
}

function serialize(key, value, style) {
  // Keep each placement compact, including the caller's property order.
  const json = JSON.stringify(value, null, key === 'pieces' || !style.multiline ? undefined : style.indent);
  if (json === undefined) throw new TypeError(`Cannot serialize ${key}`);
  return style.multiline ? json.replace(/\n/g, style.newline + style.indent) : json;
}

export function spliceTopLevel(text, edits) {
  if (!record(edits)) throw new TypeError('edits must be an object');
  const root = scanRoot(text), style = styleOf(text, root), patches = [];
  const deleted = member => own(edits, member.key) && edits[member.key] === undefined;
  // Delete consecutive runs together so commas remain valid for every position.
  for (let i = 0; i < root.members.length; i++) {
    const member = root.members[i];
    if (deleted(member)) {
      const first = i;
      while (i + 1 < root.members.length && deleted(root.members[i + 1])) i++;
      const next = root.members[i + 1];
      patches.push({ start: next || first === 0 ? root.members[first].keyStart : root.members[first - 1].end,
        end: next ? next.keyStart : root.members[i].end, text: '' });
    } else if (own(edits, member.key)) {
      const oldValue = JSON.parse(text.slice(member.start, member.end));
      if (!isDeepStrictEqual(oldValue, edits[member.key])) {
        patches.push({ start: member.start, end: member.end, text: serialize(member.key, edits[member.key], style) });
      }
    }
  }
  for (const patch of patches.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, patch.start) + patch.text + text.slice(patch.end);
  }
  const added = Object.keys(edits).filter(key => !own(root.spans, key) && edits[key] !== undefined);
  if (added.length) {
    const after = scanRoot(text), last = after.members.at(-1);
    const separator = style.multiline ? style.newline + style.indent : '';
    const fields = added.map(key => JSON.stringify(key) + style.colon + serialize(key, edits[key], style)).join(',' + separator);
    const at = last ? last.end : after.open + 1;
    const insert = (last ? ',' : '') + separator + fields;
    // Preserve all existing closing whitespace, including the final file LF.
    const closing = !last && style.multiline && !/[\r\n]/.test(text.slice(at, after.close)) ? style.newline : '';
    text = text.slice(0, at) + insert + closing + text.slice(at);
  }
  return text;
}

export function editableView(obj) {
  return { id: obj.area?.id, width: obj.bake?.width, height: obj.bake?.height,
    kits: obj.kits ?? obj.area?.kits ?? {}, pieces: obj.pieces ?? obj.area?.pieces ?? [] };
}

export function validateEdit({ id, fileId, obj, edits, kitsJson }) {
  const errors = [];
  if (!validId(id) || id !== fileId || obj?.area?.id !== fileId) {
    errors.push('id and area.id must match fileId');
  }
  if (!record(obj)) errors.push('Source must be an object');
  if (!record(edits)) errors.push('edits must be an object');
  if (errors.length) return { ok: false, errors };
  for (const key of Object.keys(edits)) if (!['pieces', 'kits'].includes(key)) errors.push(`Editing ${key} is not allowed`);
  const candidate = { ...obj };
  for (const key of ['pieces', 'kits']) if (own(edits, key)) {
    if (edits[key] === undefined) delete candidate[key];
    else candidate[key] = edits[key];
  }
  const { width, height, kits, pieces } = editableView(candidate);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0) errors.push('Invalid bake dimensions');
  if (!record(kits)) errors.push('kits must be an object');
  if (!Array.isArray(pieces)) errors.push('pieces must be an array');
  // Null is invalid input, rather than an instruction to use legacy area fields.
  for (const key of ['kits', 'pieces']) if (own(candidate, key) && candidate[key] === null) errors.push(`${key} cannot be null`);
  const loaded = Object.create(null);
  if (record(kits)) for (const [kit, url] of Object.entries(kits)) {
    // New kits must use the standard path; a kit already on disk with the same URL is kept as-is if it stays under public/assets/.
    const kept = record(obj.kits) && obj.kits[kit] === url && typeof url === 'string' && /^assets\/[A-Za-z0-9_\/-]+\.json$/.test(url) && !url.includes('..');
    if (!validId(kit) || (!kept && url !== `assets/kits/${kit}/kit.json`)) {
      errors.push(`Invalid kit URL for ${kit}`);
      continue;
    }
    try {
      if (!record(kitsJson) || !own(kitsJson, kit)) throw new Error(`Missing kit JSON ${kit}`);
      loaded[kit] = validateKit(kit, kitsJson[kit]);
    } catch (error) { errors.push(error.message); }
  }
  if (Array.isArray(pieces)) pieces.forEach((piece, index) => {
    if (!record(piece)) { errors.push(`Invalid placement ${index}`); return; }
    const match = typeof piece.k === 'string' && /^([A-Za-z0-9_-]+)\/(.+)$/.exec(piece.k);
    if (!match || !record(kits) || !own(kits, match[1])) errors.push(`Unknown KIT in placement ${index}`);
    else if (!loaded[match[1]] || !own(loaded[match[1]].pieces, match[2])) errors.push(`Unknown kit piece ${piece.k}`);
    // Existing sources hold fractional anchors (e.g. y 827.2) and pieces overhanging the edge; accept finite numbers within 1024 px of the area.
    const M = 1024, inRange = (v, max) => typeof v === 'number' && Number.isFinite(v) && v >= -M && v <= max + M;
    if (!inRange(piece.x, width) || !inRange(piece.y, height)) errors.push(`Invalid coordinates in placement ${index}`);
  });
  if (!errors.length) {
    try { resolveKitPieces({ kits, pieces }, loaded); }
    catch (error) { errors.push(error.message); }
  }
  return { ok: errors.length === 0, errors };
}
