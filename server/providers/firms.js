import path from 'node:path';
import { promises as fsp } from 'node:fs';
import fs from 'node:fs';

import { filterTrailing24h, parseFirmsCsv } from '../../src/data/firmsCsv.js';
import KDBush from 'kdbush';

let _kdTree = null;
function getIndustryTree() {
  if (_kdTree) return _kdTree;
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), 'industrydataosm.csv'), 'utf8');
    const lines = txt.split('\n');
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].split('\t').length >= 2) count++;
    }
    _kdTree = new KDBush(count);
    for (let i = 1; i < lines.length; i++) {
      
      const parts = lines[i].split('\t');
      if (parts.length >= 2) {
         _kdTree.add(parseFloat(parts[1]), parseFloat(parts[0])); // lon, lat
      }
    }

    _kdTree.finish();
  } catch(e) { console.error("KDBUSH ERROR:", e);
    _kdTree = new KDBush(0);
    _kdTree.finish();
  }
  return _kdTree;
}

// Load persistent hotspots from 6-month archive analysis.
// Key format: "lat:lon" at 0.1-degree grid. Value: distinct months with fire.
// LOGIC: Agricultural fires burn for days. If the same location appears across
// 2+ different months in our 6-month archive, it's a permanent industrial source.
let _persistentHotspots = null;
function getPersistentHotspots() {
  if (_persistentHotspots) return _persistentHotspots;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'persistent_hotspots.json'), 'utf8');
    _persistentHotspots = JSON.parse(raw);
    console.log('[FIRMS] Archive hotspots loaded:', Object.keys(_persistentHotspots).length);
  } catch(e) {
    console.error('[FIRMS] Could not load persistent_hotspots.json:', e.message);
    _persistentHotspots = {};
  }
  return _persistentHotspots;
}

function classifyFire(lon, lat, frp, bright) {
   lon = parseFloat(lon);
   lat = parseFloat(lat);
   frp = parseFloat(frp);
   bright = parseFloat(bright);

   // STEP 1: EXTREME FRP = BLAST / INDUSTRIAL ACCIDENT (global)
   if (frp > 500) return 'blast';

   // We only have OSM industry data and 6-month archive for India.
   // Applying those to Africa/SE Asia would wrongly turn seasonal
   // agricultural burns purple. Keep India logic fully separate.
   const isIndia = lat >= 8 && lat <= 37 && lon >= 68 && lon <= 98;

   if (isIndia) {
     const hotspots = getPersistentHotspots();
     const GRID = 0.1;
     const latCell = (Math.round(lat / GRID) * GRID).toFixed(1);
     const lonCell = (Math.round(lon / GRID) * GRID).toFixed(1);
     const monthsActive = hotspots[`${latCell}:${lonCell}`] || 0;

     // 5+ months active = fires nearly every month year-round.
     // India's two crop cycles (Oct-Nov paddy, Apr-May wheat) produce at most
     // 2 months of recurring agricultural fires in the same location.
     // 5 months = permanent industrial / thermal source, not seasonal crops.
     if (monthsActive >= 5) {
       if (bright > 350) return 'flare';
       return 'persistent';
     }

     // OSM INDUSTRY: Tightened from 2km to 500m (~0.0045 degrees).
     // Factory centroid points represent the building/stack, not a 2km zone.
     // 500m avoids false-alarming on open fields adjacent to factories.
     const tree = getIndustryTree();
     const nearFactory500m = tree.within(lon, lat, 0.0045).length > 0;

     // Near known factory AND seen in archive on 2+ separate months = confirmed
     if (nearFactory500m && monthsActive >= 2) return 'persistent';

     // Very hot near a factory = gas flare or brick kiln stack
     // (Punjab brick kilns regularly reach 360-400K brightness)
     if (nearFactory500m && bright > 340) return 'flare';

     // 4 months is more than two crop cycles — industrial.
     if (monthsActive >= 4) {
       if (bright > 340) return 'flare';
       return 'persistent';
     }

     // OFFSHORE INDIA: Bombay High (Arabian Sea) and KG Basin (Bay of Bengal)
     const isOffshoreIndia =
       (lon >= 70 && lon <= 73 && lat >= 18.5 && lat <= 21.5) ||
       (lon >= 80 && lon <= 82 && lat >= 15 && lat <= 17.5);
     if (isOffshoreIndia) return 'persistent';

     // WILDFIRE (India): Not near any industry within 2km, brand-new location
     // (never in archive), moderate FRP. Real wildfires in Uttarakhand,
     // Himachal, Odisha, Chhattisgarh forests.
     const nearIndustry2k = tree.within(lon, lat, 0.018).length > 0;
     if (!nearIndustry2k && monthsActive === 0 && frp > 8) return 'wildfire';

     return 'agri';
   }

   // NON-INDIA (Africa, SE Asia, Middle East, Europe, Americas)
   // No industry or archive data for these regions. Physics-only heuristics:
   // brightness and FRP reveal the fire's nature.
   // Africa: mostly seasonal controlled agricultural burns (low FRP, low brightness).
   // Nigeria/Middle East oil fields: extremely bright + high FRP gas flares.

   if (bright > 420 && frp > 80) return 'flare';   // Oil field gas flare
   if (frp > 25) return 'wildfire';                 // Intense open fire (savannah, forest)
   return 'agri';                                    // Default: agricultural/controlled burn
}


/**
 * NASA FIRMS live active-fire proxy with a memory + disk cache.
 * Upstream: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/world/2
 *
 * Merges three VIIRS NRT sources (NOAA-20, NOAA-21, Suomi-NPP — independent
 * satellites, no cross-source dedup) fetched sequentially with `days=2`
 * (`days=1` means "current UTC day", nearly empty just after 00:00Z) and
 * clamps to the trailing 24 h via src/data/firmsCsv.js. FIRMS quota is
 * 5,000 transactions / 10 min per MAP_KEY, so the cache is the point:
 * TTL 30 min, single-flight refresh, serve-stale-on-failure, and a
 * fresh-enough disk cache (.gev-cache/firms.json) prevents ANY upstream
 * fetch across dev-server restarts. Pattern mirrors celestrakProxy.
 *
 * Routes:
 *   GET /api/firms        → {fetchedAt, stale, ttlMs, sources, count, fires}
 *   GET /api/firms/status → {hasKey, lastFetch, count, stale, ttlMs, transactions}
 *
 * Keyless (no FIRMS_MAP_KEY): /api/firms → 503 {error:'no_key'}; status →
 * {hasKey:false}. Upstream is never touched without a key.
 *
 * @returns {import('vite').Plugin}
 */
export function firmsProxy() {
  const TTL_MS = 30 * 60_000;
  const STATUS_TTL_MS = 5 * 60_000;
  const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT'];
  const CACHE_DIR = path.join(process.cwd(), '.gev-cache');
  const CACHE_PATH = path.join(CACHE_DIR, 'firms.json');

  /** @type {?{at: number, sources: Array<object>, fires: Array<object>}} */
  let mem = null;
  let diskChecked = false;
  /** @type {?Promise<?{at: number, sources: Array<object>, fires: Array<object>}>} single-flight refresh */
  let inflight = null;
  /** @type {?{at: number, transactions: ?{used: number, limit: number}}} mapkey_status cache */
  let statusCache = null;
  /** @type {?Promise<?{used: number, limit: number}>} */
  let statusInflight = null;

  const mapKey = () => String(process.env.FIRMS_MAP_KEY || '').trim();

  async function readDiskOnce() {
    if (diskChecked) return;
    diskChecked = true;
    try {
      const parsed = JSON.parse(await fsp.readFile(CACHE_PATH, 'utf8'));
      if (
        Number.isFinite(parsed?.at) &&
        Array.isArray(parsed?.sources) &&
        Array.isArray(parsed?.fires)
      ) {
        mem = parsed;
      }
    } catch {
      /* no disk cache yet */
    }
  }

  async function writeDisk(entry) {
    try {
      await fsp.mkdir(CACHE_DIR, { recursive: true });
      await fsp.writeFile(CACHE_PATH, JSON.stringify(entry), 'utf8');
    } catch (err) {
      console.warn('[firms-proxy] cache write failed:', err?.message || err);
    }
  }

  /**
   * Fetch + parse one FIRMS source. Throws on HTTP error or a non-CSV body
   * (FIRMS reports errors as HTML/plain text, never CSV). Never log the URL —
   * it embeds the MAP_KEY.
   */
  async function fetchSource(key, source) {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/world/2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const records = parseFirmsCsv(await res.text());
    if (records === null) throw new Error('non-CSV upstream response');
    return records;
  }

  /**
   * Refresh all sources sequentially (quota courtesy — never in parallel).
   * Partial success (≥1 source ok) still produces a cacheable entry with the
   * failed sources marked ok:false; total failure throws so the caller can
   * serve stale.
   */
  async function refreshUpstream(key) {
    const now = Date.now();
    const sources = [];
    const fires = [];
    for (const source of SOURCES) {
      try {
        const records = filterTrailing24h(await fetchSource(key, source), now);
        // NOT fires.push(...records): spread passes each record as an argument,
        // and a world/2 VIIRS pull exceeds V8's argument limit (~125k) at
        // ~131k records — RangeError, and the whole source is silently dropped.
        for (const record of records) {
          record.ml_class = classifyFire(record.lon, record.lat, record.frp, record.brightness);
          fires.push(record);
        }
        sources.push({ source, count: records.length, ok: true });
      } catch (err) {
        console.warn(
          `[firms-proxy] ${source} fetch failed:`,
          err?.message || err,
        );
        sources.push({ source, count: 0, ok: false });
      }
    }
    if (!sources.some((s) => s.ok)) throw new Error('all FIRMS sources failed');
    return { at: now, sources, fires };
  }

  /**
   * Cache entry → response payload. Fires are RE-filtered to the trailing
   * 24 h at serve time so a stale cache never serves >24h-old detections.
   */
  function buildPayload(entry, stale) {
    const fires = filterTrailing24h(entry.fires, Date.now());
    return {
      fetchedAt: entry.at,
      stale,
      ttlMs: TTL_MS,
      sources: entry.sources,
      count: fires.length,
      fires,
    };
  }

  /** mapkey_status transactions, cached 5 min, best-effort (null on failure). */
  function getTransactions(key) {
    const now = Date.now();
    if (statusCache && now - statusCache.at < STATUS_TTL_MS) {
      return Promise.resolve(statusCache.transactions);
    }
    if (!statusInflight) {
      statusInflight = (async () => {
        try {
          const url = `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${encodeURIComponent(key)}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = await res.json();
          const used = Number(body?.current_transactions);
          const limit = Number(body?.transaction_limit);
          return Number.isFinite(used) && Number.isFinite(limit)
            ? { used, limit }
            : null;
        } catch (err) {
          console.warn(
            '[firms-proxy] mapkey status failed:',
            err?.message || err,
          );
          return null;
        }
      })()
        .then((transactions) => {
          statusCache = { at: Date.now(), transactions };
          return transactions;
        })
        .finally(() => {
          statusInflight = null;
        });
    }
    return statusInflight;
  }

  const installMiddleware = (server) => {
    server.middlewares.use('/api/firms', async (req, res) => {
      const sendJson = (status, obj) => {
        if (res.headersSent) return;
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(obj));
      };
      try {
        const subPath = String(req.url || '').split('?')[0];
        const key = mapKey();
        await readDiskOnce();

        if (subPath === '/status') {
          if (!key) {
            sendJson(200, {
              hasKey: false,
              lastFetch: null,
              count: null,
              stale: false,
              ttlMs: TTL_MS,
              transactions: null,
            });
            return;
          }
          const transactions = await getTransactions(key);
          sendJson(200, {
            hasKey: true,
            lastFetch: mem ? mem.at : null,
            count: mem ? mem.fires.length : null,
            stale: mem ? Date.now() - mem.at >= TTL_MS : false,
            ttlMs: TTL_MS,
            transactions,
          });
          return;
        }

        if (!key) {
          sendJson(503, { error: 'no_key' });
          return;
        }

        const entry = mem;
        if (entry && Date.now() - entry.at < TTL_MS) {
          sendJson(200, buildPayload(entry, false));
          return;
        }
        // Stale or missing → refresh, single-flight (concurrent requests
        // share one upstream pass). Capture the promise locally BEFORE
        // awaiting: the .finally() nulls `inflight` the moment it settles.
        if (!inflight) {
          inflight = refreshUpstream(key)
            .then(async (fresh) => {
              mem = fresh;
              await writeDisk(fresh);
              return fresh;
            })
            .catch((err) => {
              console.warn(
                `[firms-proxy] refresh failed (${err?.message || err}) — serving cache if any`,
              );
              return null;
            })
            .finally(() => {
              inflight = null;
            });
        }
        const pending = inflight;
        const fresh = await pending;
        if (fresh) {
          sendJson(200, buildPayload(fresh, false));
        } else if (entry) {
          sendJson(200, buildPayload(entry, true)); // upstream down — stale beats empty
        } else {
          sendJson(502, {
            error: 'firms fetch failed and no cache available',
          });
        }
      } catch (err) {
        console.warn('[firms-proxy] error:', err?.message || err);
        sendJson(500, { error: 'firms proxy error' });
      }
    });
  };
  return {
    name: 'firms-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
