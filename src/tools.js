const { agencyClient, locationClient } = require("./ghl-client");

async function getSubAccounts({ limit = 10, skip = 0 } = {}) {
  const client = agencyClient();
  // The agency endpoint requires the companyId; GHL v2 uses /locations/search
  const response = await client.get("/locations/search", {
    params: skip ? { limit, skip } : { limit },
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
  const client = locationClient(locationId);
  const params = { locationId, limit };
  if (skip) params.skip = skip;
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
  const client = locationClient(locationId);
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
  const client = locationClient(locationId);
  const params = { locationId, limit };
  if (skip) params.skip = skip;
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

  const client = locationClient(locationId);

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

  const params = { limit };
  if (skip) params.skip = skip;
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

async function getContact({ contactId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const response = await client.get(`/contacts/${contactId}`);
  const c = response.data.contact || response.data;
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    locationId: c.locationId,
    tags: c.tags,
    companyName: c.companyName,
    address1: c.address1,
    city: c.city,
    state: c.state,
    country: c.country,
    postalCode: c.postalCode,
    website: c.website,
    source: c.source,
    dnd: c.dnd,
    createdAt: c.dateAdded,
    customFields: c.customFields,
  };
}

async function updateContact({ contactId, firstName, lastName, email, phone, tags, companyName, address1, city, state, postalCode, website, source, dnd, customFields } = {}) {
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const body = {};
  if (firstName !== undefined) body.firstName = firstName;
  if (lastName !== undefined) body.lastName = lastName;
  if (email !== undefined) body.email = email;
  if (phone !== undefined) body.phone = phone;
  if (tags !== undefined) body.tags = tags;
  if (companyName !== undefined) body.companyName = companyName;
  if (address1 !== undefined) body.address1 = address1;
  if (city !== undefined) body.city = city;
  if (state !== undefined) body.state = state;
  if (postalCode !== undefined) body.postalCode = postalCode;
  if (website !== undefined) body.website = website;
  if (source !== undefined) body.source = source;
  if (dnd !== undefined) body.dnd = dnd;
  if (customFields !== undefined) body.customFields = customFields;
  const response = await client.put(`/contacts/${contactId}`, body);
  return response.data.contact || response.data;
}

async function getUsers({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");

  const companyId = process.env.COMPANY_ID;
  const agencyToken = process.env.GHL_API_KEY;
  console.log("[get_users] locationId:", locationId);
  console.log("[get_users] companyId:", companyId ? companyId.slice(0, 6) + "..." : "MISSING");
  console.log("[get_users] agencyToken:", agencyToken ? agencyToken.slice(0, 6) + "..." : "MISSING");

  if (!companyId) throw new Error("COMPANY_ID environment variable is not set");

  const client = agencyClient();
  try {
    const response = await client.get("/users/search", {
      params: { companyId, locationId },
    });
    console.log("[get_users] SUCCESS, user count:", (response.data.users || []).length);
    return response.data.users || response.data;
  } catch (error) {
    console.log("[get_users] GHL error status:", error.response?.status);
    console.log("[get_users] GHL error body:", JSON.stringify(error.response?.data));
    throw error;
  }
}

async function getContactsByTag({ locationId, tags, limit = 20, skip = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!tags || tags.length === 0) throw new Error("at least one tag is required");
  const client = locationClient(locationId);
  const tagList = Array.isArray(tags) ? tags : [tags];
  const body = {
    locationId,
    pageSize: limit,
    filters: [{ field: "tags", operator: "contains", value: tagList }],
  };
  if (skip) body.page = Math.floor(skip / limit) + 1;
  const response = await client.post("/contacts/search", body);
  const contacts = response.data.contacts || [];
  return {
    total: response.data.total || contacts.length,
    contacts: contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      tags: c.tags,
      locationId: c.locationId,
      createdAt: c.dateAdded,
    })),
  };
}

async function deleteContact({ contactId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  await client.delete(`/contacts/${contactId}`);
  return { success: true, contactId, message: `Contact ${contactId} deleted successfully` };
}

async function addContactTags({ contactId, tags } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!tags || !tags.length) throw new Error("tags array is required");
  const client = locationClient();
  const response = await client.post(`/contacts/${contactId}/tags`, { tags });
  return { contactId, tags: response.data.tags || tags, success: true };
}

async function removeContactTags({ contactId, tags } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!tags || !tags.length) throw new Error("tags array is required");
  const client = locationClient();
  await client.delete(`/contacts/${contactId}/tags`, { data: { tags } });
  return { contactId, removed: tags, success: true };
}

async function searchContacts({ locationId, query, limit = 20, skip = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit };
  if (skip) params.skip = skip;
  if (query) params.q = query;
  const response = await client.get("/contacts/search", { params });
  const contacts = response.data.contacts || [];
  return {
    total: response.data.total || contacts.length,
    contacts,
  };
}

async function getContactNotes({ contactId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const response = await client.get(`/contacts/${contactId}/notes`);
  const notes = response.data.notes || [];
  return {
    contactId,
    total: notes.length,
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      userId: n.userId,
      dateAdded: n.dateAdded,
    })),
  };
}

async function addContactNote({ contactId, body, userId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!body) throw new Error("body is required");
  const client = locationClient();
  const payload = { body };
  if (userId) payload.userId = userId;
  const response = await client.post(`/contacts/${contactId}/notes`, payload);
  const note = response.data.note || response.data;
  return {
    id: note.id,
    contactId,
    body: note.body,
    userId: note.userId,
    dateAdded: note.dateAdded,
  };
}

async function markConversationRead({ conversationId } = {}) {
  if (!conversationId) throw new Error("conversationId is required");
  const client = locationClient();
  const response = await client.put(`/conversations/${conversationId}`, { unreadCount: 0 });
  const conv = response.data.conversation || response.data;
  return {
    id: conversationId,
    unreadCount: 0,
    success: true,
    message: `Conversation ${conversationId} marked as read`,
  };
}

async function getConversation({ conversationId } = {}) {
  if (!conversationId) throw new Error("conversationId is required");
  const client = locationClient();
  const response = await client.get(`/conversations/${conversationId}`);
  const conv = response.data.conversation || response.data;
  return {
    id: conv.id,
    contactId: conv.contactId,
    locationId: conv.locationId,
    fullName: conv.fullName,
    email: conv.email,
    phone: conv.phone,
    lastMessageType: conv.lastMessageType,
    lastMessageDate: conv.lastMessageDate,
    unreadCount: conv.unreadCount,
    type: conv.type,
    status: conv.status,
  };
}

async function getPipelines({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/opportunities/pipelines", { params: { locationId } });
  const pipelines = response.data.pipelines || [];
  return {
    total: pipelines.length,
    pipelines: pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      stages: (p.stages || []).map((s) => ({ id: s.id, name: s.name, position: s.position })),
    })),
  };
}

async function getOpportunities({ locationId, pipelineId, pipelineStageId, status, contactId, limit = 20, skip = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { location_id: locationId, limit };
  if (skip) params.skip = skip;
  if (pipelineId) params.pipeline_id = pipelineId;
  if (pipelineStageId) params.pipeline_stage_id = pipelineStageId;
  if (status) params.status = status;
  if (contactId) params.contact_id = contactId;
  const response = await client.get("/opportunities/search", { params });
  const opportunities = response.data.opportunities || [];
  return {
    total: response.data.total || opportunities.length,
    opportunities: opportunities.map((o) => ({
      id: o.id,
      name: o.name,
      pipelineId: o.pipelineId,
      pipelineStageId: o.pipelineStageId,
      status: o.status,
      monetaryValue: o.monetaryValue,
      contactId: o.contact?.id || o.contactId,
      contactName: o.contact?.name || o.contactName,
      assignedTo: o.assignedTo,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
  };
}

async function createOpportunity({ locationId, pipelineId, name, pipelineStageId, status = "open", contactId, monetaryValue, assignedTo } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!pipelineId) throw new Error("pipelineId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const body = { locationId, pipelineId, name, status };
  if (pipelineStageId) body.pipelineStageId = pipelineStageId;
  if (contactId) body.contactId = contactId;
  if (monetaryValue !== undefined) body.monetaryValue = monetaryValue;
  if (assignedTo) body.assignedTo = assignedTo;
  const response = await client.post("/opportunities/", body);
  return response.data.opportunity || response.data;
}

async function updateOpportunity({ opportunityId, name, pipelineStageId, status, monetaryValue, assignedTo } = {}) {
  if (!opportunityId) throw new Error("opportunityId is required");
  const client = locationClient();
  const body = {};
  if (name !== undefined) body.name = name;
  if (pipelineStageId !== undefined) body.pipelineStageId = pipelineStageId;
  if (status !== undefined) body.status = status;
  if (monetaryValue !== undefined) body.monetaryValue = monetaryValue;
  if (assignedTo !== undefined) body.assignedTo = assignedTo;
  const response = await client.put(`/opportunities/${opportunityId}`, body);
  return response.data.opportunity || response.data;
}

async function deleteOpportunity({ opportunityId } = {}) {
  if (!opportunityId) throw new Error("opportunityId is required");
  const client = locationClient();
  await client.delete(`/opportunities/${opportunityId}`);
  return { success: true, opportunityId, message: `Opportunity ${opportunityId} deleted successfully` };
}

async function getCalendars({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/calendars/", { params: { locationId } });
  const calendars = response.data.calendars || [];
  return {
    total: calendars.length,
    calendars: calendars.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      slug: c.slug,
      locationId: c.locationId,
      calendarType: c.calendarType,
      isActive: c.isActive,
    })),
  };
}

async function getAppointments({ locationId, calendarId, startTime, endTime, contactId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const params = {
    locationId,
    startTime: startTime || now.toISOString(),
    endTime: endTime || thirtyDaysOut.toISOString(),
  };
  if (calendarId) params.calendarId = calendarId;
  if (contactId) params.contactId = contactId;
  const response = await client.get("/calendars/events", { params });
  const appointments = response.data.events || response.data.appointments || [];
  return {
    total: appointments.length,
    appointments: appointments.map((a) => ({
      id: a.id,
      title: a.title,
      calendarId: a.calendarId,
      contactId: a.contactId,
      contactName: a.contactName,
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.appointmentStatus || a.status,
      assignedUserId: a.assignedUserId,
      address: a.address,
      notes: a.notes,
    })),
  };
}

module.exports = {
  getSubAccounts, getContacts, createContact, getConversations, sendMessage, getMessages, getBillingCharges,
  getContact, updateContact, deleteContact, addContactTags, removeContactTags, searchContacts,
  getContactNotes, addContactNote, markConversationRead, getConversation,
  getPipelines, getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
  getCalendars, getAppointments, getUsers, getContactsByTag,
};
