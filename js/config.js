// Central configuration: external endpoints, basemap + overlay definitions,
// zoom hints, the PARCEL_COUNTIES registry, and admin-boundary URLs. Anything
// the app talks to over the network has its URL here, not inline in feature
// modules. Add new data sources or counties here — runtime wiring picks them
// up by key without code changes elsewhere.

export const MAP_INIT = {
  center: [39.8283, -98.5795],
  zoom: 5
};

export const BASEMAPS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: 'Esri World Imagery', maxZoom: 19 },
    labels: true
  },
  topo: {
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: 'USGS National Map', maxZoom: 16 },
    labels: false
  },
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    // crossOrigin: 'anonymous' lets leaflet-image capture the canvas without
    // CORS taint — CARTO Voyager responds with Access-Control-Allow-Origin: *.
    options: { attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19, crossOrigin: 'anonymous' },
    labels: false
  },
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: 'Esri Terrain', maxZoom: 13 },
    labels: true
  }
};

export const DEFAULT_BASEMAP = 'satellite';

export const LABEL_LAYER = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png',
  options: {
    attribution: '© OpenStreetMap © CARTO labels',
    subdomains: 'abcd',
    maxZoom: 19,
    pane: 'labels'
  }
};

export const OVERLAYS = {
  flood: {
    type: 'esri-export',
    restUrl: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    layerIds: [28],
    opacity: 0.55,
    attribution: 'FEMA NFHL'
  },
  wetlands: {
    type: 'esri-export',
    restUrl: 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer',
    layerIds: [0],
    opacity: 0.65,
    attribution: 'USFWS NWI'
  },
  contours: {
    type: 'esri-export',
    restUrl: 'https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer',
    layerIds: null,
    opacity: 0.75,
    attribution: 'USGS 3DEP Contours'
  },
  soil: {
    type: 'xyz',
    url: 'https://casoilresource.lawr.ucdavis.edu/cgi-bin/mapserv?map=/data1/website/gmap/mapunit_wms.map&layers=ssurgo&layers=ssa&mode=tile&tilemode=gmap&tile={x}+{y}+{z}&label=musym',
    options: {
      opacity: 0.6,
      attribution: 'USDA NRCS SSURGO via UC Davis SoilWeb',
      maxZoom: 19,
      minZoom: 9
    }
  }
};

export const ZOOM_HINTS = {
  wetlands: { min: 11, msg: 'Wetlands render at zoom 11+. Zoom in to see data.' },
  contours: { min: 13, msg: 'Contours render at zoom 13+. Zoom in to see lines.' },
  soil: { min: 11, msg: 'Soil polygons render at higher zoom levels. Zoom in.' }
};

export const FEMA_FLOOD_QUERY_URL =
  'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';

export const USGS_EPQS_URL = 'https://epqs.nationalmap.gov/v1/json';

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
export const RECENT_SEARCHES_KEY = 'parcel.recentSearches';
export const RECENT_SEARCHES_MAX = 5;

export const SDA_URL = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest';

// US Census ACS demographics — lazy-loaded via the fly-out's collapsed
// Demographics section. Two-step lookup:
//   1. TIGERweb Census Tracts: returns the GEOID + STATE/COUNTY/TRACT for the
//      point. WAF tolerates this query because we set returnGeometry=false.
//   2. Census ACS 5-year API: keyed by state/county/tract, returns the metric
//      variables we render. CORS-friendly (returns Access-Control-Allow-Origin: *).
// Layer 0 in TIGERweb/Tracts_Blocks/MapServer is the current-vintage Census
// Tracts layer. TIGERweb DOES reshuffle layer order — the 2026-06-12 health
// audit caught the original index 3 turning into the "ACS 2025" group layer
// (queries 400 with "Invalid or missing input parameters"). If this breaks
// again, hit `${TIGERWEB_TRACTS_URL.replace(/\/\d+$/, '')}?f=json` to find
// the layer literally named "Census Tracts" at the top level (avoid the
// copies nested under per-year ACS group layers — those shift every release).
export const TIGERWEB_TRACTS_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0';
export const CENSUS_ACS_BASE = 'https://api.census.gov/data/2022/acs/acs5';
// 2026-06-12: api.census.gov now 302-redirects keyless requests to a
// "Missing Key" page — the ACS step of the demographics lookup is dead until
// a key is present. Keys are free (https://api.census.gov/data/key_signup.html)
// and are not secrets (rate-limit tokens, fine to ship client-side). Paste
// the key here to re-enable demographics; empty string degrades gracefully
// to "Demographics not available".
export const CENSUS_ACS_KEY = '';

export const HAZARD_FLOOD_ZONES = ['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'];

export const PARCELS_NOTICE =
  'Nationwide parcels require a paid API (Regrid). Check county GIS portals for free data.';

export const PARCELS_MIN_ZOOM = 14;

// USGS PAD-US (Protected Areas Database) — Manager_Type version. Polygon
// FeatureServer. ACAO: * via Esri AGOL hosting. We bbox-query rather than
// cache nationwide (PAD-US is too dense for whole-country fetch).
export const PROTECTED_LANDS_URL = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Manager_Type_PADUS/FeatureServer/0';
export const PROTECTED_LANDS_MIN_ZOOM = 10;

// Helpers for the per-county derive() hooks. Each accepts a list of property
// names to try (in order) and returns a function suitable for plugging into
// a `derive` slot. Defined here so adding a new county with a "sqm → acres"
// or "sum land+improvements" pattern is a one-liner.
const acresFromSqM = (...names) => (props) => {
  for (const n of names) {
    const v = Number(props[n]);
    if (Number.isFinite(v) && v > 0) return v / 4046.8564224;
  }
  return null;
};
const acresFromSqFt = (...names) => (props) => {
  for (const n of names) {
    const v = Number(props[n]);
    if (Number.isFinite(v) && v > 0) return v / 43560;
  }
  return null;
};
const sumValueFields = (...names) => (props) => {
  let total = 0, any = false;
  for (const n of names) {
    const v = Number(props[n]);
    if (Number.isFinite(v) && v > 0) { total += v; any = true; }
  }
  return any ? total : null;
};

// Registry of supported parcel data sources. Each entry is either:
//   - kind: 'rest', url, fieldMap, bbox  → direct ArcGIS query (Map/FeatureServer)
//   - kind: 'regrid'                     → paid Regrid API (TODO)
// fieldMap names a few candidate attribute keys per logical field; the first
// one present in the response is used (tolerant to county-specific schemas).
// bbox is [minLon, minLat, maxLon, maxLat] in WGS84 — used to skip-fetch and
// to surface a coverage toast when the user toggles the layer outside it.
export const PARCEL_COUNTIES = {
  'md-statewide': {
    label: 'Maryland (statewide)',
    state: 'MD',
    region: 'maryland',
    verified: true,
    kind: 'rest',
    url: 'https://mdgeodata.md.gov/imap/rest/services/PlanningCadastre/MD_ParcelBoundaries/MapServer/0',
    bbox: [-79.5, 37.9, -75.0, 39.75],
    // Maryland Real Property Search by account number. Format requires the
    // county code prefix on ACCTID; this URL works for direct account lookup.
    zoningUrl: 'https://sdat.dat.maryland.gov/RealProperty/Pages/default.aspx',
    fieldMap: {
      id:    ['ACCTID', 'POLYID', 'OBJECTID'],
      acres: ['ACRES', 'POLYACRES'],
      owner: ['OWNNAME', 'OWNERNAME', 'OWNADD1'],
      value: ['NFMTTLVL', 'NFMLNDVL']
    }
  },
  'fairfax-va': {
    label: 'Fairfax County, VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // 2026-05-16: the older `Parcels_with_Address_points` service was retired
    // by Fairfax and now returns HTTP 400 "Invalid URL" at every depth. The
    // current public service is `Parcels/FeatureServer/0` under the same
    // org-id, same PIN + Shape__Area schema, so the fieldMap/derive below
    // still applies. (Diagnosed by curl-listing the org's services.)
    url: 'https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/Parcels/FeatureServer/0',
    bbox: [-77.55, 38.58, -77.05, 39.06],
    // Fairfax property database — PARID lookup. Verified URL pattern as of
    // mid-2025; needs spot-check in a browser if it ever stops working.
    zoningUrl: 'https://icare.fairfaxcounty.gov/Search/CommonSearch.aspx?mode=PARID&PARID={PARCEL_ID}',
    // Fairfax's public REST does not expose owner/value; it does expose PIN
    // and Shape__Area (square metres). `derive` runs after the standard
    // fieldMap lookup, so a county can synthesise any logical field.
    fieldMap: {
      id:    ['PIN', 'PARCEL_KEY', 'OBJECTID'],
      acres: [],
      owner: [],
      value: [],
      address: ['STREET_NUM', 'STREET_NAME']
    },
    derive: { acres: acresFromSqM('Shape__Area', 'SHAPE_Area', 'Shape_Area') }
  },
  // The following Virginia counties were added based on documented ArcGIS REST
  // URL patterns rather than live curl-testing (the sandbox can't reach county
  // GIS hosts). They are marked verified: false; runtime auto-promotes them to
  // verified the first time a fetch comes back with valid features. Until then
  // the Coverage modal flags them "Untested — verify in browser".
  'loudoun-va': {
    label: 'Loudoun County, VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // Loudoun publishes parcels through the LOGIS portal at
    // logis.loudoun.gov/gis/rest/services/COL/LandRecords/MapServer/5 (layer
    // name "Parcel Boundaries"). Owner data is not exposed on this layer —
    // the LandRecords MapServer keeps owner names behind the county's CAMA
    // system. Acres come from PA_LEGAL_ACRE; id is the MCPI (Master Cadastral
    // Parcel Identifier). CORS-friendly (echoes Origin in ACAO header).
    url: 'https://logis.loudoun.gov/gis/rest/services/COL/LandRecords/MapServer/5',
    bbox: [-77.92, 38.84, -77.32, 39.32],
    zoningUrl: 'https://realestate.loudoun.gov/property/search/parcel/{PARCEL_ID}',
    fieldMap: {
      id:    ['PA_MCPI', 'OBJECTID'],
      acres: ['PA_LEGAL_ACRE'],
      owner: [],
      value: []
    }
  },
  'prince-william-va': {
    label: 'Prince William County, VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // PWC publishes parcels at gisweb.pwcva.gov (not the previously-guessed
    // gisweb.pwcgov.org which 404s). The GTS/Cadastral MapServer layer 5
    // ("Parcel CAMA Public") has the polygon geometry + GPIN + Acreage. No
    // owner/value exposed publicly. CORS echoes Origin in ACAO header.
    url: 'https://gisweb.pwcva.gov/arcgis/rest/services/GTS/Cadastral/MapServer/5',
    bbox: [-77.65, 38.40, -77.22, 38.94],
    zoningUrl: 'https://www.pwcva.gov/department/real-estate-assessments-office?parcel={PARCEL_ID}',
    fieldMap: {
      id:    ['GPIN', 'TaxMapNumber', 'OBJECTID'],
      acres: ['Acreage'],
      owner: [],
      value: []
    }
  },
  // === Coming Soon: in the registry as planned, not queried at runtime ===
  // These entries surface in the Coverage modal's "Coming soon" section so
  // users know we're aware of the locality, but they are deliberately NOT in
  // ACTIVE_PARCEL_COUNTIES — every URL below has been investigated and
  // either dead-hosted, behind a token, or unfindable via AGOL/county GIS
  // search as of 2026-05-16. The `comingSoon: true` flag plus a `skipReason`
  // give the Coverage modal copy to render.
  'albemarle-va': {
    label: 'Albemarle County, VA',
    state: 'VA',
    region: 'charlottesville',
    comingSoon: true,
    skipReason: 'AGOL search returned no official Albemarle parcels FeatureServer; gisweb.albemarle.org does not respond. Charlottesville-area users get the City layer in the meantime.',
    bbox: [-78.85, 37.74, -78.20, 38.40]
  },
  'spotsylvania-va': {
    label: 'Spotsylvania County, VA',
    state: 'VA',
    region: 'northern-virginia',
    comingSoon: true,
    skipReason: 'gisweb.spotsylvania.va.us does not respond; the SpotsyGIS AGOL org publishes auxiliary layers but no parcels service.',
    bbox: [-77.91, 37.95, -77.50, 38.40]
  },
  'henrico-va': {
    label: 'Henrico County, VA',
    state: 'VA',
    region: 'richmond',
    comingSoon: true,
    skipReason: 'gis.henrico.us still 502 Bad Gateway on 2026-05-16 overnight retry; AGOL surfaces only the 3rd-party wharcgisdeveloper layer (not official). Wait for host recovery.',
    bbox: [-77.65, 37.42, -77.27, 37.78]
  },
  'fauquier-va': {
    label: 'Fauquier County, VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // Fauquier's Vision-CAMA Tax_Parcels_DL is published on AGOL under the
    // oAoeYJ1kqmAwcEC2 org. Rich schema — OWNERNME1, ACREAGE, address parts.
    url: 'https://services.arcgis.com/oAoeYJ1kqmAwcEC2/arcgis/rest/services/Tax_Parcels_DL/FeatureServer/0',
    bbox: [-78.18, 38.49, -77.55, 38.97],
    fieldMap: {
      id:    ['PARCELID', 'VisionPID', 'OBJECTID'],
      acres: ['ACREAGE'],
      owner: ['OWNERNME1', 'CURRENTOWN'],
      value: []
    }
  },
  // Tier 1 Coming-Soon localities investigated but not wired this session:
  'alexandria-city-va': {
    label: 'Alexandria (City), VA',
    state: 'VA',
    region: 'northern-virginia',
    comingSoon: true,
    skipReason: 'gis.alexandriava.gov serves an HTML portal page rather than a REST root; no parcels FeatureServer found via AGOL search.',
    bbox: [-77.16, 38.78, -77.02, 38.85]
  },
  'hanover-va': {
    label: 'Hanover County, VA',
    state: 'VA',
    region: 'richmond',
    verified: true,
    kind: 'rest',
    // Hanover publishes Hanover_Parcels on AGOL under sKZWgJlU6SekCzQV
    // (owner hanovercounty). Very rich schema — OWN_NAME1, LOT_ACRES,
    // LAND_VALUE + IMPROVEMENTS_VALUE separately, ZONING_LIST, school
    // district, deed book/page. derive.value sums land + improvements.
    url: 'https://services2.arcgis.com/sKZWgJlU6SekCzQV/arcgis/rest/services/Hanover_Parcels/FeatureServer/0',
    bbox: [-77.69, 37.61, -77.20, 37.94],
    fieldMap: {
      id:    ['GPIN', 'HISTORICAL_PIN', 'OBJECTID'],
      acres: ['LOT_ACRES'],
      owner: ['OWN_NAME1'],
      value: []
    },
    // Hanover exposes LAND_VALUE + IMPROVEMENTS_VALUE (plural) separately,
    // no pre-summed total field. Leave fieldMap.value empty so derive.value
    // runs and produces the sum — listing LAND_VALUE in fieldMap.value would
    // make pickField return land-only and skip the derive (the bug fixed
    // here on 2026-05-17).
    derive: { value: sumValueFields('LAND_VALUE', 'IMPROVEMENTS_VALUE') }
  },
  'new-kent-va': {
    label: 'New Kent County, VA',
    state: 'VA',
    region: 'richmond',
    verified: true,
    kind: 'rest',
    // New Kent publishes Parcels_Vision on AGOL under wRTEaR3VIVeAhJdr
    // (owner MatthewTForbes, county-level). Rich schema: OWN_NAME1,
    // PRC_TTL_LND_AREA_ACRES, GPIN, TAXMAPID. CORS friendly.
    url: 'https://services2.arcgis.com/wRTEaR3VIVeAhJdr/arcgis/rest/services/Parcels_Vision/FeatureServer/0',
    bbox: [-77.10, 37.42, -76.72, 37.65],
    fieldMap: {
      id:    ['GPIN', 'TAXMAPID', 'OBJECTID'],
      acres: ['PRC_TTL_LND_AREA_ACRES'],
      owner: ['OWN_NAME1'],
      value: []
    }
  },
  'falls-church-city-va': {
    label: 'Falls Church (City), VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // City of Falls Church AGOL (2hmXRAz4ofcdQP6p, owner Tdolan_CFC).
    // Service is a date-tagged parcel layer view; schema has Acres + PIN/RPC.
    // Owner not on this layer.
    url: 'https://services1.arcgis.com/2hmXRAz4ofcdQP6p/arcgis/rest/services/20220412ParcelLayer_view/FeatureServer/0',
    bbox: [-77.20, 38.86, -77.15, 38.90],
    fieldMap: {
      id:    ['RPC', 'PIN', 'OBJECTID'],
      acres: ['Acres'],
      owner: [],
      value: []
    }
  },
  'manassas-city-va': {
    label: 'Manassas (City), VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // City of Manassas official AGOL (3wpOgOChiWXPeFWB). Rich schema:
    // OWNER_NAME + TOTAL_ASSESSED_VALUE (also LAND_VALUE + IMPROVEMENT_VALUE
    // separately) + TOTAL_ACRES + TAXMAP id + address. CORS: ACAO: *.
    url: 'https://services1.arcgis.com/3wpOgOChiWXPeFWB/arcgis/rest/services/Manassas_Parcels/FeatureServer/0',
    bbox: [-77.51, 38.72, -77.43, 38.78],
    fieldMap: {
      id:    ['TAXMAP', 'GIS_UID', 'OBJECTID'],
      acres: ['TOTAL_ACRES'],
      owner: ['OWNER_NAME'],
      value: ['TOTAL_ASSESSED_VALUE']
    }
  },
  'stafford-va': {
    label: 'Stafford County, VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // Stafford's official AGOL org (qKiA6JuCrE2l72iL) publishes a /Parcels
    // FeatureServer. Schema is bare — PRCLID + STNAME + city/zip — no
    // acreage or owner exposed. CORS: ACAO: * (Esri-hosted defaults).
    url: 'https://services1.arcgis.com/qKiA6JuCrE2l72iL/arcgis/rest/services/Parcels/FeatureServer/0',
    bbox: [-77.65, 38.18, -77.20, 38.62],
    fieldMap: {
      id:    ['PRCLID', 'PARID1', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  'chesterfield-va': {
    label: 'Chesterfield County, VA',
    state: 'VA',
    region: 'richmond',
    verified: true,
    kind: 'rest',
    // Chesterfield County AGOL (TsynfzBSE6sXfoLq). Cadastral_ProdA/3 is
    // "ParcelsEnriched" — OwnerName, DeededAcres, GPIN are all present.
    url: 'https://services3.arcgis.com/TsynfzBSE6sXfoLq/arcgis/rest/services/Cadastral_ProdA/FeatureServer/3',
    bbox: [-77.81, 37.21, -77.27, 37.59],
    fieldMap: {
      id:    ['GPIN', 'TaxID', 'MPN', 'OBJECTID'],
      acres: ['DeededAcres'],
      owner: ['OwnerName'],
      value: []
    }
  },
  'richmond-city-va': {
    label: 'Richmond (City), VA',
    state: 'VA',
    region: 'richmond',
    verified: true,
    kind: 'rest',
    // City of Richmond AGOL (k3vhq11XkBNeeOfM, owner richmondvagis).
    // Rich schema — OwnerName, TotalValue, LandValue, ParcelID, PIN.
    url: 'https://services1.arcgis.com/k3vhq11XkBNeeOfM/arcgis/rest/services/Parcels/FeatureServer/0',
    bbox: [-77.60, 37.43, -77.39, 37.61],
    fieldMap: {
      // PIN is the human-readable parcel id (e.g. "C0010126019"); ParcelID
      // is an internal numeric counter. Prefer PIN for display.
      id:    ['PIN', 'ParcelID', 'OBJECTID'],
      acres: [],
      owner: ['OwnerName'],
      value: ['TotalValue']
    },
    // Richmond exposes LandSqFt — convert to acres.
    derive: { acres: acresFromSqFt('LandSqFt') }
  },
  'goochland-va': {
    label: 'Goochland County, VA',
    state: 'VA',
    region: 'richmond',
    verified: true,
    kind: 'rest',
    // Goochland County 2025 parcels published on AGOL (9Z9r3rLUCq0SjsRb).
    // No owner exposed; DEED_AC has authoritative acreage from deeds.
    url: 'https://services5.arcgis.com/9Z9r3rLUCq0SjsRb/arcgis/rest/services/Goochland_County_Parcels___2025/FeatureServer/0',
    bbox: [-78.10, 37.55, -77.66, 37.83],
    fieldMap: {
      id:    ['GPIN', 'PIN', 'PIN2', 'OBJECTID'],
      acres: ['DEED_AC', 'Calc_Acrea'],
      owner: [],
      value: []
    }
  },
  'charlottesville-city-va': {
    label: 'Charlottesville (City), VA',
    state: 'VA',
    region: 'charlottesville',
    verified: true,
    kind: 'rest',
    // City of Charlottesville GIS (gisweb.charlottesville.org) — OpenData_1
    // MapServer layer 72 ("Parcel Area Details") has Owner + Assessment +
    // GeoParcelIdentificationNumber + LotSquareFeet.
    url: 'https://gisweb.charlottesville.org/cvgisweb/rest/services/OpenData_1/MapServer/72',
    bbox: [-78.55, 38.00, -78.42, 38.08],
    fieldMap: {
      // ParcelNumber is the human-readable parcel id (e.g. "540137A00");
      // GeoParcelIdentificationNumber is an internal numeric counter, not
      // useful to surface to users. Prefer ParcelNumber.
      id:    ['ParcelNumber', 'GeoParcelIdentificationNumber', 'OBJECTID'],
      acres: [],
      owner: ['OwnerName'],
      value: ['Assessment']
    },
    derive: { acres: acresFromSqFt('LotSquareFeet') }
  },
  // ===== Southside region (2026-05-16 overnight batch) =====
  'pittsylvania-va': {
    label: 'Pittsylvania County, VA',
    state: 'VA',
    region: 'southside',
    verified: true,
    kind: 'rest',
    // Pittsylvania County GIS — Cadastral/Assessed_Parcels/5. Excellent
    // schema: Current_Owner_1, Acreage, Total_Tax_Value, Property_Address,
    // appraised values.
    url: 'https://gis.pittgov.org/server/rest/services/Cadastral/Assessed_Parcels/MapServer/5',
    bbox: [-79.99, 36.54, -79.17, 37.07],
    fieldMap: {
      id:    ['Account_Number', 'Map_Sheet', 'OBJECTID'],
      acres: ['Acreage'],
      owner: ['Current_Owner_1'],
      value: ['Total_Tax_Value']
    }
  },
  'isle-of-wight-va': {
    label: 'Isle of Wight County, VA',
    state: 'VA',
    region: 'southside',
    verified: true,
    kind: 'rest',
    // IOW GIS official (IOWGIS1 AGOL org). NAME1 (owner), TOT_ACR (acres),
    // TOT_VAL (total value), plus assessment + sale date + zoning.
    url: 'https://services.arcgis.com/Dc6hhMQCpvLlOmSY/arcgis/rest/services/Parcels/FeatureServer/0',
    bbox: [-76.91, 36.71, -76.46, 37.06],
    fieldMap: {
      id:    ['TPIN', 'OBJECTID'],
      acres: ['TOT_ACR'],
      owner: ['NAME1'],
      value: ['TOT_VAL']
    }
  },
  // Southside Coming-soon:
  'halifax-va': { label: 'Halifax County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'No Halifax-owned ArcGIS REST surfaced; only 3rd-party AGOL scrape.',
    bbox: [-79.10, 36.54, -78.50, 37.05] },
  'mecklenburg-va': { label: 'Mecklenburg County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'No Mecklenburg-owned ArcGIS REST surfaced; only 3rd-party AGOL scrape.',
    bbox: [-78.65, 36.54, -78.07, 36.94] },
  'brunswick-va': { label: 'Brunswick County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'No Brunswick-owned ArcGIS REST surfaced; only 3rd-party AGOL scrape.',
    bbox: [-78.13, 36.54, -77.65, 36.92] },
  'greensville-va': { label: 'Greensville County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'No Greensville-owned ArcGIS REST surfaced.',
    bbox: [-77.66, 36.54, -77.30, 36.85] },
  'sussex-va': { label: 'Sussex County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'No Sussex-owned ArcGIS REST surfaced.',
    bbox: [-77.43, 36.69, -76.92, 37.04] },
  'dinwiddie-va': { label: 'Dinwiddie County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'gis.dinwiddieva.us does not respond.',
    bbox: [-77.86, 36.95, -77.34, 37.27] },
  'prince-george-va': { label: 'Prince George County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'gis.princegeorgecountyva.gov does not respond.',
    bbox: [-77.30, 37.07, -76.92, 37.32] },
  'surry-va': { label: 'Surry County, VA', state: 'VA', region: 'southside', comingSoon: true,
    skipReason: 'gis.surrycountyva.gov does not respond.',
    bbox: [-77.07, 36.83, -76.62, 37.24] },
  // ===== Eastern Shore / Northern Neck / Middle Peninsula =====
  'westmoreland-va': {
    label: 'Westmoreland County, VA',
    state: 'VA',
    region: 'northern-neck',
    verified: true,
    kind: 'rest',
    // CCRM/VIMS-hosted parcels (christine_ccrm). Bare schema — PARCELID
    // only — but renders polygons. Useful even without owner/value.
    url: 'https://services1.arcgis.com/QHK2l9cSYhemgg5s/arcgis/rest/services/Westmoreland_Parcels_All/FeatureServer/0',
    bbox: [-77.07, 37.92, -76.40, 38.27],
    fieldMap: {
      id:    ['PARCELID', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  'northumberland-va': {
    label: 'Northumberland County, VA',
    state: 'VA',
    region: 'northern-neck',
    verified: true,
    kind: 'rest',
    url: 'https://services1.arcgis.com/QHK2l9cSYhemgg5s/arcgis/rest/services/Northumberland_Parcels/FeatureServer/0',
    bbox: [-76.66, 37.74, -76.20, 38.05],
    fieldMap: {
      id:    ['PARCELID', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  'lancaster-va': {
    label: 'Lancaster County, VA',
    state: 'VA',
    region: 'northern-neck',
    verified: true,
    kind: 'rest',
    url: 'https://services1.arcgis.com/QHK2l9cSYhemgg5s/arcgis/rest/services/Lancaster_Parcels_All/FeatureServer/0',
    bbox: [-76.65, 37.62, -76.16, 37.95],
    fieldMap: {
      id:    ['PARCELID', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  'richmond-county-va': {
    label: 'Richmond County, VA',
    state: 'VA',
    region: 'northern-neck',
    verified: true,
    kind: 'rest',
    // Richmond County (not Richmond City). CCRM/VIMS-hosted Well Records
    // service has rich parcel data — NAME (owner), NACRES, LANDVALFM.
    url: 'https://services1.arcgis.com/QHK2l9cSYhemgg5s/arcgis/rest/services/RichmondCounty_Parcels/FeatureServer/0',
    bbox: [-77.04, 37.78, -76.59, 38.10],
    fieldMap: {
      id:    ['PARCELID', 'PTM_ID', 'OBJECTID'],
      acres: ['NACRES'],
      owner: ['NAME'],
      value: []
    },
    // LANDVALFM (land) + BLDGVAL (buildings) sum to assessed total.
    derive: { value: sumValueFields('LANDVALFM', 'BLDGVAL') }
  },
  // Eastern Shore + Middle Peninsula Coming-soon:
  'accomack-va': { label: 'Accomack County, VA', state: 'VA', region: 'eastern-shore', comingSoon: true,
    skipReason: 'AGOL surfaces only Publicly-Owned-Parcels subset (academic); no full county service.',
    bbox: [-75.92, 37.42, -75.39, 38.04] },
  'northampton-va': { label: 'Northampton County, VA', state: 'VA', region: 'eastern-shore', comingSoon: true,
    skipReason: 'AGOL surfaces only Publicly-Owned-Parcels subset (academic); no full county service.',
    bbox: [-76.05, 37.05, -75.66, 37.49] },
  'king-george-va': { label: 'King George County, VA', state: 'VA', region: 'northern-neck', comingSoon: true,
    skipReason: 'gis.king-george.va.us does not respond.',
    bbox: [-77.39, 38.16, -76.92, 38.41] },
  'essex-va': { label: 'Essex County, VA', state: 'VA', region: 'middle-peninsula', comingSoon: true,
    skipReason: 'Only flood-project subset surfaced in AGOL; no full county service.',
    bbox: [-76.96, 37.66, -76.65, 38.02] },
  'king-queen-va': { label: 'King and Queen County, VA', state: 'VA', region: 'middle-peninsula', comingSoon: true,
    skipReason: 'AGOL hit is wetlands-prioritization subset, not full county parcels.',
    bbox: [-77.04, 37.43, -76.62, 37.93] },
  'middlesex-va': { label: 'Middlesex County, VA', state: 'VA', region: 'middle-peninsula', comingSoon: true,
    skipReason: 'Best AGOL hit returns HTTP 200 + error 400 (gnix user-account service); no working full county service.',
    bbox: [-76.65, 37.49, -76.27, 37.78] },
  // ===== Roanoke & Lynchburg region (2026-05-16 overnight batch) =====
  'salem-city-va': {
    label: 'Salem (City), VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    verified: true,
    kind: 'rest',
    // Salem City GIS — TaxParcels FeatureServer layer 5. Rich schema:
    // owner, total_assessment, GPIN, year_built, full property details.
    url: 'https://services7.arcgis.com/RL8aZgZHmJOdyNXk/arcgis/rest/services/TaxParcels/FeatureServer/5',
    bbox: [-80.13, 37.24, -80.00, 37.35],
    fieldMap: {
      id:    ['GPIN', 'PID', 'tax_map_number', 'OBJECTID'],
      acres: [],
      owner: ['owner'],
      value: ['total_assessment']
    }
  },
  'lynchburg-city-va': {
    label: 'Lynchburg (City), VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    verified: true,
    kind: 'rest',
    // City of Lynchburg OpenData. Layer 41 = Parcel. Owner1, Current_Total
    // (assessed value), LocAddr. CORS friendly (county hosting).
    url: 'https://mapviewer.lynchburgva.gov/ArcGIS/rest/services/OpenData/ODPDynamic/MapServer/41',
    bbox: [-79.27, 37.32, -79.07, 37.48],
    fieldMap: {
      id:    ['Parcel_ID', 'LRSN', 'OBJECTID'],
      acres: ['LegalAc', 'Shape_Acres'],
      owner: ['Owner1'],
      value: ['Current_Total']
    }
  },
  'campbell-va': {
    label: 'Campbell County, VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    verified: true,
    kind: 'rest',
    // Campbell County GIS — Public_Data/Parcels MapServer layer 7. Sparse
    // schema: ACCOUNT id only, no owner/acres on this layer.
    url: 'https://gis.co.campbell.va.us/arcgis/rest/services/Public_Data/Parcels/MapServer/7',
    bbox: [-79.30, 37.07, -78.79, 37.43],
    fieldMap: {
      id:    ['ACCOUNT', 'MAPNO', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  // Roanoke & Lynchburg — Coming-soon:
  'roanoke-county-va': {
    label: 'Roanoke County, VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    comingSoon: true,
    skipReason: 'gis.roanokecountyva.gov does not respond; AGOL surfaces no county-owned parcels service.',
    bbox: [-80.20, 37.10, -79.79, 37.46]
  },
  'roanoke-city-va': {
    label: 'Roanoke (City), VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    comingSoon: true,
    skipReason: 'gis.roanokeva.gov does not respond; AGOL surfaces no city-owned parcels service.',
    bbox: [-80.05, 37.23, -79.86, 37.34]
  },
  'bedford-va': {
    label: 'Bedford County, VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    comingSoon: true,
    skipReason: 'gis.bedfordcountyva.gov does not respond; AGOL surfaces no Bedford-owned service.',
    bbox: [-79.86, 37.14, -79.13, 37.61]
  },
  'franklin-va': {
    label: 'Franklin County, VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    comingSoon: true,
    skipReason: 'gis.franklincountyva.gov does not respond; AGOL surfaces no Franklin-owned service.',
    bbox: [-80.18, 36.79, -79.59, 37.20]
  },
  'botetourt-va': {
    label: 'Botetourt County, VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    comingSoon: true,
    skipReason: 'gis.botetourtva.gov does not respond; only DPMC_GIS subset layers surfaced in AGOL.',
    bbox: [-80.04, 37.36, -79.50, 37.74]
  },
  'amherst-va': {
    label: 'Amherst County, VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    comingSoon: true,
    skipReason: 'gis.amherstva.com does not respond; no Amherst-owned AGOL service surfaced.',
    bbox: [-79.43, 37.42, -78.75, 37.95]
  },
  'appomattox-va': {
    label: 'Appomattox County, VA',
    state: 'VA',
    region: 'roanoke-lynchburg',
    comingSoon: true,
    skipReason: 'gis.appomattoxcountyva.gov does not respond; no Appomattox-owned AGOL service surfaced.',
    bbox: [-78.96, 37.18, -78.55, 37.59]
  },
  // ===== Shenandoah Valley region (2026-05-16 overnight batch) =====
  'winchester-city-va': {
    label: 'Winchester (City), VA',
    state: 'VA',
    region: 'shenandoah',
    verified: true,
    kind: 'rest',
    // City of Winchester GIS — Winchester/Parcels MapServer/0. Schema
    // includes PID (parcel id), MLNAM (owner), MACRE (acres).
    url: 'https://gis.winchesterva.gov/arcgis/rest/services/Winchester/Parcels/MapServer/0',
    bbox: [-78.21, 39.13, -78.13, 39.21],
    fieldMap: {
      id:    ['PID', 'TAX_MAP', 'OBJECTID'],
      acres: ['MACRE'],
      owner: ['MLNAM'],
      value: []
    }
  },
  'page-va': {
    label: 'Page County, VA',
    state: 'VA',
    region: 'shenandoah',
    verified: true,
    kind: 'rest',
    // Page County's parcels assessment service on AGOL (vzTTDUcNo7s6eLCJ,
    // owner JoshHahn — county-level). GIS_MLNAM = owner, MACRE_Num = acres.
    url: 'https://services1.arcgis.com/vzTTDUcNo7s6eLCJ/arcgis/rest/services/PageCoParcelsAssessment_Pub/FeatureServer/0',
    bbox: [-78.65, 38.49, -78.31, 38.93],
    fieldMap: {
      id:    ['ACCOUNT', 'MAP', 'OBJECTID'],
      acres: ['MACRE_Num'],
      owner: ['GIS_MLNAM'],
      value: []
    }
  },
  'harrisonburg-city-va': {
    label: 'Harrisonburg (City), VA',
    state: 'VA',
    region: 'shenandoah',
    verified: true,
    kind: 'rest',
    // City of Harrisonburg — Real_Estate_and_Ownership MapServer. Owner +
    // Acres_GIS + REISParcelID. CORS friendly.
    url: 'https://gis.harrisonburgva.gov/arcgis/rest/services/CityServices/Real_Estate_and_Ownership/MapServer/0',
    bbox: [-78.92, 38.40, -78.81, 38.49],
    fieldMap: {
      id:    ['REISParcelID', 'REISTaxNum', 'PID', 'OBJECTID'],
      acres: ['Acres_GIS'],
      owner: ['Owner'],
      value: []
    }
  },
  // Shenandoah — Coming-soon:
  'rockingham-va': {
    label: 'Rockingham County, VA',
    state: 'VA',
    region: 'shenandoah',
    comingSoon: true,
    skipReason: 'gis.rockinghamcountyva.gov does not respond; AGOL hub search returned no county-owned parcels service.',
    bbox: [-79.21, 38.32, -78.61, 38.83]
  },
  'augusta-va': {
    label: 'Augusta County, VA',
    state: 'VA',
    region: 'shenandoah',
    comingSoon: true,
    skipReason: 'gis.augustacountyva.gov does not respond; AGOL surfaces only 3rd-party scrape.',
    bbox: [-79.51, 37.78, -78.78, 38.41]
  },
  'frederick-va': {
    label: 'Frederick County, VA',
    state: 'VA',
    region: 'shenandoah',
    comingSoon: true,
    skipReason: 'Neither maps.fcva.us nor gis.fcva.us responds; AGOL surfaces nothing official for Frederick County, VA.',
    bbox: [-78.55, 38.97, -78.07, 39.39]
  },
  'clarke-va': {
    label: 'Clarke County, VA',
    state: 'VA',
    region: 'shenandoah',
    comingSoon: true,
    skipReason: 'gis.clarkecounty.gov does not respond; no Clarke-owned AGOL service surfaced.',
    bbox: [-78.10, 39.05, -77.74, 39.34]
  },
  'shenandoah-county-va': {
    label: 'Shenandoah County, VA',
    state: 'VA',
    region: 'shenandoah',
    comingSoon: true,
    skipReason: 'gis.shenandoahcountyva.us does not respond; AGOL surfaces only the cross-county Page Co service.',
    bbox: [-78.91, 38.62, -78.39, 39.07]
  },
  'warren-va': {
    label: 'Warren County, VA',
    state: 'VA',
    region: 'shenandoah',
    comingSoon: true,
    skipReason: 'gis.warrencountyva.net does not respond; no Warren-owned AGOL service surfaced.',
    bbox: [-78.36, 38.79, -77.95, 39.10]
  },
  'staunton-city-va': {
    label: 'Staunton (City), VA',
    state: 'VA',
    region: 'shenandoah',
    comingSoon: true,
    skipReason: 'gis.staunton.va.us does not respond; no Staunton-owned AGOL service surfaced.',
    bbox: [-79.10, 38.12, -78.97, 38.20]
  },
  // ===== Hampton Roads region (2026-05-16 overnight batch) =====
  'virginia-beach-city-va': {
    label: 'Virginia Beach (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    verified: true,
    kind: 'rest',
    // Official VB GIS portal at geo.vbgov.com. Property_Information MapServer
    // layer 12 has PAR_GPIN + street address + zoning. No owner exposed
    // publicly on the polygon layer (VBCGIS may keep it CAMA-side).
    url: 'https://geo.vbgov.com/mapservices/rest/services/Basemaps/Property_Information/MapServer/12',
    bbox: [-76.25, 36.55, -75.85, 36.95],
    fieldMap: {
      id:    ['PAR_GPIN', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  'portsmouth-city-va': {
    label: 'Portsmouth (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    verified: true,
    kind: 'rest',
    // Portsmouth AGOL (nGsguNiHLn7MU4R4, owner winzah likely city GIS).
    // Excellent schema — OWNER, ACRES, LAND_VAL, BLDG_VAL, TOTAL_VAL.
    url: 'https://services1.arcgis.com/nGsguNiHLn7MU4R4/arcgis/rest/services/Parcels_Real_Estate/FeatureServer/3',
    bbox: [-76.46, 36.78, -76.27, 36.97],
    fieldMap: {
      id:    ['CPN', 'PARCEL', 'OBJECTID'],
      acres: ['ACRES'],
      owner: ['OWNER'],
      value: ['TOTAL_VAL']
    }
  },
  'york-va': {
    label: 'York County, VA',
    state: 'VA',
    region: 'hampton-roads',
    verified: true,
    kind: 'rest',
    // York County hosts Landrecords_Service at maps.yorkcounty.gov.
    // Layer 7 is Parcels (polygons). Only PRIOR-owner exposed; current
    // owner not on this layer.
    url: 'https://maps.yorkcounty.gov/arcgis/rest/services/AGOservices/Landrecords_Service/FeatureServer/7',
    bbox: [-76.74, 37.10, -76.34, 37.30],
    fieldMap: {
      id:    ['GPIN', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  'james-city-va': {
    label: 'James City County, VA',
    state: 'VA',
    region: 'hampton-roads',
    verified: true,
    kind: 'rest',
    // JCC official: property.jamescitycountyva.gov, JCC/GIS_Data layer 17.
    // PIN + addresses present; owner not on this layer.
    url: 'https://property.jamescitycountyva.gov/arcgis/rest/services/JCC/GIS_Data/FeatureServer/17',
    bbox: [-76.95, 37.16, -76.61, 37.46],
    fieldMap: {
      id:    ['PIN', 'PIN_1', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    }
  },
  // Hampton Roads — Coming-soon (no official endpoint found in batch search):
  'norfolk-city-va': {
    label: 'Norfolk (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    comingSoon: true,
    skipReason: 'No official Norfolk parcels FeatureServer surfaced via AGOL; gis.norfolk.gov serves no REST root. Only 3rd-party scrape available.',
    bbox: [-76.34, 36.83, -76.17, 36.99]
  },
  'chesapeake-city-va': {
    label: 'Chesapeake (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    comingSoon: true,
    skipReason: 'gis.cityofchesapeake.net portal page only (HTML); no Chesapeake parcels FeatureServer surfaced via AGOL.',
    bbox: [-76.43, 36.55, -76.14, 36.80]
  },
  'newport-news-city-va': {
    label: 'Newport News (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    comingSoon: true,
    skipReason: 'gis.nnva.gov does not respond; AGOL surfaces only 3rd-party scrape.',
    bbox: [-76.62, 36.99, -76.35, 37.22]
  },
  'hampton-city-va': {
    label: 'Hampton (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    comingSoon: true,
    skipReason: 'hamptongis.hampton.gov does not respond; AGOL hub search returns no Hampton-owned parcels service.',
    bbox: [-76.42, 37.00, -76.25, 37.13]
  },
  'suffolk-city-va': {
    label: 'Suffolk (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    comingSoon: true,
    skipReason: 'gis.suffolkva.us does not respond; AGOL hub surfaces only 3rd-party scrape.',
    bbox: [-76.74, 36.50, -76.36, 36.94]
  },
  'williamsburg-city-va': {
    label: 'Williamsburg (City), VA',
    state: 'VA',
    region: 'hampton-roads',
    comingSoon: true,
    skipReason: 'gis.williamsburgva.gov portal page only; only AGOL hit is a W&M academic-account layer + 3rd-party scrape. Holding for an official source.',
    bbox: [-76.76, 37.25, -76.65, 37.32]
  },
  'arlington-va': {
    label: 'Arlington County, VA',
    state: 'VA',
    region: 'northern-virginia',
    verified: true,
    kind: 'rest',
    // 2026-05-16: the original `gisdata.arlingtonva.us/...` host the prior
    // session guessed at does not resolve. The real public REA Properties
    // FeatureService lives on `arlgis.arlingtonva.us`. Schema is minimal —
    // only RPCMSTR (real-property code) + Shape__Area; no owner/value
    // exposed (Regrid would be needed for that, same as Fairfax).
    url: 'https://arlgis.arlingtonva.us/arcgis/rest/services/Open_Data/od_REA_Property_Polygons/FeatureServer/0',
    bbox: [-77.18, 38.82, -77.03, 38.93],
    fieldMap: {
      id:    ['RPCMSTR', 'OBJECTID'],
      acres: [],
      owner: [],
      value: []
    },
    derive: { acres: acresFromSqM('Shape__Area', 'SHAPE_Area', 'Shape_Area') }
  },

  // ===================================================================
  // STATEWIDE PARCEL SERVICES (2026-06-12 nationwide expansion)
  // ===================================================================
  // Free, official, no-token statewide parcel layers, each live-verified
  // (metadata + statewide-scale count + sample schema + CORS vs
  // landcheck.info) and adversarially re-verified by an independent agent.
  // All return polygons reprojected to WGS84 via the app's f=geojson +
  // outSR=4326 query, so native State-Plane/UTM/Web-Mercator geometry is a
  // non-issue. Acreage notes per entry: a direct acres field is used where
  // present; State-Plane/UTM services without one derive acres from their
  // (native-unit) Shape__Area; Web-Mercator/geographic services without one
  // leave acres "not reported" (Shape__Area there is latitude-distorted or
  // in square-degrees — see the 2026-06-12 area-probe). Run `npm run health`
  // monthly; demote any that drift.

  // ---------- Northeast ----------
  'nj-statewide': {
    label: 'New Jersey (statewide)', state: 'NJ', region: 'us-northeast',
    verified: true, kind: 'rest',
    url: 'https://maps.nj.gov/arcgis/rest/services/Framework/Cadastral/MapServer/0',
    bbox: [-75.6, 38.9, -73.9, 41.4],
    // NJGIN Framework Cadastral — Parcels & MOD-IV composite, ~3.48M parcels.
    // OWNER_NAME is redacted (blank) for public web access per NJ Daniel's
    // Law, so owner is left unmapped (pickField skips empty strings anyway).
    // NET_VALUE = assessed total (LAND_VAL + IMPRVT_VAL).
    fieldMap: { id: ['PAMS_PIN', 'GIS_PIN', 'OBJECTID'], acres: ['CALC_ACRE'], owner: [], value: ['NET_VALUE'] }
  },
  'ny-statewide': {
    label: 'New York (most counties, excl. NYC)', state: 'NY', region: 'us-northeast',
    verified: true, kind: 'rest',
    // NYS ITS "Tax Parcels Public" — layer 1 is polygons (layer 0 is the
    // county-coverage footprint). PARTIAL: only the ~38 of 62 counties that
    // granted ITS redistribution; NYC + opt-out counties excluded.
    url: 'https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1',
    bbox: [-79.8, 40.4, -71.8, 45.1],
    fieldMap: { id: ['PRINT_KEY', 'SBL', 'OBJECTID'], acres: ['ACRES', 'CALC_ACRES'], owner: ['PRIMARY_OWNER'], value: ['TOTAL_AV', 'FULL_MARKET_VAL'] }
  },
  'ct-statewide': {
    label: 'Connecticut (statewide)', state: 'CT', region: 'us-northeast',
    verified: true, kind: 'rest',
    // CT OPM "Connecticut State Parcel Layer 2023" — all 169 municipalities.
    // No acreage attribute (only projected Shape__Area) → not reported.
    url: 'https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_State_Parcel_Layer_2023/FeatureServer/0',
    bbox: [-73.8, 40.9, -71.7, 42.1],
    fieldMap: { id: ['Link', 'OBJECTID'], acres: [], owner: ['Owner', 'Co_Owner'], value: ['Assessed_Total'] }
  },
  'ri-statewide': {
    label: 'Rhode Island (statewide)', state: 'RI', region: 'us-northeast',
    verified: true, kind: 'rest',
    // RIGIS/RIDEM statewide tax parcels. Attribute-poor (PlatLot id + Acres +
    // environmental land-cover); no owner/value on this public layer.
    url: 'https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0',
    bbox: [-71.9, 41.1, -71.1, 42.1],
    fieldMap: { id: ['PlatLot', 'OBJECTID'], acres: ['Acres'], owner: [], value: [] }
  },
  'ma-statewide': {
    label: 'Massachusetts (statewide)', state: 'MA', region: 'us-northeast',
    verified: true, kind: 'rest',
    // MassGIS Level-3 standardized assessor parcels — all 351 cities/towns.
    // LOT_SIZE unit varies per record via LOT_UNITS ('A'=acres, 'S'=sqft),
    // so acres is derived conditionally rather than mapped directly.
    url: 'https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0',
    bbox: [-73.6, 41.1, -69.8, 42.9],
    fieldMap: { id: ['LOC_ID', 'MAP_PAR_ID', 'OBJECTID'], acres: [], owner: ['OWNER1'], value: ['TOTAL_VAL'] },
    derive: {
      acres: (p) => {
        const v = Number(p.LOT_SIZE);
        if (!Number.isFinite(v) || v <= 0) return null;
        return String(p.LOT_UNITS).toUpperCase() === 'S' ? v / 43560 : v;
      }
    }
  },
  'vt-statewide': {
    label: 'Vermont (statewide)', state: 'VT', region: 'us-northeast',
    verified: true, kind: 'rest',
    // VCGI standardized parcels + Grand List join. SPAN is the state property
    // account number. Grand List values are null for unmatched parcels, so
    // REAL_FLV (total) falls back to a land+improvement sum.
    url: 'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0',
    bbox: [-73.5, 42.7, -71.4, 45.1],
    fieldMap: { id: ['SPAN', 'PARCID', 'OBJECTID'], acres: ['ACRESGL'], owner: ['OWNER1', 'OWNER2'], value: ['REAL_FLV'] },
    derive: { value: sumValueFields('LAND_LV', 'IMPRV_LV') }
  },
  'nh-statewide': {
    label: 'New Hampshire (statewide)', state: 'NH', region: 'us-northeast',
    verified: true, kind: 'rest',
    // NH GRANIT (UNH) statewide Parcel Mosaic, layer 1. CAMA (owner/value) is
    // in a separate related table; the polygon exposes ids + Shape_Area only.
    // Shape_Area is NH State Plane US-ft → sqft (verified native, survives
    // outSR=4326).
    url: 'https://nhgeodata.unh.edu/nhgeodata/rest/services/CAD/ParcelMosaic/MapServer/1',
    bbox: [-72.6, 42.6, -70.6, 45.4],
    fieldMap: { id: ['NH_GIS_ID', 'PID', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape_Area') }
  },
  'me-statewide': {
    label: 'Maine (organized towns)', state: 'ME', region: 'us-northeast',
    verified: true, kind: 'rest',
    // Maine GeoLibrary statewide aggregate of ORGANIZED-town parcels, layer 10
    // (layer 0 404s). Ownership is in a related ADB table; geometry layer has
    // ids + Shape__Area (UTM 19N meters → sqm). Unorganized territories are a
    // separate service, hence "organized towns".
    url: 'https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Organized_Towns/FeatureServer/10',
    bbox: [-71.1, 42.9, -66.9, 47.5],
    fieldMap: { id: ['STATE_ID', 'MAP_BK_LOT', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqM('Shape__Area') }
  },
  'pa-statewide': {
    label: 'Pennsylvania (statewide)', state: 'PA', region: 'us-northeast',
    verified: true, kind: 'rest',
    // PA DEP statewide parcel layer (~4.69M parcels) — the most complete free,
    // no-token statewide PA source. f=geojson returns real WGS84 geometry and
    // exposes PARCEL_ID + OWNER_NAME + ACREAGE (no assessed-value field). CORS
    // origin-echoes. Covers most of PA's 67 counties but NOT all: Delaware,
    // York, Luzerne, Lackawanna, Erie, Butler, Washington return 0 here — 5 are
    // gap-filled by the pa-counties entries below (Luzerne + Erie have no usable
    // public countywide endpoint; see their comingSoon notes).
    url: 'https://gis.dep.pa.gov/depgisprd/rest/services/Parcels/PA_Parcels/MapServer/0',
    bbox: [-80.6, 39.7, -74.65, 42.3],
    fieldMap: { id: ['PARCEL_ID', 'OBJECTID'], acres: ['ACREAGE', 'ACRES'], owner: ['OWNER_NAME', 'OWNER_LAST_NAME'], value: [] }
  },

  // ---------- South ----------
  'de-statewide': {
    label: 'Delaware (statewide)', state: 'DE', region: 'us-south',
    verified: true, kind: 'rest',
    // Delaware FirstMap public statewide parcels (all 3 counties). Public view
    // strips owner/value; direct ACRES + PIN present.
    url: 'https://hosting.firstmap.delaware.gov/hosting/rest/services/PlanningCadastre/DE_StateParcels_SP_Public/FeatureServer/0',
    bbox: [-75.8, 38.4, -74.9, 39.9],
    fieldMap: { id: ['PIN', 'OBJECTID'], acres: ['ACRES'], owner: [], value: [] }
  },
  'wv-statewide': {
    label: 'West Virginia (statewide)', state: 'WV', region: 'us-south',
    verified: true, kind: 'rest',
    // WV GIS Technical Center (WVU) statewide parcels — all 55 counties.
    // Direct Acres_C + FullOwnerName (one of the richest free statewide sets).
    url: 'https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0',
    bbox: [-82.7, 37.1, -77.7, 40.7],
    fieldMap: { id: ['GISPID', 'CleanParcelID', 'OBJECTID'], acres: ['Acres_C'], owner: ['FullOwnerName'], value: [] }
  },
  'nc-statewide': {
    label: 'North Carolina (statewide)', state: 'NC', region: 'us-south',
    verified: true, kind: 'rest',
    // NC OneMap Integrated Cadastral — all 100 counties + EBCI. layer 1 is
    // polygons (layer 0 is points). parval = total parcel value.
    url: 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1',
    bbox: [-84.4, 33.8, -75.4, 36.6],
    fieldMap: { id: ['parno', 'altparno', 'objectid'], acres: ['gisacres'], owner: ['ownname', 'ownname2'], value: ['parval'] }
  },
  'tn-statewide': {
    label: 'Tennessee (most counties)', state: 'TN', region: 'us-south',
    verified: true, kind: 'rest',
    // TN Comptroller / TNMap public boundaries. Covers 86 of 95 counties
    // (9 metro counties on non-state systems are excluded). DEEDAC = deed
    // acreage; no value field (TPAD link per parcel holds it).
    url: 'https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/Tennessee_Property_Boundaries_Public_Use/FeatureServer/0',
    bbox: [-90.4, 34.9, -81.6, 36.7],
    fieldMap: { id: ['PARCELID', 'GISLINK', 'OBJECTID'], acres: ['DEEDAC'], owner: ['OWNER', 'OWNER2'], value: [] }
  },
  'fl-statewide': {
    label: 'Florida (statewide)', state: 'FL', region: 'us-south',
    verified: true, kind: 'rest',
    // FL Dept of Revenue / FGIO statewide cadastral — all 67 counties,
    // joined to the NAL roll (~10.8M parcels). JV = just (market) value;
    // area only as LND_SQFOOT (sqft) → derive acres.
    url: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0',
    bbox: [-87.7, 24.4, -79.9, 31.1],
    fieldMap: { id: ['PARCEL_ID', 'PARCELNO', 'OBJECTID'], acres: [], owner: ['OWN_NAME'], value: ['JV', 'LND_VAL'] },
    derive: { acres: acresFromSqFt('LND_SQFOOT') }
  },
  'tx-statewide': {
    label: 'Texas (statewide)', state: 'TX', region: 'us-south',
    verified: true, kind: 'rest',
    // AGOL-hosted TxGIO StratMap statewide land parcels (2025 vintage, layer
    // Stratmap25_landparcels_48). SWAPPED 2026-07-02 off the standalone
    // feature.geographic.texas.gov MapServer, which regressed: its metadata
    // still advertises `geoJSON` in supportedQueryFormats but the query op now
    // rejects `f=geojson` with error 400 "The requested capability is not
    // supported" (f=json works, but the app is geojson-only). This FeatureServer
    // serves the same data and honours f=geojson. No value field exists in this
    // dataset; GIS_AREA is NOT acres (a 0.34ac lot reads 3.67) so acres are
    // "not reported" here until the geometry-based acreage fallback lands.
    url: 'https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/2019_Texas_Parcels_StratMap/FeatureServer/0',
    bbox: [-106.7, 25.8, -93.5, 36.6],
    fieldMap: { id: ['Prop_ID', 'GEO_ID', 'OBJECTID'], acres: [], owner: ['OWNER_NAME'], value: [] }
  },
  'ar-statewide': {
    label: 'Arkansas (statewide)', state: 'AR', region: 'us-south',
    verified: true, kind: 'rest',
    // Arkansas GIS Office (GeoStor) statewide parcels, Planning_Cadastre
    // layer 6. taxarea = acres; totalvalue = land+improvement total.
    url: 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6',
    bbox: [-94.7, 33.0, -89.6, 36.6],
    fieldMap: { id: ['parcelid', 'countyid', 'objectid'], acres: ['taxarea'], owner: ['ownername'], value: ['totalvalue'] }
  },
  'ms-statewide': {
    label: 'Mississippi (statewide)', state: 'MS', region: 'us-south',
    verified: true, kind: 'rest',
    // MS MARIS / MDEM statewide cadastral, MDEQ Download layer 57 (layer 56 is
    // a narrower older subset). TRUEVALUE often null → fall back to ASSEDVALUE.
    // NOTE: STATE field is the owner's mailing state, not parcel state.
    url: 'https://www.gisonline.ms.gov/arcgis/rest/services/MDEQ/Download/MapServer/57',
    bbox: [-91.7, 30.1, -88.0, 35.1],
    fieldMap: { id: ['PARCELID', 'PPIN', 'OBJECTID'], acres: ['PARCELACREAGE'], owner: ['OWNERNAME'], value: ['TRUEVALUE', 'ASSEDVALUE'] }
  },

  // ---------- Midwest ----------
  'oh-statewide': {
    label: 'Ohio (statewide)', state: 'OH', region: 'us-midwest',
    verified: true, kind: 'rest',
    // OGRIP/geohio statewide parcels public view — all 88 counties (~6.3M).
    // NOTE the "Pacels" typo is in the real service name. CAMA owner/value is
    // in a related table; LandArea is unreliable (often 0) so acres derives
    // from Shape__Area (Ohio State Plane ftUS → sqft).
    url: 'https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0',
    bbox: [-84.9, 38.3, -80.5, 42.4],
    fieldMap: { id: ['StateParcelID', 'LocalParcelID', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape__Area') }
  },
  'wi-statewide': {
    label: 'Wisconsin (statewide)', state: 'WI', region: 'us-midwest',
    verified: true, kind: 'rest',
    // Wisconsin Statewide Parcel Map V11 (State Cartographer/DOA). Direct
    // GISACRES, owner, and both market (ESTFMKVALUE) and assessed values.
    url: 'https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels/FeatureServer/0',
    bbox: [-92.9, 42.4, -86.8, 47.1],
    fieldMap: { id: ['PARCELID', 'TAXPARCELID', 'STATEID', 'OBJECTID'], acres: ['GISACRES', 'DEEDACRES'], owner: ['OWNERNME1', 'OWNERNME2'], value: ['ESTFMKVALUE', 'CNTASSDVALUE'] }
  },
  'mn-statewide': {
    label: 'Minnesota (opt-in counties)', state: 'MN', region: 'us-midwest',
    verified: true, kind: 'rest',
    // MnGeo statewide aggregate of opt-in counties (~59 of 87). Use the direct
    // pca-gis02 endpoint (the AGOL proxy injects a token and 500s). emv_total
    // is inconsistently populated → land+building sum fallback.
    url: 'https://pca-gis02.pca.state.mn.us/arcgis/rest/services/base/parcels_open_data_counties/MapServer/0',
    bbox: [-97.3, 43.4, -89.4, 49.4],
    fieldMap: { id: ['state_pin', 'county_pin', 'OBJECTID'], acres: ['acres_poly', 'acres_deed'], owner: ['owner_name', 'owner_more'], value: ['emv_total'] },
    derive: { value: sumValueFields('emv_land', 'emv_bldg') }
  },
  'in-statewide': {
    label: 'Indiana (statewide)', state: 'IN', region: 'us-midwest',
    verified: true, kind: 'rest',
    // IGIO/IndianaMap statewide parcel boundaries (~3.68M). Geometry + ids +
    // address only — no owner/value, and the service's native SR is geographic
    // so its Shape__Area is square-degrees (useless) → acres not reported.
    url: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0',
    bbox: [-88.2, 37.7, -84.7, 41.8],
    fieldMap: { id: ['parcel_id', 'local_id', 'state_parcel_id', 'objectid'], acres: [], owner: [], value: [] }
  },
  'nd-statewide': {
    label: 'North Dakota (statewide)', state: 'ND', region: 'us-midwest',
    verified: true, kind: 'rest',
    // ND GIS Hub statewide parcels (~742k, 53 counties). Tax roll (owner/value)
    // is a separate related table; CalculatedAcres is a direct acreage field.
    url: 'https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Parcels/FeatureServer/0',
    bbox: [-104.1, 45.9, -96.5, 49.1],
    fieldMap: { id: ['GISID', 'UniqueGISID', 'OBJECTID'], acres: ['CalculatedAcres'], owner: [], value: [] }
  },
  'ne-statewide': {
    label: 'Nebraska (statewide)', state: 'NE', region: 'us-midwest',
    verified: true, kind: 'rest',
    // Nebraska OCIO statewide parcels (NebraskaMAP). Use StatewideParcelsExternal
    // (the old TaxParcels2023 path is stale/404). Direct GIS_Acres +
    // Total_Assessed_Value; owner name not exposed.
    url: 'https://gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0',
    bbox: [-104.1, 39.9, -95.2, 43.1],
    fieldMap: { id: ['State_PID', 'Parcel_ID', 'GeoCode', 'OBJECTID'], acres: ['GIS_Acres', 'Acres_Deeded'], owner: [], value: ['Total_Assessed_Value'] }
  },

  // ---------- West ----------
  'mt-statewide': {
    label: 'Montana (statewide)', state: 'MT', region: 'us-west',
    verified: true, kind: 'rest',
    // Montana State Library cadastral framework (DOR CAMA + GCDB). Direct
    // TotalAcres, OwnerName, TotalValue. Many public/non-taxable parcels have
    // null attributes (expected).
    url: 'https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0',
    bbox: [-116.1, 44.3, -104.0, 49.1],
    fieldMap: { id: ['PARCELID', 'PropertyID', 'OBJECTID'], acres: ['TotalAcres', 'GISAcres'], owner: ['OwnerName'], value: ['TotalValue'] }
  },
  'ut-statewide': {
    label: 'Utah (statewide)', state: 'UT', region: 'us-west',
    verified: true, kind: 'rest',
    // UGRC Utah Statewide Parcels (SGID aggregate; NOT the single-county
    // "Parcels_Utah" service). Owner generalized to OWN_TYPE only, no value,
    // and only Web-Mercator Shape__Area → acres not reported.
    url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/UtahStatewideParcels/FeatureServer/0',
    bbox: [-114.1, 36.9, -109.0, 42.1],
    fieldMap: { id: ['PARCEL_ID', 'ACCOUNT_NUM', 'OBJECTID'], acres: [], owner: [], value: [] }
  },
  'wy-statewide': {
    label: 'Wyoming (statewide)', state: 'WY', region: 'us-west',
    verified: true, kind: 'rest',
    // Wyoming ETS + 23 county assessors statewide layer. actualvalu = market
    // (actual) value; landgrossa = gross land acres.
    url: 'https://services3.arcgis.com/r0iJ85SKZ4zAzz3P/arcgis/rest/services/Wyoming_Parcels_for_2026/FeatureServer/0',
    bbox: [-111.1, 40.9, -104.0, 45.1],
    fieldMap: { id: ['parcelnb', 'accountno', 'OBJECTID', 'FID'], acres: ['landgrossa'], owner: ['ownername1', 'ownername2'], value: ['actualvalu', 'assessedva'] }
  },
  'co-statewide': {
    label: 'Colorado (statewide)', state: 'CO', region: 'us-west',
    verified: true, kind: 'rest',
    // Colorado OIT statewide parcel composite (30+ counties), native WGS84.
    // Value/acres are strings — the panel's Number()-based formatters parse
    // them. apprValTot = total appraised (market) value.
    url: 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0',
    bbox: [-109.1, 36.9, -102.0, 41.1],
    fieldMap: { id: ['parcel_id', 'account', 'OBJECTID'], acres: ['landAcres'], owner: ['owner', 'owner2'], value: ['apprValTot', 'asedValTot'] }
  },
  'wa-statewide': {
    label: 'Washington (statewide)', state: 'WA', region: 'us-west',
    verified: true, kind: 'rest',
    // WA State Geospatial Open Data "Current Parcels" aggregate. No owner;
    // value is land+building separate → sum. Shape__Area is WA State Plane
    // ftUS → sqft for acres.
    url: 'https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0',
    bbox: [-124.9, 45.5, -116.9, 49.1],
    fieldMap: { id: ['PARCEL_ID_NR', 'ORIG_PARCEL_ID', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape__Area'), value: sumValueFields('VALUE_LAND', 'VALUE_BLDG') }
  },
  'id-statewide': {
    label: 'Idaho (statewide)', state: 'ID', region: 'us-west',
    verified: true, kind: 'rest',
    // Idaho statewide parcel compilation (IDWR-hosted, all 44 counties). OWNER
    // present but sparsely populated; no value. Shape__Area is Idaho TM meters
    // → sqm for acres.
    url: 'https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/FeatureServer/0',
    bbox: [-117.3, 41.9, -110.9, 49.1],
    fieldMap: { id: ['PIN', 'OBJECTID'], acres: [], owner: ['OWNER'], value: [] },
    derive: { acres: acresFromSqM('Shape__Area') }
  },
  'nv-statewide': {
    label: 'Nevada (statewide)', state: 'NV', region: 'us-west',
    verified: true, kind: 'rest',
    // Nevada statewide county parcels (NV DCNR/Water Resources host; the
    // gis.dot.nv.gov endpoint is down). Owner/value restricted per NRS 250;
    // direct Acres + APN + per-parcel assessor link.
    url: 'https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/County_Parcels_In_Nevada_Yellow/MapServer/0',
    bbox: [-120.1, 35.0, -114.0, 42.1],
    fieldMap: { id: ['APN', 'PIN', 'OBJECTID'], acres: ['Acres'], owner: [], value: [] }
  },
  'hi-statewide': {
    label: 'Hawaii (statewide)', state: 'HI', region: 'us-west',
    verified: true, kind: 'rest',
    // Hawaii Statewide GIS (OPSD) merged TMK parcels, all 4 counties. Owner/
    // value via per-parcel qPublic link only; gisacres is direct; tmk_txt is
    // the human-readable Tax Map Key.
    url: 'https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25',
    bbox: [-160.3, 18.9, -154.7, 22.3],
    fieldMap: { id: ['tmk_txt', 'cty_tmk', 'objectid'], acres: ['gisacres'], owner: [], value: [] }
  },
  'ak-statewide': {
    label: 'Alaska (statewide)', state: 'AK', region: 'us-west',
    verified: true, kind: 'rest',
    // Alaska Statewide Parcels (DNR aggregate of borough data). Direct owner +
    // total_value; only Web-Mercator Shape__Area (heavily distorted at AK
    // latitudes) so acres not reported.
    url: 'https://services1.arcgis.com/7HDiw78fcUiM2BWn/arcgis/rest/services/AK_Parcels/FeatureServer/0',
    bbox: [-170.0, 51.0, -129.0, 71.6],
    fieldMap: { id: ['parcel_id', 'feature_id', 'OBJECTID'], acres: [], owner: ['owner', 'alt_owner'], value: ['total_value'] }
  },

  // ===================================================================
  // STATES INVESTIGATED — no free statewide service (2026-06-12)
  // ===================================================================
  // Documented so the Coverage modal shows we looked. Each was live-checked;
  // re-run the research if a state publishes an official statewide layer.
  'pa-coming-soon': {
    label: 'Pennsylvania', state: 'PA', region: 'us-northeast', comingSoon: true,
    bbox: [-80.6, 39.7, -74.6, 42.4],
    skipReason: 'No single statewide-complete free service. Best is PA DEP PA_Parcels (~4.69M, 43 of 67 counties, rich fields) or PASDA (~4.40M, thin fields) — both partial county aggregates, neither all 67 counties.'
  },
  'ga-coming-soon': {
    label: 'Georgia', state: 'GA', region: 'us-south', comingSoon: true,
    bbox: [-85.7, 30.3, -80.8, 35.1],
    skipReason: 'No unified free statewide parcel REST service. GA Geospatial Information Office hub has zero statewide parcel datasets; parcels are county-by-county (159 counties).'
  },
  'ky-coming-soon': {
    label: 'Kentucky', state: 'KY', region: 'us-south', comingSoon: true,
    bbox: [-89.6, 36.4, -81.9, 39.2],
    skipReason: 'No statewide consolidated parcel REST service. KyGovMaps publishes only Webster County live; statewide PVA parcels are download-only (file geodatabase via KyFromAbove).'
  },
  'sc-coming-soon': {
    label: 'South Carolina', state: 'SC', region: 'us-south', comingSoon: true,
    bbox: [-83.4, 32.0, -78.5, 35.3],
    skipReason: 'No free statewide parcel polygon REST service. The only state layer is a 45-feature directory of per-county parcel-viewer links; parcels are county-by-county (46 counties).'
  },
  'ok-coming-soon': {
    label: 'Oklahoma', state: 'OK', region: 'us-south', comingSoon: true,
    bbox: [-103.1, 33.6, -94.4, 37.1],
    skipReason: 'Official statewide parcels are published only as a view-only OGC WMS (no feature/attribute query, no download), so a browser fetch() app cannot pull polygons/attributes.'
  },
  'al-coming-soon': {
    label: 'Alabama', state: 'AL', region: 'us-south', comingSoon: true,
    bbox: [-88.5, 30.1, -84.9, 35.1],
    skipReason: 'No free official statewide parcel layer; parcels are county-level only and the statewide ALDOR aggregation is paid/licensed.'
  },
  'la-coming-soon': {
    label: 'Louisiana', state: 'LA', region: 'us-south', comingSoon: true,
    bbox: [-94.1, 28.9, -88.8, 33.1],
    skipReason: 'No official free statewide parcel REST service; parcels are parish-level (qpublic assessor portals). LAGIC/Atlas/DOTD host no statewide parcel service.'
  },
  'mi-coming-soon': {
    label: 'Michigan', state: 'MI', region: 'us-midwest', comingSoon: true,
    bbox: [-90.5, 41.6, -82.3, 48.3],
    skipReason: 'The statewide MGF Tax Parcels layer is internal-government-use only and absent from the public Open Data REST directory. Public parcels are county-level only.'
  },
  'il-coming-soon': {
    label: 'Illinois', state: 'IL', region: 'us-midwest', comingSoon: true,
    bbox: [-91.6, 36.9, -87.4, 42.6],
    skipReason: 'No statewide Illinois parcel service. Parcel data is published independently per-county and by some municipalities; no state aggregate exists.'
  },
  'ia-coming-soon': {
    label: 'Iowa', state: 'IA', region: 'us-midwest', comingSoon: true,
    bbox: [-96.7, 40.3, -90.1, 43.6],
    skipReason: 'Only a deprecated 2017 statewide snapshot is live (explicitly "not current"); the maintained source is offline and current data is on account-gated iowagisdata.org.'
  },
  'mo-coming-soon': {
    label: 'Missouri', state: 'MO', region: 'us-midwest', comingSoon: true,
    bbox: [-95.8, 35.9, -89.0, 40.7],
    skipReason: 'No statewide all-parcels service. The state server exposes only state-OWNED property parcels; MSDIS distributes county parcels as downloads, not a unified live service.'
  },
  'ks-coming-soon': {
    label: 'Kansas', state: 'KS', region: 'us-midwest', comingSoon: true,
    bbox: [-102.1, 36.9, -94.5, 40.1],
    skipReason: 'DASC ORKA is the statewide viewer but its parcel-polygon ArcGIS instance (services.kansasgis.org/arcgis1) returned HTTP 503 throughout testing — re-verify when it recovers.'
  },
  'sd-coming-soon': {
    label: 'South Dakota', state: 'SD', region: 'us-midwest', comingSoon: true,
    bbox: [-104.1, 42.4, -96.4, 46.0],
    skipReason: 'No statewide parcel service. The SD-BIT open-data hub has zero parcel datasets (only a PLSS reference grid); parcels are county-only with no state aggregation.'
  },
  'or-coming-soon': {
    label: 'Oregon', state: 'OR', region: 'us-west', comingSoon: true,
    bbox: [-124.6, 41.9, -116.4, 46.3],
    skipReason: 'No single queryable statewide layer. The GEOHub "Parcels" entry is a Hub page; the ODF Taxlots service has query disabled (400 "operation not supported") and is split into 36 per-county display layers.'
  },
  'az-coming-soon': {
    label: 'Arizona', state: 'AZ', region: 'us-west', comingSoon: true,
    bbox: [-114.9, 31.3, -109.0, 37.1],
    skipReason: 'AZGeo publishes only State Trust / mineral land parcels (state-owned), not assessor tax parcels. Parcels are county-based (Maricopa, Pima, etc.).'
  },
  'nm-coming-soon': {
    label: 'New Mexico', state: 'NM', region: 'us-west', comingSoon: true,
    bbox: [-109.1, 31.3, -103.0, 37.1],
    skipReason: 'RGIS publishes property-tax districts and land-ownership/PLSS data, not a unified statewide tax-parcel layer with owner/value. Parcels are county-by-county.'
  },
  'ca-coming-soon': {
    label: 'California', state: 'CA', region: 'us-west', comingSoon: true,
    bbox: [-124.5, 32.5, -114.1, 42.1],
    skipReason: 'No free statewide parcel REST endpoint. The only statewide aggregate (ICE/UC Davis) is a downloadable snapshot, not a live service; ~13M parcels are published per-county (58 counties) or via paid vendors.'
  },

  // ===================================================================
  // METRO COUNTIES in no-statewide states (2026-06-13 gap-fill)
  // ===================================================================
  // Top metros wired individually where no free statewide service exists.
  // Each live-verified + adversarially re-verified; same fieldMap/derive
  // contract as the statewide entries.
  'la-county-ca': {
    label: 'Los Angeles County, CA', state: 'CA', region: 'ca-counties',
    verified: true, kind: 'rest',
    url: 'https://arcgis.gis.lacounty.gov/arcgis/rest/services/DRP/GISNET_Public/MapServer/333',
    bbox: [-118.95, 32.8, -117.65, 34.82],
    fieldMap: { id: ['APN', 'AIN', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape.STArea()'), value: sumValueFields('Roll_LandValue', 'Roll_ImpValue') }
  },
  'san-diego-ca': {
    label: 'San Diego County, CA', state: 'CA', region: 'ca-counties',
    verified: true, kind: 'rest',
    url: 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0',
    bbox: [-117.61, 32.53, -116.08, 33.51],
    fieldMap: { id: ['apn', 'apn_8', 'parcelid', 'objectid'], acres: ['acreage'], owner: [], value: ['asr_total', 'asr_land'] }
  },
  'orange-ca': {
    label: 'Orange County, CA', state: 'CA', region: 'ca-counties',
    verified: true, kind: 'rest',
    url: 'https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0',
    bbox: [-118.13, 33.39, -117.41, 33.95],
    fieldMap: { id: ['ASSESSMENT_NO', 'OBJECTID'], acres: [], owner: [], value: [] }
  },
  'cook-il': {
    label: 'Cook County, IL', state: 'IL', region: 'il-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.cookcountyil.gov/traditional/rest/services/CookViewer3Dynamic/MapServer/2025',
    bbox: [-88.2635, 41.4694, -87.5241, 42.1542],
    fieldMap: { id: ['PIN10', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape_Area') }
  },
  'dupage-il': {
    label: 'DuPage County, IL', state: 'IL', region: 'il-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.dupageco.org/arcgis/rest/services/DuPage_County_IL/ParcelsWithRealEstateCC/FeatureServer/0',
    bbox: [-88.2017, 41.6517, -87.7896, 42.0233],
    fieldMap: { id: ['PIN', 'OBJECTID'], acres: ['ACREAGE'], owner: ['BILLNAME', 'MAJOR_PROPERTY_OWNER'], value: ['REA017_FCV_TOTAL', 'BILLVALUE'] }
  },
  'lake-il': {
    label: 'Lake County, IL', state: 'IL', region: 'il-counties',
    verified: true, kind: 'rest',
    url: 'https://maps.lakecountyil.gov/arcgis/rest/services/GISMapping/WABParcels/MapServer/12',
    bbox: [-88.1986, 42.1538, -87.779, 42.4969],
    fieldMap: { id: ['PIN', 'OBJECTID'], acres: ['CALCACRE', 'lot_area_acres'], owner: ['taxpayer_name', 'taxpayer_org_name'], value: ['assess_total_taxyr', 'assess_total_assyr'] }
  },
  'fulton-ga': {
    label: 'Fulton County, GA', state: 'GA', region: 'ga-counties',
    verified: true, kind: 'rest',
    url: 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels/FeatureServer/0',
    bbox: [-84.86, 33.49, -84.21, 34.21],
    fieldMap: { id: ['ParcelID', 'FeatureID', 'OBJECTID'], acres: ['LandAcres'], owner: ['Owner'], value: [] }
  },
  'gwinnett-ga': {
    label: 'Gwinnett County, GA', state: 'GA', region: 'ga-counties',
    verified: true, kind: 'rest',
    url: 'https://gis3.gwinnettcounty.com/mapvis/rest/services/CRM/GC_CRM/MapServer/10',
    bbox: [-84.21, 33.81, -83.78, 34.11],
    fieldMap: { id: ['PIN', 'TAXPIN', 'LRSN', 'OBJECTID'], acres: ['DEEDEDACREAGE', 'CALCULATEDACREAGE'], owner: [], value: [] }
  },
  'cobb-ga': {
    label: 'Cobb County, GA', state: 'GA', region: 'ga-counties',
    verified: true, kind: 'rest',
    url: 'https://services.arcgis.com/HYLRafMc4Ux6DA8c/arcgis/rest/services/CobbParcels/FeatureServer/0',
    bbox: [-84.741, 33.743, -84.374, 34.082],
    fieldMap: { id: ['PARCEL_ID', 'PIN', 'PARCEL_ID2', 'FOID', 'FID'], acres: ['ACRE_CALC', 'ACRE_DEEDE'], owner: [], value: [] }
  },
  'oakland-mi': {
    label: 'Oakland County, MI', state: 'MI', region: 'mi-counties',
    verified: true, kind: 'rest',
    url: 'https://gisservices.oakgov.com/arcgisds/rest/services/Hosted/Tax_Parcel_2025/FeatureServer/0',
    bbox: [-83.72, 42.42, -83.05, 42.9],
    fieldMap: { id: ['keypin', 'objectid'], acres: ['acres', 'acresrecorded'], owner: [], value: [] }
  },
  'kent-mi': {
    label: 'Kent County, MI', state: 'MI', region: 'mi-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.kentcountymi.gov/agisprod/rest/services/OpenData/Parcel_Related_Layers/MapServer/0',
    bbox: [-85.8, 42.76, -85.3, 43.3],
    fieldMap: { id: ['PNUM', 'OBJECTID'], acres: ['ACREAGE'], owner: [], value: [] }
  },
  'wayne-mi': {
    label: 'Wayne County, MI', state: 'MI', region: 'mi-counties', comingSoon: true,
    bbox: [-83.6, 42, -82.83, 42.46],
    skipReason: 'waynecounty.com returns TWO Access-Control-Allow-Origin headers (the origin AND *), which browsers reject as invalid CORS — fetch fails in-browser. Re-test if they fix the duplicate header.'
  },
  'maricopa-az': {
    label: 'Maricopa County, AZ', state: 'AZ', region: 'az-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0',
    bbox: [-113.335, 32.6955, -111.0818, 34.0469],
    fieldMap: { id: ['APN_DASH', 'APN', 'OBJECTID'], acres: [], owner: ['OWNER_NAME'], value: ['FCV_CUR', 'LPV_CUR'] },
    derive: { acres: acresFromSqFt('LAND_SIZE') }
  },
  'pima-az': {
    label: 'Pima County, AZ', state: 'AZ', region: 'az-counties',
    verified: true, kind: 'rest',
    url: 'https://gisdata.pima.gov/arcgis1/rest/services/GISOpenData/LandRecords/MapServer/12',
    bbox: [-113.3416, 31.419, -110.4397, 32.5225],
    fieldMap: { id: ['PARCEL', 'OBJECTID'], acres: ['GISACRES', 'LANDMEAS'], owner: ['MAIL1'], value: ['FCV', 'LIMNET'] }
  },
  'pinal-az': {
    label: 'Pinal County, AZ', state: 'AZ', region: 'az-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3',
    bbox: [-112.2068, 32.4932, -110.433, 33.4689],
    fieldMap: { id: ['PARCELID', 'OBJECTID'], acres: ['GROSSAC'], owner: ['OWNERNME1', 'OWNERNME2'], value: ['CNTASSDVAL', 'LNDVALUE'] }
  },
  'st-louis-county-mo': {
    label: 'St. Louis County, MO', state: 'MO', region: 'mo-counties',
    verified: true, kind: 'rest',
    url: 'https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0',
    bbox: [-90.74, 38.42, -90.16, 38.78],
    fieldMap: { id: ['LOCATOR', 'PARENT_LOC', 'OBJECTID'], acres: ['ACRES'], owner: ['OWNER_NAME'], value: ['TOTAPVAL', 'TOTASSMT'] }
  },
  'jackson-mo': {
    label: 'Jackson County, MO', state: 'MO', region: 'mo-counties',
    verified: true, kind: 'rest',
    url: 'https://jcgis.jacksongov.org/arcgis/rest/services/ParcelViewer/ParcelsAscendRelate/FeatureServer/1',
    bbox: [-94.61, 38.83, -94.1, 39.32],
    fieldMap: { id: ['parcel_id', 'PID', 'NID', 'OBJECTID'], acres: ['Acres'], owner: [], value: [] }
  },
  'st-charles-mo': {
    label: 'St. Charles County, MO', state: 'MO', region: 'mo-counties',
    verified: true, kind: 'rest',
    // Layer index moved /0 → /2 when the county rebuilt this AGOL service
    // (2026-07-02); the old /0 now 400s "Invalid URL". Rich CAMA incl. owner,
    // TotalMarketValue, and sales history. Parcel_Acres is 0 on many small city
    // lots, so acres are derived from Shape__Area (State Plane MO-East ftUS →
    // sqft, survives outSR-less geojson) for a real value on every parcel.
    url: 'https://services1.arcgis.com/YuFpgTDhSxjvnQtm/arcgis/rest/services/Parcels/FeatureServer/2',
    bbox: [-90.9671, 38.5358, -90.1106, 38.9676],
    fieldMap: { id: ['Parcel_ID', 'Account', 'OBJECTID'], acres: [], owner: ['Owner', 'PrevOwner1'], value: ['TotalMarketValue'] },
    derive: { acres: acresFromSqFt('Shape__Area') }
  },
  'multnomah-or': {
    label: 'Multnomah County, OR', state: 'OR', region: 'or-counties',
    verified: true, kind: 'rest',
    url: 'https://www3.multco.us/gisagspublic/rest/services/DART/Taxlots_Orion_Public/MapServer/0',
    bbox: [-122.92924, 45.43261, -121.81968, 45.72869],
    fieldMap: { id: ['MAPTAXLOT', 'PROPID', 'ALTACCTNUM', 'OBJECTID_1'], acres: ['SIZEACRES'], owner: ['NAME', 'NAME2'], value: ['ROLLM50', 'ROLLMAV'] }
  },
  'washington-or': {
    label: 'Washington County, OR', state: 'OR', region: 'or-counties',
    verified: true, kind: 'rest',
    url: 'https://gispub.co.washington.or.us/server/rest/services/AT_Cartog/Washington_County_Addresses_and_Taxlots/MapServer/1',
    bbox: [-123.50419, 45.3025, -122.73598, 45.79303],
    fieldMap: { id: ['TLNO', 'MAPNO', 'TLNO5', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape.STArea()') }
  },
  'lane-or': {
    label: 'Lane County, OR', state: 'OR', region: 'or-counties',
    verified: true, kind: 'rest',
    url: 'https://lcmaps.lanecounty.org/arcgis/rest/services/PlanMaps/AddressParcel/MapServer/1',
    bbox: [-124.18424, 43.39447, -121.7543, 44.32678],
    fieldMap: { id: ['MAPTAXLOT', 'RLID', 'TAXMAP', 'PROPACCT', 'OBJECTID'], acres: ['MAPACRES', 'AscendAcres'], owner: ['OWNNAME'], value: ['ASSDTOTVAL', 'TAXABLE_VALUE'] }
  },
  'jefferson-ky': {
    label: 'Jefferson County, KY', state: 'KY', region: 'ky-counties',
    verified: true, kind: 'rest',
    url: 'https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/New_AllParcels/FeatureServer/0',
    bbox: [-85.952, 37.997, -85.4, 38.385],
    fieldMap: { id: ['ParcelID', 'LRSN', 'FID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape_Area') }
  },
  'fayette-ky': {
    label: 'Fayette County, KY', state: 'KY', region: 'ky-counties',
    verified: true, kind: 'rest',
    url: 'https://maps.lexingtonky.gov/lfucggis/rest/services/property/MapServer/1',
    bbox: [-84.66, 37.84, -84.28, 38.211],
    fieldMap: { id: ['PVANUM', 'OBJECTID'], acres: ['PVA_ACRE'], owner: [], value: [] }
  },
  'kenton-ky': {
    label: 'Kenton County, KY', state: 'KY', region: 'ky-counties',
    verified: true, kind: 'rest',
    url: 'https://maps.linkgis.org/server/rest/services/Parcel_QueryOnly/MapServer/1',
    bbox: [-84.628, 38.783, -84.417, 39.097],
    fieldMap: { id: ['PIDN', 'OBJECTID'], acres: ['ACREAGE', 'GIS_Acreage'], owner: ['OWNER', 'OWNER_NAME', 'OWNER2'], value: [] }
  },
  'greenville-sc': {
    label: 'Greenville County, SC', state: 'SC', region: 'sc-counties',
    verified: true, kind: 'rest',
    url: 'https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/23',
    bbox: [-82.7642, 34.4844, -82.1466, 35.2155],
    fieldMap: { id: ['PIN', 'OBJECTID'], acres: ['GIS_ACRES', 'TACRES'], owner: ['OwnerAll', 'OWNAM1', 'OWNAM2'], value: ['FAIRMKTVAL', 'TAXMKTVAL'] }
  },
  'richland-sc': {
    label: 'Richland County, SC', state: 'SC', region: 'sc-counties',
    verified: true, kind: 'rest',
    url: 'https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/40',
    bbox: [-81.3457, 33.7434, -80.5978, 34.2705],
    fieldMap: { id: ['TMS', 'PARCELNO', 'OBJECTID_1'], acres: ['Acres', 'acreage'], owner: ['OwnerAll', 'NAME1', 'NAME2'], value: ['TotalMarket', 'Taxable_Va'] }
  },
  'charleston-sc': {
    label: 'Charleston County, SC', state: 'SC', region: 'sc-counties',
    verified: true, kind: 'rest',
    url: 'https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/10',
    bbox: [-80.4528, 32.4933, -79.2684, 33.2147],
    fieldMap: { id: ['PARCEL_ID', 'OBJECTID'], acres: ['ACREAGE', 'ACRES_CAL'], owner: ['OwnerAll', 'OWNER1', 'OWNER2'], value: ['APPRAISAL'] }
  },
  'oklahoma-county-ok': {
    label: 'Oklahoma County, OK', state: 'OK', region: 'ok-counties',
    verified: true, kind: 'rest',
    url: 'https://services8.arcgis.com/euhkr1dAJeQBIjV0/arcgis/rest/services/TaxParcelsPublics_view/FeatureServer/0',
    bbox: [-97.6754, 35.3773, -97.1384, 35.7244],
    fieldMap: { id: ['pin', 'accountno', 'propertyid', 'OBJECTID'], acres: ['acres'], owner: ['name1', 'name2', 'name3'], value: ['currentmarket', 'currentassessed'] }
  },
  'tulsa-ok': {
    label: 'Tulsa County, OK', state: 'OK', region: 'ok-counties',
    verified: true, kind: 'rest',
    url: 'https://map11.incog.org/arcgis11wa/rest/services/Parcels_TulsaCo/FeatureServer/0',
    bbox: [-96.298, 35.8561, -95.7616, 36.4237],
    fieldMap: { id: ['ParcelNo', 'AccountNo', 'ACCT_NUM', 'OBJECTID'], acres: ['GrossAcre'], owner: ['Owner', 'Name1', 'Name2'], value: ['TotalAcctValue'] }
  },
  'cleveland-ok': {
    label: 'Cleveland County, OK', state: 'OK', region: 'ok-counties',
    verified: true, kind: 'rest',
    // FIXED 2026-07-02: the previous URL (gis.clevelandcounty.com) is Cleveland
    // County NORTH CAROLINA (SR wkid:2264 NC State Plane; returns 0 features
    // anywhere in Oklahoma) — a wrong-state mistake. Now points at the official
    // Cleveland County OK Assessor's AGOL org (CCAO), joined tax parcels.
    url: 'https://services1.arcgis.com/kxHJSF07PF5lbQ3z/arcgis/rest/services/ClevelandTaxParcelsJune2026/FeatureServer/0',
    bbox: [-97.67, 34.85, -97.12, 35.4],
    fieldMap: { id: ['ParcelID', 'GISKey', 'OBJECTID'], acres: ['TotalLandArea', 'TotalArea', 'calculatedarea'], owner: ['OwnerNameFormatted', 'Owner1', 'Owner2'], value: ['TotalValue', 'TotalAssessedValue'] }
  },
  'jefferson-al': {
    label: 'Jefferson County, AL', state: 'AL', region: 'al-counties',
    verified: true, kind: 'rest',
    url: 'https://jccgis.jccal.org/server/rest/services/Basemap/Parcels/MapServer/0',
    bbox: [-87.3419, 33.2431, -86.5115, 34.0084],
    fieldMap: { id: ['PARCELID', 'PID', 'ParcelNo', 'Unique_ID', 'OBJECTID'], acres: ['GIS_ACRES', 'ACRES_APR', 'PriAcreage'], owner: ['OWNERNAME', 'Name2'], value: ['AssdValue'] }
  },
  'mobile-al': {
    label: 'Mobile County, AL', state: 'AL', region: 'al-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.mobilecountyal.gov/server/rest/services/Development/MapServer/20',
    bbox: [-88.4238, 30.2053, -87.9282, 31.1735],
    fieldMap: { id: ['Parcel_Number', 'ParcelNo', 'PID', 'Account_Number', 'OBJECTID'], acres: ['StatedArea', 'PriAcreage'], owner: ['Name1', 'Name2', 'Corporation'], value: ['TotalValue', 'ApprValue', 'AssdValue'] }
  },
  'madison-al': {
    label: 'Madison County, AL', state: 'AL', region: 'al-counties',
    verified: true, kind: 'rest',
    url: 'https://maps.huntsvilleal.gov/server/rest/services/Boundaries/MadisonCountyParcels/MapServer/1',
    bbox: [-86.7885, 34.4747, -86.2562, 34.9948],
    fieldMap: { id: ['PIN', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape.STArea()') }
  },
  'east-baton-rouge-la': {
    label: 'East Baton Rouge Parish, LA', state: 'LA', region: 'la-counties',
    verified: true, kind: 'rest',
    url: 'https://maps.brla.gov/gis/rest/services/Cadastral/Tax_Parcel/MapServer/0',
    bbox: [-91.34, 30.3, -90.92, 30.74],
    fieldMap: { id: ['ASSESSMENT_NUM', 'PRONO', 'ID'], acres: [], owner: ['OWNER'], value: ['SUM_ASSESSED_VALUE', 'SUM_FAIR_MARKET_VALUE'] }
  },
  'orleans-la': {
    label: 'Orleans Parish, LA', state: 'LA', region: 'la-counties', comingSoon: true,
    bbox: [-90.14, 29.86, -89.62, 30.18],
    skipReason: 'gis.nola.gov MapServer returns HTTP 200 + error 400 "Failed to execute query" for f=geojson requests (the format the app uses), so it renders no parcels. Re-test if the server adds geojson support.'
  },
  'jefferson-parish-la': {
    label: 'Jefferson Parish, LA', state: 'LA', region: 'la-counties',
    // DEMOTED 2026-07-02. The parcels layer (JPFeatures2025/FeatureServer/8) is
    // server-side broken: every query returns error 400 "Unable to complete
    // operation … Version 'SDE.DEFAULT' is not accessible" (a database/versioning
    // fault on the county's ArcGIS server, not fixable client-side). Separately
    // its TLS chain omits the AIA intermediate (Node-only failure). Louisiana
    // stays covered by East Baton Rouge. Re-promote if the county fixes the SDE
    // version — the old fieldMap was id:SCD, acres:acresFromSqFt('SFT').
    comingSoon: true,
    skipReason: "eweb.jeffparish.net parcels layer returns error 400 \"Version 'SDE.DEFAULT' is not accessible\" for every query (county-side database fault). East Baton Rouge covers LA meanwhile.",
    bbox: [-90.42, 29.5, -89.96, 30.18]
  },
  'polk-ia': {
    label: 'Polk County, IA', state: 'IA', region: 'ia-counties', comingSoon: true,
    bbox: [-93.82, 41.46, -93.21, 41.86],
    skipReason: 'gis4.polkcountyiowa.gov returns HTTP 403 (WAF) to browser/audit requests and the in-browser fetch fails. Re-test if the WAF rule is relaxed.'
  },
  'linn-ia': {
    label: 'Linn County, IA', state: 'IA', region: 'ia-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.linncountyiowa.gov/ags/rest/services/Planning/mapBSAViewer/MapServer/59',
    bbox: [-91.81, 41.74, -91.32, 42.33],
    fieldMap: { id: ['GPN', 'OBJECTID'], acres: ['Acres'], owner: ['OwnerDeed', 'OwnerContract'], value: ['ValueTotal', 'ValueAssessedTotal'] }
  },
  'scott-ia': {
    label: 'Scott County, IA', state: 'IA', region: 'ia-counties',
    verified: true, kind: 'rest',
    url: 'https://services.arcgis.com/ovln19YRWV44nBqV/arcgis/rest/services/Cadastral/FeatureServer/3',
    bbox: [-90.91, 41.42, -90.31, 41.78],
    fieldMap: { id: ['PIN', 'AlternateID', 'Parent_PIN', 'OBJECTID'], acres: ['Net_AC', 'Gross_AC'], owner: ['DeedHold', 'DeedHold2', 'MailName'], value: ['TotVal', 'LandVal'] }
  },
  'sedgwick-ks': {
    label: 'Sedgwick County, KS', state: 'KS', region: 'ks-counties',
    verified: true, kind: 'rest',
    url: 'https://gismaps.sedgwickcounty.org/arcgis/rest/services/Map/Op_Parcel_Dynamic_SP/MapServer/0',
    bbox: [-97.82, 37.47, -97.13, 37.92],
    fieldMap: { id: ['PIN', 'AIN', 'GEOCODE', 'OBJECTID'], acres: ['ParcAcresC'], owner: [], value: [] }
  },
  'shawnee-ks': {
    label: 'Shawnee County, KS', state: 'KS', region: 'ks-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.sncoapps.us/arcgis2/rest/services/Parcels/MapServer/0',
    bbox: [-95.95, 38.85, -95.49, 39.23],
    fieldMap: { id: ['QUICKREFID', 'PIN', 'PID', 'PARCELNUM', 'OBJECTID'], acres: ['ACRES'], owner: ['ONAME', 'MAILNAME'], value: ['TOTVAL'] }
  },
  'pennington-sd': {
    label: 'Pennington County, SD', state: 'SD', region: 'sd-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.rcgov.org/server/rest/services/OpenData/TaxParcels/FeatureServer/0',
    bbox: [-104.0555, 43.6846, -102.0011, 44.514],
    fieldMap: { id: ['PIN', 'TaxID', 'OBJECTID'], acres: ['Acres'], owner: ['GranteeLastName', 'Grantee1stName'], value: ['ValueTotal', 'ValueLand'] }
  },
  'lincoln-sd': {
    label: 'Lincoln County, SD', state: 'SD', region: 'sd-counties', comingSoon: true,
    bbox: [-96.9249, 43.0835, -96.4366, 43.5005],
    skipReason: 'gis.lincolncountysd.gov is behind a Cloudflare bot challenge (HTTP 403 "Just a moment...") — not reachable from a static web app.'
  },
  'bernalillo-nm': {
    label: 'Bernalillo County, NM', state: 'NM', region: 'nm-counties',
    verified: true, kind: 'rest',
    url: 'https://coageo.cabq.gov/cabqgeo/rest/services/agis/AGIS_Platted_Parcels/MapServer/0',
    bbox: [-107.2, 34.86, -106.15, 35.22],
    fieldMap: { id: ['PIN', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape.STArea()') }
  },
  'dona-ana-nm': {
    label: 'Dona Ana County, NM', state: 'NM', region: 'nm-counties',
    verified: true, kind: 'rest',
    url: 'https://gis.donaana.gov/server/rest/services/Parcels/FeatureServer/0',
    bbox: [-107.3, 31.78, -106.3, 33],
    fieldMap: { id: ['PARCELNUMBER', 'MAP_CODE', 'ACCOUNTNUMBER', 'OBJECTID'], acres: ['TOTALACRES'], owner: ['OWNERNAME', 'DEEDHOLDER', 'CAREOFNAME'], value: ['TOTALVALUE', 'LANDVALUE'] }
  },
  'johnson-county-ks': {
    label: 'Johnson County, KS', state: 'KS', region: 'ks-counties', comingSoon: true,
    bbox: [-95.06, 38.67, -94.6, 39],
    skipReason: 'No free public county-wide parcel polygon REST service; only a city subset surfaced. Johnson County AIMS parcels are not exposed as an open queryable layer.'
  },
  'minnehaha-sd': {
    label: 'Minnehaha County, SD', state: 'SD', region: 'sd-counties', comingSoon: true,
    bbox: [-96.85, 43.42, -96.45, 43.86],
    skipReason: 'County GIS endpoint is WAF-blocked to non-browser clients (HTTP 403 WAF page, no CORS header) — not usable from a static web app.'
  },
  'santa-fe-nm': {
    label: 'Santa Fe County, NM', state: 'NM', region: 'nm-counties', comingSoon: true,
    bbox: [-106.4, 35.13, -105.5, 35.95],
    skipReason: 'County parcel REST endpoint sends no Access-Control-Allow-Origin header, so browsers block the cross-origin fetch.'
  },

  // ---------- Pennsylvania county gap-fills ----------
  // PA is covered statewide by pa-statewide (PA DEP) EXCEPT 7 counties that
  // return 0 there. These 5 fill the gaps with the county's own official REST;
  // Luzerne + Erie have no usable public countywide polygon endpoint (below).
  // All verified 2026-07-02: f=geojson returns WGS84 geometry, no token, CORS
  // origin-echoes nfruits.github.io.
  'delaware-county-pa': {
    label: 'Delaware County, PA', state: 'PA', region: 'pa-counties',
    verified: true, kind: 'rest',
    // Public-access layer (assessed value stripped, like MD/DE public views).
    // CALCULATED is acres (matches spherical-excess); OWNCAT carries owner name.
    url: 'https://gis.delcopa.gov/arcgis/rest/services/Parcels/Parcels_Public_Access/FeatureServer/0',
    bbox: [-75.61, 39.79, -75.27, 40.02],
    fieldMap: { id: ['PIN', 'PARID', 'OBJECTID'], acres: ['CALCULATED'], owner: ['OWNCAT'], value: [] }
  },
  'york-pa': {
    label: 'York County, PA', state: 'PA', region: 'pa-counties',
    verified: true, kind: 'rest',
    // York County Planning Commission open data. Rich CAMA: OWNER_FULL,
    // APRTOTAL (appraised total value), ACRES direct, PIDN.
    url: 'https://arcweb1.ycpc.org/server/rest/services/OPEN_DATA/Parcels/FeatureServer/0',
    bbox: [-77.05, 39.72, -76.35, 40.28],
    fieldMap: { id: ['PIDN', 'OBJECTID'], acres: ['ACRES'], owner: ['OWNER_FULL', 'OWN_NAME1'], value: ['APRTOTAL'] }
  },
  'lackawanna-pa': {
    label: 'Lackawanna County, PA', state: 'PA', region: 'pa-counties',
    verified: true, kind: 'rest',
    // County GIS (Scranton). ASSESSEDACRES direct; TOTALVALUE is pre-summed.
    url: 'https://gis.lackawannacounty.org/arcgis/rest/services/GISViewer/Parcels/FeatureServer/0',
    bbox: [-75.98, 41.24, -75.42, 41.63],
    fieldMap: { id: ['PIN', 'PRMAP', 'OBJECTID'], acres: ['ASSESSEDACRES'], owner: ['OWNERNAME'], value: ['TOTALVALUE'] }
  },
  'butler-pa': {
    label: 'Butler County, PA', state: 'PA', region: 'pa-counties',
    verified: true, kind: 'rest',
    // County PAT parcels. AssessedValue is the pre-summed total. No acres field:
    // Shape__Area is State Plane PA-North US-ft → sqft (verified vs geometry).
    url: 'https://geo.co.butler.pa.us/server/rest/services/PAT/ParcelAndBoundary/FeatureServer/0',
    bbox: [-80.19, 40.62, -79.69, 41.17],
    fieldMap: { id: ['PIN', 'Parid', 'OBJECTID'], acres: [], owner: ['Owner'], value: ['AssessedValue'] },
    derive: { acres: acresFromSqFt('Shape__Area') }
  },
  'washington-pa': {
    label: 'Washington County, PA', state: 'PA', region: 'pa-counties',
    verified: true, kind: 'rest',
    // PASDA-hosted county parcels (official PA state host; county Tax-Revenue
    // data). Geometry + PIN only; Shape_Area is sqft (verified vs geometry).
    url: 'https://mapservices.pasda.psu.edu/server/rest/services/pasda/WashingtonCounty/MapServer/7',
    bbox: [-80.52, 39.72, -79.87, 40.44],
    fieldMap: { id: ['PIN', 'PINnoDash', 'OBJECTID'], acres: [], owner: [], value: [] },
    derive: { acres: acresFromSqFt('Shape_Area') }
  },
  'luzerne-pa': {
    label: 'Luzerne County, PA', state: 'PA', region: 'pa-counties', comingSoon: true,
    bbox: [-76.33, 40.93, -75.53, 41.45],
    skipReason: "County TAX PARCELS layer returns null geometry on /query (geometry served only via MapServer identify); no alternate countywide polygon FeatureServer, and the PA DEP statewide layer has 0 Luzerne parcels."
  },
  'erie-pa': {
    label: 'Erie County, PA', state: 'PA', region: 'pa-counties', comingSoon: true,
    bbox: [-80.52, 41.6, -79.61, 42.28],
    skipReason: "No official countywide parcel FeatureServer — gis.erie.pa.us publishes only a City-of-Erie parcel layer, and the PA DEP statewide layer has 0 Erie parcels. Only a third-party AGOL scrape exists (not used)."
  },
};

export const DEFAULT_PARCEL_COUNTY = 'md-statewide';

// All counties that should be queried at runtime. Order doesn't matter — the
// runtime filters by bbox before querying any given source.
export const ACTIVE_PARCEL_COUNTIES = [
  'md-statewide',
  'fairfax-va',
  'arlington-va',
  'loudoun-va',
  'prince-william-va',
  'stafford-va',
  'manassas-city-va',
  'falls-church-city-va',
  'chesterfield-va',
  'richmond-city-va',
  'goochland-va',
  'charlottesville-city-va',
  'fauquier-va',
  'new-kent-va',
  'hanover-va',
  'virginia-beach-city-va',
  'portsmouth-city-va',
  'york-va',
  'james-city-va',
  'winchester-city-va',
  'page-va',
  'harrisonburg-city-va',
  'salem-city-va',
  'lynchburg-city-va',
  'campbell-va',
  'pittsylvania-va',
  'isle-of-wight-va',
  'westmoreland-va',
  'northumberland-va',
  'lancaster-va',
  'richmond-county-va',
  // Statewide services (2026-06-12 nationwide expansion) — 31 states
  'nj-statewide', 'ny-statewide', 'ct-statewide', 'ri-statewide', 'ma-statewide',
  'vt-statewide', 'nh-statewide', 'me-statewide',
  'de-statewide', 'wv-statewide', 'nc-statewide', 'tn-statewide', 'fl-statewide',
  'tx-statewide', 'ar-statewide', 'ms-statewide',
  'oh-statewide', 'wi-statewide', 'mn-statewide', 'in-statewide', 'nd-statewide', 'ne-statewide',
  'mt-statewide', 'ut-statewide', 'wy-statewide', 'co-statewide', 'wa-statewide',
  'id-statewide', 'nv-statewide', 'hi-statewide', 'ak-statewide',
  'pa-statewide', // PA DEP statewide (2026-07-02) — the 33rd statewide; completes 50/50 states
  // Metro counties in no-statewide states (2026-06-13)
  'la-county-ca', 'san-diego-ca', 'orange-ca', 'cook-il', 'dupage-il', 'lake-il', 'fulton-ga', 'gwinnett-ga', 'cobb-ga', 'oakland-mi', 'kent-mi', 'maricopa-az', 'pima-az', 'pinal-az', 'st-louis-county-mo', 'jackson-mo', 'st-charles-mo', 'multnomah-or', 'washington-or', 'lane-or', 'jefferson-ky', 'fayette-ky', 'kenton-ky', 'greenville-sc', 'richland-sc', 'charleston-sc', 'oklahoma-county-ok', 'tulsa-ok', 'cleveland-ok', 'jefferson-al', 'mobile-al', 'madison-al', 'east-baton-rouge-la', 'linn-ia', 'scott-ia', 'sedgwick-ks', 'shawnee-ks', 'pennington-sd', 'bernalillo-nm', 'dona-ana-nm',
  // Pennsylvania county gap-fills (2026-07-02) — counties the PA DEP statewide layer misses
  'delaware-county-pa', 'york-pa', 'lackawanna-pa', 'butler-pa', 'washington-pa'
];

// Runtime auto-verification. When a fetch succeeds with non-zero features
// from a verified:false county, write a localStorage flag so the Coverage
// modal flips the badge from "Untested" to "Verified" without a code change.
export const COUNTY_VERIFIED_STORAGE_PREFIX = 'parcel.county.verified.';

export const TILE_FAILURE_THRESHOLD = 5;

export const OVERLAY_LABELS = {
  flood: 'Flood',
  wetlands: 'Wetlands',
  contours: 'Contours',
  soil: 'Soil',
  parcels: 'Parcels'
};

// Admin-boundary endpoints. Mix of Esri Living Atlas (state/county — CORS-
// friendly, returns GeoJSON cleanly) and US Census TIGERweb (Places +
// Transportation — still works for those tiers). All free, no token.
//
// Why Living Atlas instead of TIGERweb for State/County: TIGERweb's WAF
// rejects any /query that includes `returnGeometry=true`, returning a
// `text/html` "Request Rejected" page with NO CORS headers — which the
// browser surfaces as the "Cross-Origin Request Blocked" error from the
// 2026-05-16 session. Living Atlas's USA_States_Generalized_Boundaries and
// USA_Counties_Generalized_Boundaries both send `Access-Control-Allow-Origin:
// *` and tolerate the same query shape. Path B (bundle GeoJSON as a static
// asset) was considered but state+county at this generalisation level is
// ~3.5MB total — too heavy to commit. The existing 7-day localStorage cache
// already makes pan/zoom fully local after first activation.
const LIVING_ATLAS_STATES = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_States_Generalized_Boundaries/FeatureServer';
const LIVING_ATLAS_COUNTIES = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Counties_Generalized_Boundaries/FeatureServer';
const TIGERWEB_PLACES = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer';
const TIGERWEB_TRANSPORT = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer';

// Each admin layer is independently toggleable. minZoom is enforced as a soft
// gate: toggling on at a lower zoom records intent + surfaces a toast hint;
// the layer materialises automatically once the user zooms in far enough.
//
// Two renderers:
//   - 'feature': bbox-filtered FeatureServer-style /query → GeoJSON, rendered
//                as Leaflet polylines with a tier-specific stroke colour.
//                Used for States/Counties/Places so the client controls colour.
//   - 'tile':    classic ArcGIS /export image tiles, server-rendered. Used
//                for Streets/Transportation where the server's default neutral
//                grey is exactly what we want anyway.
//
// `featureLayer` is the TIGERweb sub-layer index whose generalisation level
// matches a comfortable rendering LOD for the tier across all zooms (state
// outlines never need pixel-perfect geometry; lowest-LOD is plenty). At
// higher zooms the geometry visibly polygon-steps but reads fine for context.
//
// `layerIds` (tile renderer) is the FULL ordered stack so the export server
// auto-picks the band for each tile's scale — a single layerId only renders
// inside its narrow band and goes blank elsewhere (the bug fixed in eb90aea).
export const ADMIN_BOUNDARIES = {
  states: {
    label: 'States',  minZoom: 3,  renderer: 'feature',
    restUrl: LIVING_ATLAS_STATES, featureLayer: 0,
    // Living Atlas states layer has STATE_NAME, not NAME — hardcoding
    // outFields=NAME (the prior shape) returns HTTP 200 + JSON error 400
    // and silently renders nothing. Per-layer outFields fixes that.
    outFields: 'STATE_NAME,STATE_ABBR',
    color: '#d63333', weight: 2,   opacity: 0.9
  },
  counties: {
    label: 'Counties', minZoom: 6, renderer: 'feature',
    restUrl: LIVING_ATLAS_COUNTIES, featureLayer: 0,
    // Living Atlas counties layer has 3144 features and a 2000 maxRecordCount,
    // so admin.js needs to paginate via resultOffset until exceededTransferLimit
    // clears. Set paginated: true to opt in.
    paginated: true,
    outFields: 'NAME,STATE_NAME',
    color: '#e8782a', weight: 1.5, opacity: 0.85
  },
  places: {
    label: 'Cities / Places', minZoom: 10, renderer: 'feature',
    restUrl: TIGERWEB_PLACES, featureLayer: 4,
    // TIGERweb Places layer also has NAME — same hardcoded default would
    // have worked, but spell it out for clarity.
    outFields: 'NAME',
    color: '#7b3fbb', weight: 1,   opacity: 0.85
  },
  streets: {
    label: 'Streets & Roads', minZoom: 14, renderer: 'tile',
    restUrl: TIGERWEB_TRANSPORT, layerIds: null, opacity: 0.75
  }
};

export const ADMIN_ATTRIBUTION = 'Esri Living Atlas / US Census TIGERweb';

// Bumped any time the boundary-fetch URL or query shape changes in a way that
// makes prior localStorage caches incompatible. admin.js compares this against
// a stored value at boot and clears all admin.cache.* keys on mismatch. Bump
// this whenever you change ADMIN_BOUNDARIES restUrl/featureLayer/outFields in
// a way that would invalidate existing cached GeoJSON (different field
// presence, different geometry generalisation, etc.).
// Bumped 2026-05-17 (v2 → v3) to evict partial caches produced by the Bug 6
// pagination short-circuit — any cache written before the fix only contains
// the first 2000 alphabetically ordered counties (no MD/VA/WV/TX). Without
// this bump a returning user keeps the broken cache for 7 days.
export const ADMIN_CACHE_VERSION = 3;
export const ADMIN_CACHE_VERSION_STORAGE_KEY = 'admin.cache.version';
export const ADMIN_TOGGLES_STORAGE_KEY = 'admin.toggles';
export const ADMIN_MINZOOM_OVERRIDES_STORAGE_KEY = 'admin.minZoomOverrides';
