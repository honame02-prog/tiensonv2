// Dinh dang area.json gon: moi truong 1 dong, hang col / phan tu props, objs 1 dong moi cai (de diff).
export function formatArea(a) {
  const keys = Object.keys(a), parts = [];
  for (const k of keys) {
    const v = a[k];
    if (Array.isArray(v) && v.length && (Array.isArray(v[0]) || typeof v[0] === 'object')) parts.push(` ${JSON.stringify(k)}: [\n  ${v.map(x => JSON.stringify(x)).join(',\n  ')}\n ]`);
    else if (v && typeof v === 'object' && !Array.isArray(v) && ['texts', 'spawns', 'features'].includes(k)) parts.push(` ${JSON.stringify(k)}: {\n  ${Object.entries(v).map(([kk, vv]) => `${JSON.stringify(kk)}: ${JSON.stringify(vv)}`).join(',\n  ')}\n }`);
    else parts.push(` ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  }
  return '{\n' + parts.join(',\n') + '\n}\n';
}
