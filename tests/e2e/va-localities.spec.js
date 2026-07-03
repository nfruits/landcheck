import { test, expect } from '@playwright/test';

// Per-locality parcel-render assertions added during the 2026-05-16 VA
// coverage expansion. Each entry stubs that locality's REST endpoint with a
// minimal valid FeatureCollection at a point inside the locality's bbox at
// zoom 16, then asserts at least one parcel renders with no HTTP >=400 on
// the locality's host. Failure modes the test guards against:
//   - endpoint URL drift (the test stubs the literal pattern from config)
//   - locality bbox wrong (the test centers at the named coord inside it)
//   - fieldMap picks the wrong field for `id` (verified via the click test)
//
// To add a new locality: add an entry to LOCALITIES below + matching entry
// in config.js's PARCEL_COUNTIES and ACTIVE_PARCEL_COUNTIES. No test code
// change required — the .forEach below generates the test.

const LOCALITIES = [
  // {
  //   key:        county key in PARCEL_COUNTIES
  //   center:     [lat, lng] inside the locality's bbox
  //   urlPattern: glob-style pattern matching the locality's /query URL
  //   hostFrag:   substring used to detect 4xx on the locality's host
  //   idField:    property name the stub uses for the parcel id
  //   idValue:    string the test expects to read out of the fly-out id slot
  //   stubProps:  additional properties to attach to the stub feature
  // }
  {
    key: 'loudoun-va',
    center: [39.0856, -77.5582], // Leesburg
    urlPattern: '**/logis.loudoun.gov/**/LandRecords/MapServer/5/query**',
    hostFrag: 'logis.loudoun.gov',
    idField: 'PA_MCPI',
    idValue: '230-37-1234',
    stubProps: { PA_LEGAL_ACRE: 0.5 }
  },
  {
    key: 'prince-william-va',
    center: [38.7510, -77.4753], // Manassas (Battlefield) area
    urlPattern: '**/gisweb.pwcva.gov/**/Cadastral/MapServer/5/query**',
    hostFrag: 'gisweb.pwcva.gov',
    idField: 'GPIN',
    idValue: '7796-44-1111',
    stubProps: { Acreage: 1.25 }
  },
  {
    key: 'stafford-va',
    center: [38.4221, -77.4083], // Stafford CH
    urlPattern: '**/qKiA6JuCrE2l72iL/**/Parcels/FeatureServer/0/query**',
    hostFrag: 'qKiA6JuCrE2l72iL',
    idField: 'PRCLID',
    idValue: '37-12-A',
    stubProps: {}
  },
  {
    key: 'falls-church-city-va',
    center: [38.8823, -77.1711], // central Falls Church
    urlPattern: '**/2hmXRAz4ofcdQP6p/**/20220412ParcelLayer_view/FeatureServer/0/query**',
    hostFrag: '2hmXRAz4ofcdQP6p',
    idField: 'RPC',
    idValue: '52-217-001',
    stubProps: { Acres: 0.18 }
  },
  {
    key: 'manassas-city-va',
    center: [38.7509, -77.4753], // central Manassas
    urlPattern: '**/3wpOgOChiWXPeFWB/**/Manassas_Parcels/FeatureServer/0/query**',
    hostFrag: '3wpOgOChiWXPeFWB',
    idField: 'TAXMAP',
    idValue: 'M-345-12',
    stubProps: { OWNER_NAME: 'DOE J', LAND_VALUE: 220000, IMPROVEMENT_VALUE: 380000 }
  },
  {
    key: 'chesterfield-va',
    center: [37.3793, -77.5158], // Chesterfield CH
    urlPattern: '**/TsynfzBSE6sXfoLq/**/Cadastral_ProdA/FeatureServer/3/query**',
    hostFrag: 'TsynfzBSE6sXfoLq',
    idField: 'GPIN',
    idValue: '776617492100000',
    stubProps: { OwnerName: 'SMITH FAMILY TRUST', DeededAcres: 2.4 }
  },
  {
    key: 'richmond-city-va',
    center: [37.5407, -77.4360], // downtown Richmond
    urlPattern: '**/k3vhq11XkBNeeOfM/**/Parcels/FeatureServer/0/query**',
    hostFrag: 'k3vhq11XkBNeeOfM',
    idField: 'ParcelID',
    idValue: 'N000-1234-001',
    stubProps: { OwnerName: 'ROE J', TotalValue: 487500, LandSqFt: 4356 }
  },
  {
    key: 'goochland-va',
    center: [37.6788, -77.8825], // Goochland CH
    urlPattern: '**/9Z9r3rLUCq0SjsRb/**/Goochland_County_Parcels___2025/FeatureServer/0/query**',
    hostFrag: '9Z9r3rLUCq0SjsRb',
    idField: 'GPIN',
    idValue: '47-1-12',
    stubProps: { DEED_AC: 12.7 }
  },
  {
    key: 'pittsylvania-va',
    center: [36.8131, -79.3973], // Chatham
    urlPattern: '**/gis.pittgov.org/**/Assessed_Parcels/MapServer/5/query**',
    hostFrag: 'gis.pittgov.org',
    idField: 'Account_Number',
    idValue: '12345',
    stubProps: { Current_Owner_1: 'SMITH JANE', Acreage: 12.4, Total_Tax_Value: 185000 }
  },
  {
    key: 'isle-of-wight-va',
    center: [36.9132, -76.7066], // Smithfield
    urlPattern: '**/Dc6hhMQCpvLlOmSY/**/Parcels/FeatureServer/0/query**',
    hostFrag: 'Dc6hhMQCpvLlOmSY',
    idField: 'TPIN',
    idValue: '40-12-345',
    stubProps: { NAME1: 'WATSON L', TOT_ACR: 3.4, TOT_VAL: 410000 }
  },
  {
    key: 'westmoreland-va',
    center: [38.1126, -76.7986], // Montross
    urlPattern: '**/QHK2l9cSYhemgg5s/**/Westmoreland_Parcels_All/FeatureServer/0/query**',
    hostFrag: 'QHK2l9cSYhemgg5s',
    idField: 'PARCELID',
    idValue: '36-A-12',
    stubProps: {}
  },
  {
    key: 'richmond-county-va',
    center: [37.9476, -76.7253], // Warsaw
    urlPattern: '**/QHK2l9cSYhemgg5s/**/RichmondCounty_Parcels/FeatureServer/0/query**',
    hostFrag: 'RichmondCounty_Parcels',
    idField: 'PARCELID',
    idValue: '14-A-23',
    stubProps: { NAME: 'PARKER J', NACRES: 22.8, LANDVALFM: 95000 }
  },
  {
    key: 'salem-city-va',
    center: [37.2932, -80.0548], // central Salem
    urlPattern: '**/RL8aZgZHmJOdyNXk/**/TaxParcels/FeatureServer/5/query**',
    hostFrag: 'RL8aZgZHmJOdyNXk',
    idField: 'GPIN',
    idValue: '178-04-12',
    stubProps: { owner: 'BLACK J', total_assessment: 285000 }
  },
  {
    key: 'lynchburg-city-va',
    center: [37.4138, -79.1422], // central Lynchburg
    urlPattern: '**/mapviewer.lynchburgva.gov/**/ODPDynamic/MapServer/41/query**',
    hostFrag: 'mapviewer.lynchburgva.gov',
    idField: 'Parcel_ID',
    idValue: '04-1234',
    stubProps: { Owner1: 'CRAWFORD T', Current_Total: 195000 }
  },
  {
    key: 'campbell-va',
    center: [37.2076, -79.0892], // Rustburg
    urlPattern: '**/gis.co.campbell.va.us/**/Parcels/MapServer/7/query**',
    hostFrag: 'gis.co.campbell.va.us',
    idField: 'ACCOUNT',
    idValue: '23-A-12',
    stubProps: {}
  },
  {
    key: 'winchester-city-va',
    center: [39.1857, -78.1633], // central Winchester
    urlPattern: '**/gis.winchesterva.gov/**/Winchester/Parcels/MapServer/0/query**',
    hostFrag: 'gis.winchesterva.gov',
    idField: 'PID',
    idValue: '50A-1-12',
    stubProps: { MLNAM: 'GREEN T', MACRE: 0.34 }
  },
  {
    key: 'page-va',
    center: [38.6649, -78.4598], // Luray
    urlPattern: '**/vzTTDUcNo7s6eLCJ/**/PageCoParcelsAssessment_Pub/FeatureServer/0/query**',
    hostFrag: 'vzTTDUcNo7s6eLCJ',
    idField: 'ACCOUNT',
    idValue: '54-A-12',
    stubProps: { GIS_MLNAM: 'PAGE T', MACRE_Num: 22.5 }
  },
  {
    key: 'harrisonburg-city-va',
    center: [38.4496, -78.8689], // central Harrisonburg
    urlPattern: '**/gis.harrisonburgva.gov/**/Real_Estate_and_Ownership/MapServer/0/query**',
    hostFrag: 'gis.harrisonburgva.gov',
    idField: 'REISParcelID',
    idValue: '08-12-345',
    stubProps: { Owner: 'WHITE S', Acres_GIS: 0.41 }
  },
  {
    key: 'virginia-beach-city-va',
    center: [36.8529, -75.9780], // central VB
    urlPattern: '**/geo.vbgov.com/**/Property_Information/MapServer/12/query**',
    hostFrag: 'geo.vbgov.com',
    idField: 'PAR_GPIN',
    idValue: '1487-22-1234',
    stubProps: {}
  },
  {
    key: 'portsmouth-city-va',
    center: [36.8354, -76.2982], // central Portsmouth
    urlPattern: '**/nGsguNiHLn7MU4R4/**/Parcels_Real_Estate/FeatureServer/3/query**',
    hostFrag: 'nGsguNiHLn7MU4R4',
    idField: 'CPN',
    idValue: '1234567',
    stubProps: { OWNER: 'BROWN R', ACRES: 0.22, TOTAL_VAL: 215000 }
  },
  {
    key: 'york-va',
    center: [37.2375, -76.5093], // Yorktown
    urlPattern: '**/maps.yorkcounty.gov/**/Landrecords_Service/FeatureServer/7/query**',
    hostFrag: 'maps.yorkcounty.gov',
    idField: 'GPIN',
    idValue: 'D04A-12-345',
    stubProps: {}
  },
  {
    key: 'james-city-va',
    center: [37.2707, -76.7075], // Williamsburg-area JCC
    urlPattern: '**/property.jamescitycountyva.gov/**/GIS_Data/FeatureServer/17/query**',
    hostFrag: 'property.jamescitycountyva.gov',
    idField: 'PIN',
    idValue: '4810100012',
    stubProps: {}
  },
  {
    key: 'hanover-va',
    center: [37.7596, -77.3697], // Hanover CH
    urlPattern: '**/sKZWgJlU6SekCzQV/**/Hanover_Parcels/FeatureServer/0/query**',
    hostFrag: 'sKZWgJlU6SekCzQV',
    idField: 'GPIN',
    idValue: '7795-12-3456',
    stubProps: { OWN_NAME1: 'JONES T', LOT_ACRES: 8.4, LAND_VALUE: 145000, IMPROVEMENTS_VALUE: 280000 }
  },
  {
    key: 'new-kent-va',
    center: [37.5079, -76.9839], // New Kent CH
    urlPattern: '**/wRTEaR3VIVeAhJdr/**/Parcels_Vision/FeatureServer/0/query**',
    hostFrag: 'wRTEaR3VIVeAhJdr',
    idField: 'GPIN',
    idValue: 'A12-25-A',
    stubProps: { OWN_NAME1: 'WALKER FAMILY', PRC_TTL_LND_AREA_ACRES: 14.8 }
  },
  {
    key: 'fauquier-va',
    center: [38.7187, -77.7967], // Warrenton
    urlPattern: '**/oAoeYJ1kqmAwcEC2/**/Tax_Parcels_DL/FeatureServer/0/query**',
    hostFrag: 'oAoeYJ1kqmAwcEC2',
    idField: 'PARCELID',
    idValue: '6987-12-3456',
    stubProps: { OWNERNME1: 'SMITH J', ACREAGE: 5.2 }
  },
  {
    key: 'charlottesville-city-va',
    center: [38.0293, -78.4767], // downtown Charlottesville
    urlPattern: '**/gisweb.charlottesville.org/**/OpenData_1/MapServer/72/query**',
    hostFrag: 'gisweb.charlottesville.org',
    idField: 'GeoParcelIdentificationNumber',
    idValue: '530113000',
    stubProps: { OwnerName: 'JOHNSON L', Assessment: 720000, LotSquareFeet: 5800 }
  }
];

function makePolygon(lat, lng) {
  const d = 0.0005;
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d],
      [lng - d, lat + d], [lng - d, lat - d]
    ]]
  };
}

for (const L of LOCALITIES) {
  test(`VA locality: ${L.key} renders at z16 with no 400s`, async ({ page }) => {
    const badStatus = [];
    page.on('response', r => {
      if (r.status() >= 400 && r.url().includes(L.hostFrag)) badStatus.push(r.status() + ' ' + r.url());
    });
    await page.route(L.urlPattern, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { [L.idField]: L.idValue, ...(L.stubProps || {}) },
          geometry: makePolygon(L.center[0], L.center[1])
        }]
      })
    }));
    // Determinism: with 60+ wired counties, the locality's view bbox now
    // overlaps other real endpoints (MD, neighbouring counties) that this test
    // doesn't stub. Empty-stub every OTHER parcel query so the test never
    // depends on a live county server (some hang — that's the fetch-timeout
    // bug this exercised). The locality's own request falls through to the
    // specific stub above. Registered after the specific route, so it runs
    // first and defers via fallback() for the locality host.
    await page.route('**/query**', route => {
      if (route.request().url().includes(L.hostFrag)) return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"type":"FeatureCollection","features":[]}' });
    });
    await page.goto('/app.html?test=1');
    await page.waitForFunction(() => window.__parcel && window.__parcel.parcels);
    await page.evaluate(([la, ln]) => window.__parcel.map.setView([la, ln], 16), L.center);
    const reqPromise = page.waitForRequest(r => r.url().includes(L.hostFrag) && r.url().includes('query'));
    await page.click('.layer[data-layer="parcels"]');
    await reqPromise;
    await page.waitForFunction(() => window.__parcel.parcels.countLoaded() >= 1);
    expect(badStatus).toEqual([]);
  });
}

// Fly-out display assertions for counties that the user reported as not
// showing owner/acreage/value. Each entry stubs the locality's endpoint with
// realistic field names (verified against the live endpoint on 2026-05-17)
// and asserts the Parcel Detail section shows the expected text. This is the
// regression test for the 2026-05-17 fix to the Manassas/Hanover/Lynchburg/
// Charlottesville/Richmond City/Richmond County fieldMap bugs.
const DISPLAY_ASSERTIONS = [
  {
    key: 'manassas-city-va',
    urlPattern: '**/3wpOgOChiWXPeFWB/**/Manassas_Parcels/FeatureServer/0/query**',
    center: [38.7509, -77.4753],
    props: { OBJECTID: 1, OWNER_NAME: 'LANE GWENDOLYN A', TAXMAP: 'M-345-12', LAND_VALUE: 60000, IMPROVEMENT_VALUE: 209000, TOTAL_ASSESSED_VALUE: 269000, TOTAL_ACRES: 0.45 },
    expectOwner: 'LANE GWENDOLYN A',
    expectId: 'M-345-12',
    expectAcresContains: '0.450 ac',
    expectValueContains: '$269,000'
  },
  {
    key: 'richmond-city-va',
    urlPattern: '**/k3vhq11XkBNeeOfM/**/Parcels/FeatureServer/0/query**',
    center: [37.5407, -77.4360],
    props: { ParcelID: 6571, PIN: 'C0010126019', OwnerName: 'Hundley Beverly B', TotalValue: 1194000, LandSqFt: 29620.8 },
    expectOwner: 'Hundley Beverly B',
    expectId: 'C0010126019', // PIN, not numeric ParcelID
    expectAcresContains: 'ac', // ~0.680 ac from 29620.8 / 43560
    expectValueContains: '$1,194,000'
  },
  {
    key: 'charlottesville-city-va',
    urlPattern: '**/gisweb.charlottesville.org/**/OpenData_1/MapServer/72/query**',
    center: [38.0293, -78.4767],
    props: { OBJECTID: 6310, OwnerName: '1001 INVESTMENTS LLC', Assessment: 211800, ParcelNumber: '540137A00', GeoParcelIdentificationNumber: 7684, LotSquareFeet: 984.456 },
    expectOwner: '1001 INVESTMENTS LLC',
    expectId: '540137A00', // ParcelNumber, not numeric GeoParcelIdentificationNumber
    expectAcresContains: 'ac', // ~0.023 ac
    expectValueContains: '$211,800'
  },
  {
    key: 'hanover-va',
    urlPattern: '**/sKZWgJlU6SekCzQV/**/Hanover_Parcels/FeatureServer/0/query**',
    center: [37.7596, -77.3697],
    props: { GPIN: '7795-12-3456', OWN_NAME1: 'JONES TIMOTHY', LOT_ACRES: 8.4, LAND_VALUE: 145000, IMPROVEMENTS_VALUE: 280000 },
    expectOwner: 'JONES TIMOTHY',
    expectId: '7795-12-3456',
    expectAcresContains: '8.400 ac',
    expectValueContains: '$425,000' // sum LAND_VALUE + IMPROVEMENTS_VALUE
  },
  {
    key: 'lynchburg-city-va',
    urlPattern: '**/mapviewer.lynchburgva.gov/**/ODPDynamic/MapServer/41/query**',
    center: [37.4138, -79.1422],
    props: { Parcel_ID: '26606003', Owner1: 'GREENVIEW ASSOCIATES L L C', Current_Total: 59500, LegalAc: 0.34 },
    expectOwner: 'GREENVIEW ASSOCIATES L L C',
    expectId: '26606003',
    expectAcresContains: '0.340 ac',
    expectValueContains: '$59,500'
  },
  {
    key: 'richmond-county-va',
    urlPattern: '**/QHK2l9cSYhemgg5s/**/RichmondCounty_Parcels/FeatureServer/0/query**',
    center: [37.9476, -76.7253],
    props: { PARCELID: '16-15', NAME: 'KELLY OLIVER & CLARA', NACRES: 2.29, LANDVALFM: 11500, BLDGVAL: 43800 },
    expectOwner: 'KELLY OLIVER & CLARA',
    expectId: '16-15',
    expectAcresContains: '2.290 ac',
    expectValueContains: '$55,300' // LANDVALFM + BLDGVAL
  }
];

for (const A of DISPLAY_ASSERTIONS) {
  test(`fly-out display: ${A.key} populates owner + acres + value correctly`, async ({ page }) => {
    // Determinism: empty-stub every other in-view county query so the test
    // never waits on a live county server (refresh() awaits all in-view
    // counties before rendering). Registered FIRST so the locality's specific
    // stub below — registered after — takes priority for its own URL.
    await page.route('**/query**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"type":"FeatureCollection","features":[]}' })
    );
    await page.route(A.urlPattern, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: A.props,
          geometry: makePolygon(A.center[0], A.center[1])
        }]
      })
    }));
    await page.goto('/app.html?test=1');
    await page.waitForFunction(() => window.__parcel && window.__parcel.parcels);
    await page.evaluate(([la, ln]) => window.__parcel.map.setView([la, ln], 16), A.center);
    await page.click('.layer[data-layer="parcels"]');
    await page.waitForFunction(() => window.__parcel.parcels.countLoaded() >= 1, null, { timeout: 8000 });
    // Find the parcel by its unique identifying property and fire its click.
    const idProp = A.props.PARCELID || A.props.PIN || A.props.ParcelNumber || A.props.GPIN || A.props.TAXMAP || A.props.Parcel_ID;
    await page.evaluate((idVal) => {
      let t = null;
      window.__parcel.map.eachLayer(l => {
        if (!l.feature?.properties) return;
        const p = l.feature.properties;
        if (Object.values(p).some(v => v === idVal)) t = l;
      });
      if (t) t.fire('click', { latlng: t.getBounds().getCenter() });
    }, idProp);
    await expect(page.locator('#p-owner')).toHaveText(A.expectOwner);
    await expect(page.locator('#p-id')).toHaveText(A.expectId);
    await expect(page.locator('#p-acres')).toContainText(A.expectAcresContains);
    await expect(page.locator('#p-value')).toContainText(A.expectValueContains);
  });
}
