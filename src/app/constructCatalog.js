import { createWeatherClock } from '../layers/weather/clock.js';
import { createWeatherLayer } from '../layers/weather/index.js';
import { createWindLayer } from '../layers/wind/index.js';
import { createLayerCatalog } from './catalog.js';
import { LAYER_STATE_REGISTRY } from '../data/layerState.js';
import { createApplicationFirms } from './layers/firms.js';
import { createApplicationInstallations } from './layers/militaryInstallations.js';

const SOURCE_METHODS = Object.freeze({
  firms: ['getSnapshot'],
  wind: ['getSnapshot'],
  weather: ['getSnapshot'],
  installations: ['getMappedSites', 'searchNearby'],
});

/** Construct the current catalog without choosing any source provider. */
export function createApplicationCatalog({
  surface,
  sources,
  signal,
  metadata = LAYER_STATE_REGISTRY,
}) {
  if (!signal?.addEventListener)
    throw new TypeError('An application lifetime signal is required');
  signal.throwIfAborted();
  if (!surface?.groundFloor || !surface?.terrain)
    throw new TypeError('Application surface services are required');

  for (const [name, methods] of Object.entries(SOURCE_METHODS)) {
    if (
      methods.some((method) => typeof sources?.[name]?.[method] !== 'function')
    )
      throw new TypeError(`Invalid catalog source: ${name}`);
  }
  const weatherClock = createWeatherClock();
  const dispose = () => {
    signal.removeEventListener('abort', dispose);
    weatherClock.destroy();
  };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const catalog = createLayerCatalog(
      [
        createApplicationInstallations({
          surface,
          source: sources.installations,
        }),
        createWindLayer({ feed: sources.wind, clock: weatherClock }),
        createWeatherLayer({
          feed: sources.weather,
          id: 'weather-radar',
          clock: weatherClock,
        }),
        createWeatherLayer({
          feed: sources.weather,
          id: 'weather-satellite',
          clock: weatherClock,
        }),
        createWeatherLayer({
          feed: sources.weather,
          id: 'weather-lightning',
          clock: weatherClock,
        }),
        createApplicationFirms({
          surface,
          id: 'local-firms',
          name: 'NASA FIRMS Active Fires',
          icon: '🔥',
          source: 'NASA FIRMS',
          feed: sources.firms,
        }),
      ],
      metadata,
    );
    return Object.freeze({
      ...catalog,
      surface,
      weatherClock,
    });
  } catch (error) {
    dispose();
    throw error;
  }
}
