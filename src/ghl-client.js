const axios = require("axios");

const BASE_URL = "https://services.leadconnectorhq.com";

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

function locationClient() {
  const apiKey = process.env.GHL_LOCATION_API_KEY;
  if (!apiKey) {
    throw new Error("GHL_LOCATION_API_KEY environment variable is not set");
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

module.exports = { agencyClient, locationClient };
