const registry = new Map();
/** Returns an Image immediately, but disc groups fetch only when requested. */
export function loadImage(url, { group = 'core' } = {}) {
  let entry = registry.get(url);
  if (!entry) { entry = { image: new Image(), url, groups: new Set(), promise: null, ready: false }; registry.set(url, entry); }
  entry.groups.add(group);
  if (group === 'core') start(entry).catch(() => {});
  return entry.image;
}
function start(entry) {
  if (entry.ready) return Promise.resolve();
  if (entry.promise) return entry.promise;
  entry.promise = new Promise((resolve, reject) => {
    const img = entry.image;
    const timeout = setTimeout(() => finish(new Error('Image timed out: ' + entry.url)), 15000);
    const finish = (error) => {
      clearTimeout(timeout); img.onload = img.onerror = null;
      if (error) { entry.promise = null; reject(error); } else { entry.ready = true; resolve(); }
    };
    img.onload = async () => { try { if (img.decode) await img.decode(); finish(); } catch { finish(new Error('Image could not decode: ' + entry.url)); } };
    img.onerror = () => finish(new Error('Image could not load: ' + entry.url));
    img.src = entry.url;
  });
  return entry.promise;
}
export async function preloadGroup(group, onProgress = () => {}) {
  const entries = [...registry.values()].filter(e => e.groups.has(group));
  let loaded = 0;
  onProgress(loaded, entries.length);
  const results = await Promise.allSettled(entries.map(async entry => { await start(entry); onProgress(++loaded, entries.length); }));
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length) throw new Error(`${failures.length} image(s) could not load. Check the connection and retry.`);
}
