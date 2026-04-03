const axios = require("axios");

const BASE_URL = "https://services.leadconnectorhq.com";

function getApiToken(locationId) {
  const PRIMARY_LOCATION_ID = process.env.PRIMARY_LOCATION_ID;
  if (!locationId || locationId === PRIMARY_LOCATION_ID) {
    return process.env.GHL_LOCATION_API_KEY;
  }
  return process.env.GHL_API_KEY;
}

function agencyClient() {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error("GHL_API_KEY environment variable is not set");
  }
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });
}

function locationClient(locationId) {
  const apiKey = getApiToken(locationId);
  if (!apiKey) {
    throw new Error("GHL_LOCATION_API_KEY or GHL_API_KEY environment variable is not set");
  }
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });
}

module.exports = { agencyClient, locationClient, getApiToken };
