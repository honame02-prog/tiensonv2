// Gom moi cue *.json trong thu muc nay thanh bang id -> cue (Vite import.meta.glob).
const mods = import.meta.glob(['./*.json', '!./*.old.json'], { eager: true });
export const CUES = Object.fromEntries(Object.values(mods).map(m => [m.default.id, m.default]));
