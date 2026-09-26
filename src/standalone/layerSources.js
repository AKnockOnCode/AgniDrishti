import { createWeatherSource } from '../layers/weather/source.js';
import { createWindSource } from '../layers/wind/source.js';
import { createFirmsSource } from '../layers/firms/source.js';
import { createInstallationSource } from '../layers/installations/source.js';
import { createReferenceSources } from '../sources/reference.js';
export { createReferenceSources as createStandaloneReferenceSources } from '../sources/reference.js';

/** Select standalone providers without starting their acquisition. */
export function createStandaloneLayerSources() {
  return {
    ...createReferenceSources(),
    firms: createFirmsSource(),
    wind: createWindSource(),
    weather: createWeatherSource(),
    installations: createInstallationSource(),
  };
}
