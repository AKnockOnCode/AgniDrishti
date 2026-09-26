const CONTROL_LAYER_IDS = Object.freeze({
  trafficLayer: 'traffic',
  flightsLayer: 'flights',
  militaryFlightsLayer: 'military',
  satellitesLayer: 'satellites',
  cctvLayer: 'cctv',
  radioLayer: 'radio',
  bikeshareLayer: 'bikeshare',
  transitLayer: 'transit',
  aisLiveVesselsLayer: 'ais-live-vessels',
  militaryAwarenessLayer: 'military-awareness',
  militaryInstallationsLayer: 'military-installations',
  rocketLaunchesLayer: 'rocket-launches',
  // and ours
  weatherRadarLayer: 'weather-radar',
  weatherSatelliteLayer: 'weather-satellite',
  weatherLightningLayer: 'weather-lightning',
  windLayer: 'wind',
  firmsLayer: 'local-firms'
});

export function createLayerCatalog(layers, metadata) {
  if (!Array.isArray(layers) || !Array.isArray(metadata))
    throw new TypeError('Layer instances and serialization metadata are required');
  const byId = new Map();
  for (const layer of layers) {
    if (typeof layer?.id !== 'string' || !layer.id || byId.has(layer.id))
      throw new TypeError(`Invalid or duplicate catalog layer: ${layer?.id}`);
    byId.set(layer.id, layer);
  }
  return Object.freeze({
    layers: Object.freeze([...layers]),
    metadata: Object.freeze(metadata.map(entry => Object.freeze({ ...entry }))),
    get: (id) => byId.get(id),
  });
}

const dummyLayer = {
  getUIState: () => ({}),
  getTrackedInfo: () => null,
  on: () => {},
  off: () => {}
};

export function catalogControlServices(catalog) {
  if (!catalog?.get) throw new TypeError('An application layer catalog is required');
  const entries = [];
  for (const [role, id] of Object.entries(CONTROL_LAYER_IDS)) {
    let layer = catalog.get(id);
    if (!layer) layer = dummyLayer; 
    entries.push([role, layer]);
  }
  return Object.fromEntries(entries);
}
