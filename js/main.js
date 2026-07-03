// Entrypoint. Imports map.js first (which constructs the singleton Leaflet
// `map` and exports it), then pulls in the feature modules for their side
// effects. The single visible export is the `window.__parcel` test hook,
// gated behind `?test=1` so production page loads don't expose internals.

import { map } from './map.js';
import { inspectPoint } from './lookups.js';
import './overlays.js';
import './search.js';
import './draw.js';
import './ui.js';
import './flyout.js';
import './info-icon.js';
import { admin } from './admin.js';
import { parcels } from './parcels.js';
import { exportApi } from './export.js';
import { openFlyout, closeFlyout, isFlyoutOpen, setFlyoutTitle } from './flyout.js';
import { savedPlaces } from './saved-places.js';
import './save-place.js';
import { savePlaceApi } from './save-place.js';
import { myPlaces } from './my-places.js';
import { coverageApi } from './coverage.js';
import { soilColoringApi } from './soil-coloring.js';
import { protectedLands } from './protected-lands.js';
import { demographicsApi } from './demographics.js';
import { sheetApi } from './sheet.js';

if (new URLSearchParams(location.search).has('test')) {
  window.__parcel = {
    map, inspectPoint, admin, parcels, export: exportApi, savedPlaces, myPlaces,
    coverage: coverageApi, soilColoring: soilColoringApi,
    flyout: { open: openFlyout, close: closeFlyout, isOpen: isFlyoutOpen, setTitle: setFlyoutTitle },
    savePlace: savePlaceApi,
    protectedLands,
    demographics: demographicsApi,
    sheet: sheetApi
  };
}
