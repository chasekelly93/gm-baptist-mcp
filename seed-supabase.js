const axios = require("axios");

const PRIMARY_LOCATION_ID = process.env.PRIMARY_LOCATION_ID;
const AGENCY_KEY = process.env.GHL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BASE_URL = "https://services.leadconnectorhq.com";
const HEADERS_AGENCY = { Authorization: `Bearer ${AGENCY_KEY}`, Version: "2021-07-28" };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAllSubAccounts() {
  const locations = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const { data } = await axios.get(`${BASE_URL}/locations/search`, {
      headers: HEADERS_AGENCY,
      params: { limit, skip },
    });
    const batch = data.locations || [];
    locations.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
  }

  return locations;
}

function isValidLocation(loc) {
  if (loc.name && loc.name.startsWith("#")) return false;
  if (!loc.email) return false;
  if (loc.email.includes("gmbaptistoutreach")) return false;
  if (loc.email.includes("automatesouth")) return false;
  if (loc.id === PRIMARY_LOCATION_ID) return false;
  return true;
}

function buildContactName(loc) {
  const first = (loc.firstName || "").trim();
  const last = (loc.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  return full || "Pastor";
}

async function insertClient(row) {
  const { data } = await axios.post(`${SUPABASE_URL}/rest/v1/clients`, row, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
  });
  return { inserted: Array.isArray(data) && data.length > 0 };
}

async function seedSupabase() {
  console.log("[seed-supabase] started");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[seed-supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — aborting");
    return;
  }

  const allLocations = await getAllSubAccounts();
  const locations = allLocations.filter(isValidLocation);
  const total = locations.length;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < total; i++) {
    const loc = locations[i];
    const row = {
      token: loc.id,
      church_name: loc.name,
      contact_name: buildContactName(loc),
      tier: "subscriber",
    };

    try {
      const result = await insertClient(row);
      if (result.inserted) {
        console.log(`[seed-supabase] ${i + 1}/${total} ${loc.name} → inserted (${row.contact_name})`);
        inserted++;
      } else {
        console.log(`[seed-supabase] ${i + 1}/${total} ${loc.name} → already exists, skipped`);
        skipped++;
      }
    } catch (err) {
      const msg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
      console.error(`[seed-supabase] ${i + 1}/${total} ${loc.name} → error: ${msg}`);
      errors++;
    }

    await delay(200);
  }

  console.log(`[seed-supabase] complete — ${inserted} inserted, ${skipped} already exists, ${errors} errors`);
}

module.exports = { seedSupabase };
