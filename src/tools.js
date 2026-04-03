const { agencyClient, locationClient } = require("./ghl-client");

async function getSubAccounts({ limit = 10, skip = 0 } = {}) {
  const client = agencyClient();
  // The agency endpoint requires the companyId; GHL v2 uses /locations/search
  const response = await client.get("/locations/search", {
    params: { limit, skip },
  });
  const locations = response.data.locations || [];
  return {
    total: response.data.total || locations.length,
    locations: locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      email: loc.email,
      phone: loc.phone,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      country: loc.country,
    })),
  };
}

async function getContacts({ locationId, limit = 20, skip = 0, query } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient();
  const params = { locationId, limit, skip };
  if (query) params.query = query;
  const response = await client.get("/contacts/", { params });
  const contacts = response.data.contacts || [];
  return {
    total: response.data.total || contacts.length,
    contacts: contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      locationId: c.locationId,
      tags: c.tags,
      createdAt: c.dateAdded,
    })),
  };
}

async function createContact({
  locationId,
  firstName,
  lastName,
  email,
  phone,
  tags,
  source,
} = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!firstName && !lastName && !email && !phone) {
    throw new Error("At least one of firstName, lastName, email, or phone is required");
  }
  const client = locationClient();
  const body = { locationId };
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (tags) body.tags = tags;
  if (source) body.source = source;

  const response = await client.post("/contacts/", body);
  const c = response.data.contact || response.data;
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    locationId: c.locationId,
    tags: c.tags,
  };
}

async function getConversations({ locationId, limit = 20, skip = 0, contactId, status } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient();
  const params = { locationId, limit, skip };
  if (contactId) params.contactId = contactId;
  if (status) params.status = status;
  const response = await client.get("/conversations/search", { params });
  const conversations = response.data.conversations || [];
  return {
    total: response.data.total || conversations.length,
    conversations: conversations.map((conv) => ({
      id: conv.id,
      contactId: conv.contactId,
      locationId: conv.locationId,
      lastMessageType: conv.lastMessageType,
      lastMessageDate: conv.lastMessageDate,
      unreadCount: conv.unreadCount,
      fullName: conv.fullName,
      email: conv.email,
      phone: conv.phone,
    })),
  };
}

async function sendMessage({ type, locationId, contactId, conversationId, message, subject, emailFrom, emailFromName } = {}) {
  if (!type) throw new Error("type is required (SMS or Email)");
  if (!contactId && !conversationId) throw new Error("Either contactId or conversationId is required");
  if (!message) throw new Error("message is required");

  const client = locationClient();

  const body = {
    type,
    message,
    locationId,
  };

  if (contactId) body.contactId = contactId;
  if (conversationId) body.conversationId = conversationId;

  if (type === "Email") {
    if (!subject) throw new Error("subject is required for Email type");
    body.subject = subject;
    if (emailFrom) body.emailFrom = emailFrom;
    if (emailFromName) body.emailFromName = emailFromName;
  }

  // If we have contactId but no conversationId, look up or create conversation first
  if (contactId && !conversationId) {
    const convoResponse = await client.post("/conversations/", {
      locationId,
      contactId,
    });
    const convo = convoResponse.data.conversation || convoResponse.data;
    body.conversationId = convo.id;
  }

  const response = await client.post("/conversations/messages", body);
  const msg = response.data.message || response.data;
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    type: msg.messageType || type,
    status: msg.status,
    dateAdded: msg.dateAdded,
  };
}

async function getMessages({ conversationId, limit = 20, lastMessageId } = {}) {
  if (!conversationId) throw new Error("conversationId is required");
  const client = locationClient();
  const params = { limit };
  if (lastMessageId) params.lastMessageId = lastMessageId;
  const response = await client.get(`/conversations/${conversationId}/messages`, { params });
  const messages = response.data.messages?.messages || response.data.messages || [];
  return {
    conversationId,
    messages: messages.map((m) => ({
      id: m.id,
      type: m.messageType,
      direction: m.direction,
      body: m.body,
      dateAdded: m.dateAdded,
      status: m.status,
    })),
  };
}

async function getBillingCharges({ startDate, endDate, locationId, limit = 100, skip = 0 } = {}) {
  const client = agencyClient();

  // Step 1: try to discover companyId
  let companyId = null;
  try {
    const loc = await client.get("/locations/search", { params: { limit: 1 } });
    companyId = loc.data?.locations?.[0]?.companyId || null;
  } catch {}

  const params = { limit, skip };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (locationId) params.locationId = locationId;

  // Step 2: probe billing endpoints
  const endpoints = [
    companyId ? `/companies/${companyId}/wallet` : null,
    companyId ? `/companies/${companyId}/wallet/balance` : null,
    companyId ? `/companies/${companyId}/lc-phone/usage` : null,
    companyId ? `/v1/companies/${companyId}/wallet` : null,
    `/saas-api/public-api/get-wallet-balance`,
    `/saas-api/public-api/wallet-balance`,
    `/lc-phone/usage`,
    `/lc-communications/usage`,
  ].filter(Boolean);

  const results = { companyId, endpoints: {} };
  for (const endpoint of endpoints) {
    try {
      const p = endpoint.includes("companyId=") ? { ...params } : { ...params, ...(companyId ? { companyId } : {}) };
      const res = await client.get(endpoint, { params: p });
      results.endpoints[endpoint] = { success: true, data: res.data };
    } catch (err) {
      const msg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
      results.endpoints[endpoint] = { success: false, error: msg };
    }
  }
  return results;
}

module.exports = { getSubAccounts, getContacts, createContact, getConversations, sendMessage, getMessages, getBillingCharges };
