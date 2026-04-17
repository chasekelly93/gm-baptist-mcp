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
  const companyId = process.env.COMPANY_ID;
  const { data } = await axios.get(`${BASE_URL}/users/search`, {
    headers: HEADERS_AGENCY,
    params: { companyId, locationId },
  });
  const users = data.users || [];
  return users.filter((u) => u.roles && u.roles.type === "account");
}

async function findContactByEmail(email) {
  const { data } = await axios.get(`${BASE_URL}/contacts/search/duplicate`, {
    headers: HEADERS_LOCATION,
    params: { locationId: PRIMARY_LOCATION_ID, email },
  });
  return data.contact || null;
}

function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function findContactByPhone(phone) {
  const { data } = await axios.get(`${BASE_URL}/contacts/search/duplicate`, {
    headers: HEADERS_LOCATION,
    params: { locationId: PRIMARY_LOCATION_ID, number: phone },
  });
  return data.contact || null;
}

async function updateContactCustomField(contactId, locationId) {
  await axios.put(
    `${BASE_URL}/contacts/${contactId}`,
    {
      customFields: [{ id: CUSTOM_FIELD_ID, field_value: locationId }],
    },
    { headers: HEADERS_LOCATION }
  );
}

function hasLocationIdSet(contact) {
  const fields = contact && contact.customFields;
  if (!Array.isArray(fields)) return false;
  const entry = fields.find((f) => f && f.id === CUSTOM_FIELD_ID);
  if (!entry) return false;
  const value = entry.value ?? entry.field_value;
  return typeof value === "string" && value.trim().length > 0;
}

async function runSync() {
  console.log("[sync] started");

  const allLocations = await getAllSubAccounts();
  const locations = allLocations.filter(isValidLocation);
  const total = locations.length;
  let updated = 0;
  let alreadySet = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const loc = locations[i];

    try {
      let matched = false;

      const users = await getAccountUsers(loc.id);
      const emails = new Set();
      const phones = new Set();
      for (const user of users) {
        if (user.email) emails.add(user.email);
        const userPhone = normalizePhone(user.phone);
        if (userPhone) phones.add(userPhone);
      }
      if (loc.email) emails.add(loc.email);
      const locPhone = normalizePhone(loc.phone);
      if (locPhone) phones.add(locPhone);

      for (const email of emails) {
        try {
          const contact = await findContactByEmail(email);
          if (contact && contact.id) {
            if (hasLocationIdSet(contact)) {
              console.log(`[sync] ${i + 1}/${total} ${loc.name} → ${email} → already set, skipping`);
              alreadySet++;
              matched = true;
              break;
            }
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
        for (const phone of phones) {
          try {
            const contact = await findContactByPhone(phone);
            if (contact && contact.id) {
              if (hasLocationIdSet(contact)) {
                console.log(`[sync] ${i + 1}/${total} ${loc.name} → ${phone} → already set, skipping`);
                alreadySet++;
                matched = true;
                break;
              }
              await updateContactCustomField(contact.id, loc.id);
              console.log(`[sync] ${i + 1}/${total} ${loc.name} → ${phone} → updated contact ${contact.id} (phone fallback)`);
              updated++;
              matched = true;
              break;
            }
          } catch (err) {
            console.error(`[sync] ${loc.name} → ${phone} → error: ${err.message}`);
          }
        }
      }

      if (!matched) {
        console.log(`[sync] ${loc.name} → no contact found (tried ${emails.size} email(s), ${phones.size} phone(s))`);
        skipped++;
      }
    } catch (err) {
      console.error(`[sync] ${loc.name} → error: ${err.message}`);
      skipped++;
    }

    await delay(800);
  }

  console.log(`[sync] complete — ${updated} updated, ${alreadySet} already set, ${skipped} skipped`);
}

module.exports = { runSync };
