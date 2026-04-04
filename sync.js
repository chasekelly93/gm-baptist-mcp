const axios = require("axios");

const PRIMARY_LOCATION_ID = process.env.PRIMARY_LOCATION_ID;
const LOCATION_KEY = process.env.GHL_LOCATION_API_KEY;
const AGENCY_KEY = process.env.GHL_API_KEY;
const CUSTOM_FIELD_ID = "WWHq66Z8DF3fMwPu1JEj";
const BASE_URL = "https://services.leadconnectorhq.com";
const HEADERS_AGENCY = { Authorization: `Bearer ${AGENCY_KEY}`, Version: "2021-07-28" };
const HEADERS_LOCATION = { Authorization: `Bearer ${LOCATION_KEY}`, Version: "2021-07-28" };

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

async function getAccountUsers(locationId) {
  const { data } = await axios.get(`${BASE_URL}/users/search`, {
    headers: HEADERS_AGENCY,
    params: { locationId },
  });
  const users = data.users || [];
  return users.filter((u) => u.roles && u.roles.type === "account");
}

async function findContactByEmail(email) {
  const { data } = await axios.get(`${BASE_URL}/contacts/search/duplicates`, {
    headers: HEADERS_LOCATION,
    params: { locationId: PRIMARY_LOCATION_ID, email },
  });
  return data.contact || null;
}

async function updateContactCustomField(contactId, locationId) {
  const url = `https://app.gmbaptistoutreach.com/v2/location/${locationId}/settings/staff/team`;
  await axios.put(
    `${BASE_URL}/contacts/${contactId}`,
    {
      customFields: [{ id: CUSTOM_FIELD_ID, field_value: url }],
    },
    { headers: HEADERS_LOCATION }
  );
}

async function runSync() {
  console.log("[sync] started");

  const allLocations = await getAllSubAccounts();
  const locations = allLocations.filter(isValidLocation);
  const total = locations.length;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const loc = locations[i];

    try {
      let matched = false;

      const users = await getAccountUsers(loc.id);
      const emails = new Set();
      for (const user of users) {
        if (user.email) emails.add(user.email);
      }
      if (loc.email) emails.add(loc.email);

      for (const email of emails) {
        try {
          const contact = await findContactByEmail(email);
          if (contact && contact.id) {
            await updateContactCustomField(contact.id, loc.id);
            console.log(`[sync] ${i + 1}/${total} ${loc.name} → ${email} → updated contact ${contact.id}`);
            updated++;
            matched = true;
            break;
          }
        } catch (err) {
          console.error(`[sync] ${loc.name} → ${email} → error: ${err.message}`);
        }
      }

      if (!matched) {
        console.log(`[sync] ${loc.name} → no contact found`);
        skipped++;
      }
    } catch (err) {
      console.error(`[sync] ${loc.name} → error: ${err.message}`);
      skipped++;
    }

    await delay(800);
  }

  console.log(`[sync] complete — ${updated} updated, ${skipped} skipped`);
}

module.exports = { runSync };
