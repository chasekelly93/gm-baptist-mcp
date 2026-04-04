"use strict";
const { locationClient, agencyClient } = require("./ghl-client");

// ============================================================================
// CONTACTS (extended - not in tools.js)
// ============================================================================

async function getContactTasks({ contactId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const response = await client.get(`/contacts/${contactId}/tasks`);
  return response.data.tasks || response.data;
}

async function createContactTask({ contactId, title, body, dueDate, completed = false, assignedTo } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!title) throw new Error("title is required");
  if (!dueDate) throw new Error("dueDate is required");
  const client = locationClient();
  const payload = { title, dueDate, completed };
  if (body) payload.body = body;
  if (assignedTo) payload.assignedTo = assignedTo;
  const response = await client.post(`/contacts/${contactId}/tasks`, payload);
  return response.data.task || response.data;
}

async function getContactTask({ contactId, taskId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!taskId) throw new Error("taskId is required");
  const client = locationClient();
  const response = await client.get(`/contacts/${contactId}/tasks/${taskId}`);
  return response.data.task || response.data;
}

async function updateContactTask({ contactId, taskId, title, body, dueDate, completed, assignedTo } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!taskId) throw new Error("taskId is required");
  const client = locationClient();
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (body !== undefined) payload.body = body;
  if (dueDate !== undefined) payload.dueDate = dueDate;
  if (completed !== undefined) payload.completed = completed;
  if (assignedTo !== undefined) payload.assignedTo = assignedTo;
  const response = await client.put(`/contacts/${contactId}/tasks/${taskId}`, payload);
  return response.data.task || response.data;
}

async function deleteContactTask({ contactId, taskId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!taskId) throw new Error("taskId is required");
  const client = locationClient();
  await client.delete(`/contacts/${contactId}/tasks/${taskId}`);
  return { success: true, contactId, taskId };
}

async function updateTaskCompletion({ contactId, taskId, completed } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!taskId) throw new Error("taskId is required");
  if (completed === undefined) throw new Error("completed is required");
  const client = locationClient();
  const response = await client.put(`/contacts/${contactId}/tasks/${taskId}/completed`, { completed });
  return response.data.task || response.data;
}

async function getContactNote({ contactId, noteId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!noteId) throw new Error("noteId is required");
  const client = locationClient();
  const response = await client.get(`/contacts/${contactId}/notes/${noteId}`);
  return response.data.note || response.data;
}

async function updateContactNote({ contactId, noteId, body, userId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!noteId) throw new Error("noteId is required");
  if (!body) throw new Error("body is required");
  const client = locationClient();
  const payload = { body };
  if (userId) payload.userId = userId;
  const response = await client.put(`/contacts/${contactId}/notes/${noteId}`, payload);
  return response.data.note || response.data;
}

async function deleteContactNote({ contactId, noteId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!noteId) throw new Error("noteId is required");
  const client = locationClient();
  await client.delete(`/contacts/${contactId}/notes/${noteId}`);
  return { success: true, contactId, noteId };
}

async function upsertContact({ locationId, firstName, lastName, name, email, phone, address1, city, state, country, postalCode, website, timezone, companyName, tags, customFields } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { locationId };
  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;
  if (name) payload.name = name;
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (address1) payload.address1 = address1;
  if (city) payload.city = city;
  if (state) payload.state = state;
  if (country) payload.country = country;
  if (postalCode) payload.postalCode = postalCode;
  if (website) payload.website = website;
  if (timezone) payload.timezone = timezone;
  if (companyName) payload.companyName = companyName;
  if (tags) payload.tags = tags;
  if (customFields) payload.customFields = customFields;
  const response = await client.post("/contacts/upsert", payload);
  return response.data;
}

async function getDuplicateContact({ locationId, email, phone } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId };
  if (email) params.email = email;
  if (phone) params.number = phone;
  const response = await client.get("/contacts/search/duplicate", { params });
  return response.data.contact || null;
}

async function getContactsByBusiness({ businessId, limit = 25, skip = 0, query } = {}) {
  if (!businessId) throw new Error("businessId is required");
  const client = locationClient();
  const params = { limit, skip };
  if (query) params.query = query;
  const response = await client.get(`/contacts/business/${businessId}`, { params });
  return response.data;
}

async function getContactAppointments({ contactId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const response = await client.get(`/contacts/${contactId}/appointments`);
  return response.data.events || response.data;
}

async function bulkUpdateContactTags({ contactIds, tags, operation, removeAllTags } = {}) {
  if (!contactIds || !contactIds.length) throw new Error("contactIds is required");
  if (!tags || !tags.length) throw new Error("tags is required");
  if (!operation) throw new Error("operation is required (add or remove)");
  const client = locationClient();
  const payload = { ids: contactIds, tags, operation };
  if (removeAllTags !== undefined) payload.removeAllTags = removeAllTags;
  const response = await client.post("/contacts/tags/bulk", payload);
  return response.data;
}

async function bulkUpdateContactBusiness({ contactIds, businessId } = {}) {
  if (!contactIds || !contactIds.length) throw new Error("contactIds is required");
  const client = locationClient();
  const payload = { ids: contactIds, businessId: businessId || null };
  const response = await client.post("/contacts/business/bulk", payload);
  return response.data;
}

async function addContactFollowers({ contactId, followers } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!followers || !followers.length) throw new Error("followers is required");
  const client = locationClient();
  const response = await client.post(`/contacts/${contactId}/followers`, { followers });
  return response.data;
}

async function removeContactFollowers({ contactId, followers } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!followers || !followers.length) throw new Error("followers is required");
  const client = locationClient();
  await client.delete(`/contacts/${contactId}/followers`, { data: { followers } });
  return { success: true, contactId, removed: followers };
}

async function addContactToCampaign({ contactId, campaignId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!campaignId) throw new Error("campaignId is required");
  const client = locationClient();
  const response = await client.post(`/contacts/${contactId}/campaigns/${campaignId}`);
  return response.data;
}

async function removeContactFromCampaign({ contactId, campaignId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!campaignId) throw new Error("campaignId is required");
  const client = locationClient();
  await client.delete(`/contacts/${contactId}/campaigns/${campaignId}`);
  return { success: true, contactId, campaignId };
}

async function removeContactFromAllCampaigns({ contactId } = {}) {
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  await client.delete(`/contacts/${contactId}/campaigns`);
  return { success: true, contactId };
}

async function addContactToWorkflow({ contactId, workflowId, eventStartTime } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!workflowId) throw new Error("workflowId is required");
  const client = locationClient();
  const payload = eventStartTime ? { eventStartTime } : {};
  const response = await client.post(`/contacts/${contactId}/workflow/${workflowId}`, payload);
  return response.data;
}

async function removeContactFromWorkflow({ contactId, workflowId, eventStartTime } = {}) {
  if (!contactId) throw new Error("contactId is required");
  if (!workflowId) throw new Error("workflowId is required");
  const client = locationClient();
  const payload = eventStartTime ? { eventStartTime } : {};
  await client.delete(`/contacts/${contactId}/workflow/${workflowId}`, { data: payload });
  return { success: true, contactId, workflowId };
}

// ============================================================================
// CONVERSATIONS (extended)
// ============================================================================

async function createConversation({ locationId, contactId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient(locationId);
  const response = await client.post("/conversations/", { locationId, contactId });
  return response.data.conversation || response.data;
}

async function updateConversation({ conversationId, locationId, unreadCount, starred } = {}) {
  if (!conversationId) throw new Error("conversationId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (locationId) payload.locationId = locationId;
  if (unreadCount !== undefined) payload.unreadCount = unreadCount;
  if (starred !== undefined) payload.starred = starred;
  const response = await client.put(`/conversations/${conversationId}`, payload);
  return response.data.conversation || response.data;
}

async function deleteConversation({ conversationId } = {}) {
  if (!conversationId) throw new Error("conversationId is required");
  const client = locationClient();
  await client.delete(`/conversations/${conversationId}`);
  return { success: true, conversationId };
}

async function getMessage({ messageId } = {}) {
  if (!messageId) throw new Error("messageId is required");
  const client = locationClient();
  const response = await client.get(`/conversations/messages/${messageId}`);
  return response.data;
}

async function getEmailMessage({ emailMessageId } = {}) {
  if (!emailMessageId) throw new Error("emailMessageId is required");
  const client = locationClient();
  const response = await client.get(`/conversations/messages/email/${emailMessageId}`);
  return response.data;
}

async function cancelScheduledEmail({ emailMessageId } = {}) {
  if (!emailMessageId) throw new Error("emailMessageId is required");
  const client = locationClient();
  await client.delete(`/conversations/messages/email/${emailMessageId}/schedule`);
  return { success: true, emailMessageId };
}

async function cancelScheduledMessage({ messageId } = {}) {
  if (!messageId) throw new Error("messageId is required");
  const client = locationClient();
  await client.delete(`/conversations/messages/${messageId}/schedule`);
  return { success: true, messageId };
}

async function addInboundMessage({ type, conversationId, contactId, message, attachments } = {}) {
  if (!type) throw new Error("type is required");
  const client = locationClient();
  const payload = { type };
  if (conversationId) payload.conversationId = conversationId;
  if (contactId) payload.contactId = contactId;
  if (message) payload.message = message;
  if (attachments) payload.attachments = attachments;
  const response = await client.post("/conversations/messages/inbound", payload);
  return response.data;
}

async function addOutboundCall({ conversationId, contactId, userId, direction } = {}) {
  if (!conversationId && !contactId) throw new Error("conversationId or contactId is required");
  const client = locationClient();
  const payload = { type: "Call" };
  if (conversationId) payload.conversationId = conversationId;
  if (contactId) payload.contactId = contactId;
  if (userId) payload.userId = userId;
  if (direction) payload.direction = direction;
  const response = await client.post("/conversations/messages/outbound", payload);
  return response.data;
}

async function updateMessageStatus({ messageId, status, error } = {}) {
  if (!messageId) throw new Error("messageId is required");
  if (!status) throw new Error("status is required");
  const client = locationClient();
  const payload = { status };
  if (error) payload.error = error;
  const response = await client.put(`/conversations/messages/${messageId}/status`, payload);
  return response.data;
}

async function getMessageRecording({ messageId, locationId } = {}) {
  if (!messageId) throw new Error("messageId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/conversations/messages/${messageId}/locations/${locationId}/recording`);
  return response.data;
}

async function getMessageTranscription({ messageId, locationId } = {}) {
  if (!messageId) throw new Error("messageId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/conversations/locations/${locationId}/messages/${messageId}/transcription`);
  return response.data;
}

async function downloadMessageTranscription({ messageId, locationId } = {}) {
  if (!messageId) throw new Error("messageId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/conversations/locations/${locationId}/messages/${messageId}/transcription/download`);
  return response.data;
}

async function liveChatTyping({ conversationId, userId, typing } = {}) {
  if (!conversationId) throw new Error("conversationId is required");
  const client = locationClient();
  const response = await client.post("/conversations/providers/live-chat/typing", { conversationId, userId, typing });
  return response.data;
}

// ============================================================================
// OPPORTUNITIES (extended)
// ============================================================================

async function getOpportunity({ opportunityId } = {}) {
  if (!opportunityId) throw new Error("opportunityId is required");
  const client = locationClient();
  const response = await client.get(`/opportunities/${opportunityId}`);
  return response.data.opportunity || response.data;
}

async function updateOpportunityStatus({ opportunityId, status } = {}) {
  if (!opportunityId) throw new Error("opportunityId is required");
  if (!status) throw new Error("status is required");
  const client = locationClient();
  const response = await client.put(`/opportunities/${opportunityId}/status`, { status });
  return response.data;
}

async function upsertOpportunity({ locationId, pipelineId, name, pipelineStageId, status, contactId, monetaryValue, assignedTo } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!pipelineId) throw new Error("pipelineId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const payload = { locationId, pipelineId, name };
  if (pipelineStageId) payload.pipelineStageId = pipelineStageId;
  if (status) payload.status = status;
  if (contactId) payload.contactId = contactId;
  if (monetaryValue !== undefined) payload.monetaryValue = monetaryValue;
  if (assignedTo) payload.assignedTo = assignedTo;
  const response = await client.post("/opportunities/upsert", payload);
  return response.data;
}

async function addOpportunityFollowers({ opportunityId, followers } = {}) {
  if (!opportunityId) throw new Error("opportunityId is required");
  if (!followers || !followers.length) throw new Error("followers is required");
  const client = locationClient();
  const response = await client.post(`/opportunities/${opportunityId}/followers`, { followers });
  return response.data;
}

async function removeOpportunityFollowers({ opportunityId, followers } = {}) {
  if (!opportunityId) throw new Error("opportunityId is required");
  if (!followers || !followers.length) throw new Error("followers is required");
  const client = locationClient();
  await client.delete(`/opportunities/${opportunityId}/followers`, { data: { followers } });
  return { success: true, opportunityId, removed: followers };
}

// ============================================================================
// CALENDAR (extended)
// ============================================================================

async function getCalendarGroups({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/calendars/groups", { params: { locationId } });
  return response.data;
}

async function createCalendarGroup({ locationId, name, description, slug } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const payload = { locationId, name };
  if (description) payload.description = description;
  if (slug) payload.slug = slug;
  const response = await client.post("/calendars/groups", payload);
  return response.data;
}

async function updateCalendarGroup({ groupId, name, description, slug } = {}) {
  if (!groupId) throw new Error("groupId is required");
  const client = locationClient();
  const payload = {};
  if (name) payload.name = name;
  if (description) payload.description = description;
  if (slug) payload.slug = slug;
  const response = await client.put(`/calendars/groups/${groupId}`, payload);
  return response.data;
}

async function deleteCalendarGroup({ groupId } = {}) {
  if (!groupId) throw new Error("groupId is required");
  const client = locationClient();
  await client.delete(`/calendars/groups/${groupId}`);
  return { success: true, groupId };
}

async function disableCalendarGroup({ groupId, isActive } = {}) {
  if (!groupId) throw new Error("groupId is required");
  if (isActive === undefined) throw new Error("isActive is required");
  const client = locationClient();
  const response = await client.post(`/calendars/groups/${groupId}/status`, { isActive });
  return response.data;
}

async function validateCalendarGroupSlug({ slug, locationId } = {}) {
  if (!slug) throw new Error("slug is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/calendars/groups/slug/validate", { params: { locationId, slug } });
  return response.data;
}

async function createCalendar({ locationId, name, description, slug, calendarType, groupId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const payload = { locationId, name };
  if (description) payload.description = description;
  if (slug) payload.slug = slug;
  if (calendarType) payload.calendarType = calendarType;
  if (groupId) payload.groupId = groupId;
  const response = await client.post("/calendars/", payload);
  return response.data.calendar || response.data;
}

async function getCalendar({ calendarId } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  const client = locationClient();
  const response = await client.get(`/calendars/${calendarId}`);
  return response.data.calendar || response.data;
}

async function updateCalendar({ calendarId, name, description, slug, calendarType, groupId } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  const client = locationClient();
  const payload = {};
  if (name) payload.name = name;
  if (description) payload.description = description;
  if (slug) payload.slug = slug;
  if (calendarType) payload.calendarType = calendarType;
  if (groupId) payload.groupId = groupId;
  const response = await client.put(`/calendars/${calendarId}`, payload);
  return response.data.calendar || response.data;
}

async function deleteCalendar({ calendarId } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  const client = locationClient();
  await client.delete(`/calendars/${calendarId}`);
  return { success: true, calendarId };
}

async function getFreeSlots({ calendarId, startDate, endDate, timezone, userId } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  if (!startDate) throw new Error("startDate is required");
  if (!endDate) throw new Error("endDate is required");
  const client = locationClient();
  const params = { startDate, endDate };
  if (timezone) params.timezone = timezone;
  if (userId) params.userId = userId;
  const response = await client.get(`/calendars/${calendarId}/free-slots`, { params });
  return response.data;
}

async function getBlockedSlots({ locationId, startTime, endTime, calendarId, userId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!startTime) throw new Error("startTime is required");
  if (!endTime) throw new Error("endTime is required");
  const client = locationClient(locationId);
  const params = { locationId, startTime, endTime };
  if (calendarId) params.calendarId = calendarId;
  if (userId) params.userId = userId;
  const response = await client.get("/calendars/blocked-slots", { params });
  return response.data;
}

async function createAppointment({ locationId, calendarId, contactId, startTime, endTime, title, appointmentStatus, assignedUserId, address, notes, ignoreDateRange, toNotify } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!calendarId) throw new Error("calendarId is required");
  if (!contactId) throw new Error("contactId is required");
  if (!startTime) throw new Error("startTime is required");
  const client = locationClient(locationId);
  const payload = { locationId, calendarId, contactId, startTime };
  if (endTime) payload.endTime = endTime;
  if (title) payload.title = title;
  if (appointmentStatus) payload.appointmentStatus = appointmentStatus;
  if (assignedUserId) payload.assignedUserId = assignedUserId;
  if (address) payload.address = address;
  if (notes) payload.notes = notes;
  if (ignoreDateRange !== undefined) payload.ignoreDateRange = ignoreDateRange;
  if (toNotify !== undefined) payload.toNotify = toNotify;
  const response = await client.post("/calendars/events/appointments", payload);
  return response.data;
}

async function getAppointment({ appointmentId } = {}) {
  if (!appointmentId) throw new Error("appointmentId is required");
  const client = locationClient();
  const response = await client.get(`/calendars/events/appointments/${appointmentId}`);
  return response.data.event || response.data;
}

async function updateAppointment({ appointmentId, startTime, endTime, title, appointmentStatus, assignedUserId, address, notes } = {}) {
  if (!appointmentId) throw new Error("appointmentId is required");
  const client = locationClient();
  const payload = {};
  if (startTime) payload.startTime = startTime;
  if (endTime) payload.endTime = endTime;
  if (title) payload.title = title;
  if (appointmentStatus) payload.appointmentStatus = appointmentStatus;
  if (assignedUserId) payload.assignedUserId = assignedUserId;
  if (address) payload.address = address;
  if (notes) payload.notes = notes;
  const response = await client.put(`/calendars/events/appointments/${appointmentId}`, payload);
  return response.data;
}

async function deleteAppointment({ appointmentId } = {}) {
  if (!appointmentId) throw new Error("appointmentId is required");
  const client = locationClient();
  await client.delete(`/calendars/events/appointments/${appointmentId}`);
  return { success: true, appointmentId };
}

async function createBlockSlot({ locationId, calendarId, startTime, endTime, title, assignedUserId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!startTime) throw new Error("startTime is required");
  if (!endTime) throw new Error("endTime is required");
  const client = locationClient(locationId);
  const payload = { locationId, startTime, endTime };
  if (calendarId) payload.calendarId = calendarId;
  if (title) payload.title = title;
  if (assignedUserId) payload.assignedUserId = assignedUserId;
  const response = await client.post("/calendars/blocked-slots", payload);
  return response.data;
}

async function updateBlockSlot({ blockSlotId, startTime, endTime, title, calendarId, assignedUserId } = {}) {
  if (!blockSlotId) throw new Error("blockSlotId is required");
  const client = locationClient();
  const payload = {};
  if (startTime) payload.startTime = startTime;
  if (endTime) payload.endTime = endTime;
  if (title) payload.title = title;
  if (calendarId) payload.calendarId = calendarId;
  if (assignedUserId) payload.assignedUserId = assignedUserId;
  const response = await client.put(`/calendars/events/block-slots/${blockSlotId}`, payload);
  return response.data;
}

async function getAppointmentNotes({ appointmentId, limit = 10, offset = 0 } = {}) {
  if (!appointmentId) throw new Error("appointmentId is required");
  const client = locationClient();
  const response = await client.get(`/calendars/events/appointments/${appointmentId}/notes`, { params: { limit, offset } });
  return response.data;
}

async function createAppointmentNote({ appointmentId, body, userId } = {}) {
  if (!appointmentId) throw new Error("appointmentId is required");
  if (!body) throw new Error("body is required");
  const client = locationClient();
  const payload = { body };
  if (userId) payload.userId = userId;
  const response = await client.post(`/calendars/events/appointments/${appointmentId}/notes`, payload);
  return response.data;
}

async function updateAppointmentNote({ appointmentId, noteId, body, userId } = {}) {
  if (!appointmentId) throw new Error("appointmentId is required");
  if (!noteId) throw new Error("noteId is required");
  if (!body) throw new Error("body is required");
  const client = locationClient();
  const payload = { body };
  if (userId) payload.userId = userId;
  const response = await client.put(`/calendars/events/appointments/${appointmentId}/notes/${noteId}`, payload);
  return response.data;
}

async function deleteAppointmentNote({ appointmentId, noteId } = {}) {
  if (!appointmentId) throw new Error("appointmentId is required");
  if (!noteId) throw new Error("noteId is required");
  const client = locationClient();
  await client.delete(`/calendars/events/appointments/${appointmentId}/notes/${noteId}`);
  return { success: true, appointmentId, noteId };
}

async function getCalendarResources({ resourceType, locationId, limit = 20, skip = 0 } = {}) {
  if (!resourceType) throw new Error("resourceType is required (equipments or rooms)");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/calendars/resources/${resourceType}`, { params: { locationId, limit, skip } });
  return response.data;
}

async function createCalendarResource({ resourceType, locationId, name, description, quantity, isActive } = {}) {
  if (!resourceType) throw new Error("resourceType is required (equipments or rooms)");
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const payload = { locationId, name };
  if (description) payload.description = description;
  if (quantity !== undefined) payload.quantity = quantity;
  if (isActive !== undefined) payload.isActive = isActive;
  const response = await client.post(`/calendars/resources/${resourceType}`, payload);
  return response.data;
}

async function getCalendarResource({ resourceType, resourceId } = {}) {
  if (!resourceType) throw new Error("resourceType is required (equipments or rooms)");
  if (!resourceId) throw new Error("resourceId is required");
  const client = locationClient();
  const response = await client.get(`/calendars/resources/${resourceType}/${resourceId}`);
  return response.data;
}

async function updateCalendarResource({ resourceType, resourceId, name, description, quantity, isActive } = {}) {
  if (!resourceType) throw new Error("resourceType is required (equipments or rooms)");
  if (!resourceId) throw new Error("resourceId is required");
  const client = locationClient();
  const payload = {};
  if (name) payload.name = name;
  if (description) payload.description = description;
  if (quantity !== undefined) payload.quantity = quantity;
  if (isActive !== undefined) payload.isActive = isActive;
  const response = await client.put(`/calendars/resources/${resourceType}/${resourceId}`, payload);
  return response.data;
}

async function deleteCalendarResource({ resourceType, resourceId } = {}) {
  if (!resourceType) throw new Error("resourceType is required (equipments or rooms)");
  if (!resourceId) throw new Error("resourceId is required");
  const client = locationClient();
  await client.delete(`/calendars/resources/${resourceType}/${resourceId}`);
  return { success: true, resourceType, resourceId };
}

async function getCalendarNotifications({ calendarId } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  const client = locationClient();
  const response = await client.get(`/calendars/${calendarId}/notifications`);
  return response.data;
}

async function createCalendarNotification({ calendarId, type, channel, recipients, body, subject } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  if (!type) throw new Error("type is required");
  if (!channel) throw new Error("channel is required");
  const client = locationClient();
  const payload = { type, channel };
  if (recipients) payload.recipients = recipients;
  if (body) payload.body = body;
  if (subject) payload.subject = subject;
  const response = await client.post(`/calendars/${calendarId}/notifications`, payload);
  return response.data;
}

async function getCalendarNotification({ calendarId, notificationId } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  if (!notificationId) throw new Error("notificationId is required");
  const client = locationClient();
  const response = await client.get(`/calendars/${calendarId}/notifications/${notificationId}`);
  return response.data;
}

async function updateCalendarNotification({ calendarId, notificationId, type, channel, recipients, body, subject } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  if (!notificationId) throw new Error("notificationId is required");
  const client = locationClient();
  const payload = {};
  if (type) payload.type = type;
  if (channel) payload.channel = channel;
  if (recipients) payload.recipients = recipients;
  if (body) payload.body = body;
  if (subject) payload.subject = subject;
  const response = await client.put(`/calendars/${calendarId}/notifications/${notificationId}`, payload);
  return response.data;
}

async function deleteCalendarNotification({ calendarId, notificationId } = {}) {
  if (!calendarId) throw new Error("calendarId is required");
  if (!notificationId) throw new Error("notificationId is required");
  const client = locationClient();
  await client.delete(`/calendars/${calendarId}/notifications/${notificationId}`);
  return { success: true, calendarId, notificationId };
}

// ============================================================================
// LOCATION (extended)
// ============================================================================

async function getLocationById({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/locations/${locationId}`);
  return response.data;
}

async function createLocation({ name, email, phone, address, city, state, country, postalCode, website, timezone, companyId } = {}) {
  if (!name) throw new Error("name is required");
  const client = agencyClient();
  const payload = { name };
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (address) payload.address = address;
  if (city) payload.city = city;
  if (state) payload.state = state;
  if (country) payload.country = country;
  if (postalCode) payload.postalCode = postalCode;
  if (website) payload.website = website;
  if (timezone) payload.timezone = timezone;
  if (companyId) payload.companyId = companyId;
  const response = await client.post("/locations/", payload);
  return response.data;
}

async function updateLocation({ locationId, name, email, phone, address, city, state, country, postalCode, website, timezone } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = agencyClient();
  const payload = {};
  if (name) payload.name = name;
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (address) payload.address = address;
  if (city) payload.city = city;
  if (state) payload.state = state;
  if (country) payload.country = country;
  if (postalCode) payload.postalCode = postalCode;
  if (website) payload.website = website;
  if (timezone) payload.timezone = timezone;
  const response = await client.put(`/locations/${locationId}`, payload);
  return response.data;
}

async function deleteLocation({ locationId, deleteTwilioAccount = false } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = agencyClient();
  await client.delete(`/locations/${locationId}`, { params: { deleteTwilioAccount } });
  return { success: true, locationId };
}

async function getLocationTags({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/locations/${locationId}/tags`);
  return response.data;
}

async function createLocationTag({ locationId, name } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const response = await client.post(`/locations/${locationId}/tags`, { name });
  return response.data;
}

async function getLocationTag({ locationId, tagId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!tagId) throw new Error("tagId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/locations/${locationId}/tags/${tagId}`);
  return response.data;
}

async function updateLocationTag({ locationId, tagId, name } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!tagId) throw new Error("tagId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const response = await client.put(`/locations/${locationId}/tags/${tagId}`, { name });
  return response.data;
}

async function deleteLocationTag({ locationId, tagId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!tagId) throw new Error("tagId is required");
  const client = locationClient(locationId);
  await client.delete(`/locations/${locationId}/tags/${tagId}`);
  return { success: true, locationId, tagId };
}

async function searchLocationTasks({ locationId, status, assignedTo, contactId, limit = 25, skip = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (status) payload.status = status;
  if (assignedTo) payload.assignedTo = assignedTo;
  if (contactId) payload.contactId = contactId;
  if (limit) payload.limit = limit;
  if (skip) payload.skip = skip;
  const response = await client.post(`/locations/${locationId}/tasks/search`, payload);
  return response.data;
}

async function getLocationCustomFields({ locationId, model } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = {};
  if (model) params.model = model;
  const response = await client.get(`/locations/${locationId}/customFields`, { params });
  return response.data;
}

async function createLocationCustomField({ locationId, name, dataType, placeholder, options } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  if (!dataType) throw new Error("dataType is required");
  // Always use GHL_LOCATION_API_KEY — v1 endpoint, fieldKey is auto-generated by GHL
  const client = locationClient();
  const payload = { name, dataType };
  if (placeholder) payload.placeholder = placeholder;
  if (options) payload.options = options;
  const response = await client.post(`/locations/${locationId}/customFields`, payload);
  return response.data;
}

async function getLocationCustomField({ locationId, customFieldId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!customFieldId) throw new Error("customFieldId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/locations/${locationId}/customFields/${customFieldId}`);
  return response.data;
}

async function updateLocationCustomField({ locationId, customFieldId, name, placeholder, options } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!customFieldId) throw new Error("customFieldId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (name) payload.name = name;
  if (placeholder) payload.placeholder = placeholder;
  if (options) payload.options = options;
  const response = await client.put(`/locations/${locationId}/customFields/${customFieldId}`, payload);
  return response.data;
}

async function deleteLocationCustomField({ locationId, customFieldId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!customFieldId) throw new Error("customFieldId is required");
  const client = locationClient(locationId);
  await client.delete(`/locations/${locationId}/customFields/${customFieldId}`);
  return { success: true, locationId, customFieldId };
}

async function getLocationCustomValues({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/locations/${locationId}/customValues`);
  return response.data;
}

async function createLocationCustomValue({ locationId, name, fieldKey, value } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  if (!fieldKey) throw new Error("fieldKey is required");
  const client = locationClient(locationId);
  const payload = { name, fieldKey };
  if (value) payload.value = value;
  const response = await client.post(`/locations/${locationId}/customValues`, payload);
  return response.data;
}

async function getLocationCustomValue({ locationId, customValueId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!customValueId) throw new Error("customValueId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/locations/${locationId}/customValues/${customValueId}`);
  return response.data;
}

async function updateLocationCustomValue({ locationId, customValueId, name, value } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!customValueId) throw new Error("customValueId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (name) payload.name = name;
  if (value) payload.value = value;
  const response = await client.put(`/locations/${locationId}/customValues/${customValueId}`, payload);
  return response.data;
}

async function deleteLocationCustomValue({ locationId, customValueId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!customValueId) throw new Error("customValueId is required");
  const client = locationClient(locationId);
  await client.delete(`/locations/${locationId}/customValues/${customValueId}`);
  return { success: true, locationId, customValueId };
}

async function getLocationTemplates({ locationId, originId, type, deleted = false, skip = 0, limit = 25 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!originId) throw new Error("originId is required");
  const client = locationClient(locationId);
  const params = { originId, deleted, skip, limit };
  if (type) params.type = type;
  const response = await client.get(`/locations/${locationId}/templates`, { params });
  return response.data;
}

async function deleteLocationTemplate({ locationId, templateId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!templateId) throw new Error("templateId is required");
  const client = locationClient(locationId);
  await client.delete(`/locations/${locationId}/templates/${templateId}`);
  return { success: true, locationId, templateId };
}

async function getTimezones({ locationId } = {}) {
  const client = locationClient(locationId);
  const endpoint = locationId ? `/locations/${locationId}/timezones` : "/locations/timezones";
  const response = await client.get(endpoint);
  return response.data;
}

// ============================================================================
// BLOG
// ============================================================================

async function getBlogSites({ locationId, skip = 0, limit = 10, searchTerm } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, skip, limit };
  if (searchTerm) params.searchTerm = searchTerm;
  const response = await client.get("/blogs/site/all", { params });
  return response.data;
}

async function getBlogPosts({ locationId, blogId, limit = 10, offset = 0, searchTerm, status } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!blogId) throw new Error("blogId is required");
  const client = locationClient(locationId);
  const params = { locationId, blogId, limit, offset };
  if (searchTerm) params.searchTerm = searchTerm;
  if (status) params.status = status;
  const response = await client.get("/blogs/posts/all", { params });
  return response.data;
}

async function createBlogPost({ locationId, blogId, title, rawHTML, imageUrl, imageAltText, description, author, categories, tags, publishedAt, urlSlug, status } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!blogId) throw new Error("blogId is required");
  if (!title) throw new Error("title is required");
  if (!rawHTML) throw new Error("rawHTML is required");
  const client = locationClient(locationId);
  const payload = { locationId, blogId, title, rawHTML };
  if (imageUrl) payload.imageUrl = imageUrl;
  if (imageAltText) payload.imageAltText = imageAltText;
  if (description) payload.description = description;
  if (author) payload.author = author;
  if (categories) payload.categories = categories;
  if (tags) payload.tags = tags;
  if (publishedAt) payload.publishedAt = publishedAt;
  if (urlSlug) payload.urlSlug = urlSlug;
  if (status) payload.status = status;
  const response = await client.post("/blogs/posts", payload);
  return response.data;
}

async function updateBlogPost({ postId, locationId, title, rawHTML, imageUrl, imageAltText, description, author, categories, tags, urlSlug, status } = {}) {
  if (!postId) throw new Error("postId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { locationId };
  if (title) payload.title = title;
  if (rawHTML) payload.rawHTML = rawHTML;
  if (imageUrl) payload.imageUrl = imageUrl;
  if (imageAltText) payload.imageAltText = imageAltText;
  if (description) payload.description = description;
  if (author) payload.author = author;
  if (categories) payload.categories = categories;
  if (tags) payload.tags = tags;
  if (urlSlug) payload.urlSlug = urlSlug;
  if (status) payload.status = status;
  const response = await client.put(`/blogs/posts/${postId}`, payload);
  return response.data;
}

async function getBlogAuthors({ locationId, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/blogs/authors", { params: { locationId, limit, offset } });
  return response.data;
}

async function getBlogCategories({ locationId, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/blogs/categories", { params: { locationId, limit, offset } });
  return response.data;
}

async function checkBlogUrlSlug({ locationId, urlSlug, postId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!urlSlug) throw new Error("urlSlug is required");
  const client = locationClient(locationId);
  const params = { locationId, urlSlug };
  if (postId) params.postId = postId;
  const response = await client.get("/blogs/posts/url-slug-exists", { params });
  return response.data;
}

// ============================================================================
// EMAIL
// ============================================================================

async function getEmailCampaigns({ locationId, status, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (status) params.status = status;
  const response = await client.get("/emails/schedule", { params });
  return response.data;
}

async function createEmailTemplate({ locationId, title, html, previewText, isPlainText } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!title) throw new Error("title is required");
  if (!html) throw new Error("html is required");
  const client = locationClient(locationId);
  const payload = { locationId, type: "html", title, html };
  if (previewText) payload.previewText = previewText;
  if (isPlainText !== undefined) payload.isPlainText = isPlainText;
  const response = await client.post("/emails/builder", payload);
  return response.data;
}

async function getEmailTemplates({ locationId, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/emails/builder", { params: { locationId, limit, offset } });
  return response.data;
}

async function updateEmailTemplate({ locationId, templateId, title, html, previewText } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!templateId) throw new Error("templateId is required");
  const client = locationClient(locationId);
  const payload = { locationId, templateId, editorType: "html" };
  if (title) payload.title = title;
  if (html) payload.html = html;
  if (previewText) payload.previewText = previewText;
  const response = await client.post("/emails/builder/data", payload);
  return response.data;
}

async function deleteEmailTemplate({ locationId, templateId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!templateId) throw new Error("templateId is required");
  const client = locationClient(locationId);
  await client.delete(`/emails/builder/${locationId}/${templateId}`);
  return { success: true, locationId, templateId };
}

// ============================================================================
// EMAIL ISV (VERIFICATION)
// ============================================================================

async function verifyEmail({ locationId, type, verify } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!type) throw new Error("type is required (email or contact)");
  if (!verify) throw new Error("verify is required");
  const client = locationClient(locationId);
  const response = await client.post("/email/verify", { type, verify }, { params: { locationId } });
  return response.data;
}

// ============================================================================
// INVOICES
// ============================================================================

async function createInvoiceTemplate({ altId, altType = "location", name, currency, items, businessDetails, discount, termsNotes, title } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (name) payload.name = name;
  if (currency) payload.currency = currency;
  if (items) payload.items = items;
  if (businessDetails) payload.businessDetails = businessDetails;
  if (discount) payload.discount = discount;
  if (termsNotes) payload.termsNotes = termsNotes;
  if (title) payload.title = title;
  const response = await client.post("/invoices/template", payload);
  return response.data;
}

async function listInvoiceTemplates({ altId, altType = "location", status, startAt, endAt, search, limit = "10", offset = "0" } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = { altId, altType, limit, offset };
  if (status) params.status = status;
  if (startAt) params.startAt = startAt;
  if (endAt) params.endAt = endAt;
  if (search) params.search = search;
  const response = await client.get("/invoices/template", { params });
  return response.data;
}

async function getInvoiceTemplate({ templateId, altId, altType = "location" } = {}) {
  if (!templateId) throw new Error("templateId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const response = await client.get(`/invoices/template/${templateId}`, { params: { altId, altType } });
  return response.data;
}

async function updateInvoiceTemplate({ templateId, altId, altType = "location", name, currency, items } = {}) {
  if (!templateId) throw new Error("templateId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (name) payload.name = name;
  if (currency) payload.currency = currency;
  if (items) payload.items = items;
  const response = await client.put(`/invoices/template/${templateId}`, payload);
  return response.data;
}

async function deleteInvoiceTemplate({ templateId, altId, altType = "location" } = {}) {
  if (!templateId) throw new Error("templateId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  await client.delete(`/invoices/template/${templateId}`, { params: { altId, altType } });
  return { success: true, templateId };
}

async function createInvoiceSchedule({ altId, altType = "location", name, currency, contactId, items, discount } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const payload = { altId, altType, contactId };
  if (name) payload.name = name;
  if (currency) payload.currency = currency;
  if (items) payload.items = items;
  if (discount) payload.discount = discount;
  const response = await client.post("/invoices/schedule", payload);
  return response.data;
}

async function listInvoiceSchedules({ altId, altType = "location", status, limit = "10", offset = "0" } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = { altId, altType, limit, offset };
  if (status) params.status = status;
  const response = await client.get("/invoices/schedule", { params });
  return response.data;
}

async function getInvoiceSchedule({ scheduleId, altId, altType = "location" } = {}) {
  if (!scheduleId) throw new Error("scheduleId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const response = await client.get(`/invoices/schedule/${scheduleId}`, { params: { altId, altType } });
  return response.data;
}

async function deleteInvoiceSchedule({ scheduleId, altId, altType = "location" } = {}) {
  if (!scheduleId) throw new Error("scheduleId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  await client.delete(`/invoices/schedule/${scheduleId}`, { params: { altId, altType } });
  return { success: true, scheduleId };
}

async function cancelInvoiceSchedule({ scheduleId, altId, altType = "location" } = {}) {
  if (!scheduleId) throw new Error("scheduleId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const response = await client.post(`/invoices/schedule/${scheduleId}/cancel`, { altId, altType });
  return response.data;
}

async function generateInvoiceNumber({ altId, altType = "location" } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const response = await client.get("/invoices/generate-invoice-number", { params: { altId, altType } });
  return response.data;
}

async function createInvoice({ altId, altType = "location", contactId, currency, items, discount, title, dueDate, termsNotes } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const payload = { altId, altType, contactId };
  if (currency) payload.currency = currency;
  if (items) payload.items = items;
  if (discount) payload.discount = discount;
  if (title) payload.title = title;
  if (dueDate) payload.dueDate = dueDate;
  if (termsNotes) payload.termsNotes = termsNotes;
  const response = await client.post("/invoices/", payload);
  return response.data;
}

async function listInvoices({ altId, altType = "location", status, contactId, startAt, endAt, limit = "10", offset = "0" } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = { altId, altType, limit, offset };
  if (status) params.status = status;
  if (contactId) params.contactId = contactId;
  if (startAt) params.startAt = startAt;
  if (endAt) params.endAt = endAt;
  const response = await client.get("/invoices/", { params });
  return response.data;
}

async function getInvoice({ invoiceId, altId, altType = "location" } = {}) {
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const response = await client.get(`/invoices/${invoiceId}`, { params: { altId, altType } });
  return response.data;
}

async function updateInvoice({ invoiceId, altId, altType = "location", contactId, currency, items, discount, title, dueDate } = {}) {
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (contactId) payload.contactId = contactId;
  if (currency) payload.currency = currency;
  if (items) payload.items = items;
  if (discount) payload.discount = discount;
  if (title) payload.title = title;
  if (dueDate) payload.dueDate = dueDate;
  const response = await client.put(`/invoices/${invoiceId}`, payload);
  return response.data;
}

async function deleteInvoice({ invoiceId, altId, altType = "location" } = {}) {
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  await client.delete(`/invoices/${invoiceId}`, { params: { altId, altType } });
  return { success: true, invoiceId };
}

async function sendInvoice({ invoiceId, altId, altType = "location", action, userId } = {}) {
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (action) payload.action = action;
  if (userId) payload.userId = userId;
  const response = await client.post(`/invoices/${invoiceId}/send`, payload);
  return response.data;
}

async function recordInvoicePayment({ invoiceId, altId, altType = "location", mode, amount, notes } = {}) {
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (mode) payload.mode = mode;
  if (amount !== undefined) payload.amount = amount;
  if (notes) payload.notes = notes;
  const response = await client.post(`/invoices/${invoiceId}/record-payment`, payload);
  return response.data;
}

async function voidInvoice({ invoiceId, altId, altType = "location" } = {}) {
  if (!invoiceId) throw new Error("invoiceId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const response = await client.post(`/invoices/${invoiceId}/void`, { altId, altType });
  return response.data;
}

async function text2payInvoice({ altId, altType = "location", contactId, currency, items } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  if (!contactId) throw new Error("contactId is required");
  const client = locationClient();
  const payload = { altId, altType, contactId };
  if (currency) payload.currency = currency;
  if (items) payload.items = items;
  const response = await client.post("/invoices/text2pay", payload);
  return response.data;
}

// ============================================================================
// PAYMENTS
// ============================================================================

async function listOrders({ locationId, status, startAt, endAt, contactId, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (status) params.status = status;
  if (startAt) params.startAt = startAt;
  if (endAt) params.endAt = endAt;
  if (contactId) params.contactId = contactId;
  const response = await client.get("/payments/orders", { params });
  return response.data;
}

async function getOrder({ orderId, locationId, altId, altType } = {}) {
  if (!orderId) throw new Error("orderId is required");
  const client = locationClient(locationId);
  const params = {};
  if (locationId) params.locationId = locationId;
  if (altId) params.altId = altId;
  if (altType) params.altType = altType;
  const response = await client.get(`/payments/orders/${orderId}`, { params });
  return response.data;
}

async function createOrderFulfillment({ orderId, locationId, trackingNumber, trackingUrl, items } = {}) {
  if (!orderId) throw new Error("orderId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (locationId) payload.locationId = locationId;
  if (trackingNumber) payload.trackingNumber = trackingNumber;
  if (trackingUrl) payload.trackingUrl = trackingUrl;
  if (items) payload.items = items;
  const response = await client.post(`/payments/orders/${orderId}/fulfillments`, payload);
  return response.data;
}

async function listOrderFulfillments({ orderId, locationId } = {}) {
  if (!orderId) throw new Error("orderId is required");
  const client = locationClient(locationId);
  const params = {};
  if (locationId) params.locationId = locationId;
  const response = await client.get(`/payments/orders/${orderId}/fulfillments`, { params });
  return response.data;
}

async function listTransactions({ locationId, status, contactId, startAt, endAt, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (status) params.status = status;
  if (contactId) params.contactId = contactId;
  if (startAt) params.startAt = startAt;
  if (endAt) params.endAt = endAt;
  const response = await client.get("/payments/transactions", { params });
  return response.data;
}

async function getTransaction({ transactionId, locationId } = {}) {
  if (!transactionId) throw new Error("transactionId is required");
  const client = locationClient(locationId);
  const params = {};
  if (locationId) params.locationId = locationId;
  const response = await client.get(`/payments/transactions/${transactionId}`, { params });
  return response.data;
}

async function listSubscriptions({ locationId, status, contactId, startAt, endAt, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (status) params.status = status;
  if (contactId) params.contactId = contactId;
  if (startAt) params.startAt = startAt;
  if (endAt) params.endAt = endAt;
  const response = await client.get("/payments/subscriptions", { params });
  return response.data;
}

async function getSubscription({ subscriptionId, locationId } = {}) {
  if (!subscriptionId) throw new Error("subscriptionId is required");
  const client = locationClient(locationId);
  const params = {};
  if (locationId) params.locationId = locationId;
  const response = await client.get(`/payments/subscriptions/${subscriptionId}`, { params });
  return response.data;
}

async function listCoupons({ locationId, status, search, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (status) params.status = status;
  if (search) params.search = search;
  const response = await client.get("/payments/coupon/list", { params });
  return response.data;
}

async function getCoupon({ locationId, couponCode } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId };
  if (couponCode) params.couponCode = couponCode;
  const response = await client.get("/payments/coupon", { params });
  return response.data;
}

async function createCoupon({ locationId, name, code, discountType, discountValue, expiryDate, maxUses, productIds } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  if (!code) throw new Error("code is required");
  const client = locationClient(locationId);
  const payload = { locationId, name, code };
  if (discountType) payload.discountType = discountType;
  if (discountValue !== undefined) payload.discountValue = discountValue;
  if (expiryDate) payload.expiryDate = expiryDate;
  if (maxUses !== undefined) payload.maxUses = maxUses;
  if (productIds) payload.productIds = productIds;
  const response = await client.post("/payments/coupon", payload);
  return response.data;
}

async function updateCoupon({ locationId, couponId, name, discountType, discountValue, expiryDate, maxUses } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!couponId) throw new Error("couponId is required");
  const client = locationClient(locationId);
  const payload = { locationId, couponId };
  if (name) payload.name = name;
  if (discountType) payload.discountType = discountType;
  if (discountValue !== undefined) payload.discountValue = discountValue;
  if (expiryDate) payload.expiryDate = expiryDate;
  if (maxUses !== undefined) payload.maxUses = maxUses;
  const response = await client.put("/payments/coupon", payload);
  return response.data;
}

async function deleteCoupon({ locationId, couponId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!couponId) throw new Error("couponId is required");
  const client = locationClient(locationId);
  await client.delete("/payments/coupon", { data: { locationId, couponId } });
  return { success: true, couponId };
}

// ============================================================================
// PRODUCTS
// ============================================================================

async function createProduct({ locationId, name, description, productType, currency, image, statementDescriptor, availableInStore } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const payload = { locationId, name };
  if (description) payload.description = description;
  if (productType) payload.productType = productType;
  if (currency) payload.currency = currency;
  if (image) payload.image = image;
  if (statementDescriptor) payload.statementDescriptor = statementDescriptor;
  if (availableInStore !== undefined) payload.availableInStore = availableInStore;
  const response = await client.post("/products/", payload);
  return response.data;
}

async function getProduct({ productId, locationId } = {}) {
  if (!productId) throw new Error("productId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/products/${productId}`, { params: { locationId } });
  return response.data;
}

async function updateProduct({ productId, locationId, name, description, productType, currency, image, availableInStore } = {}) {
  if (!productId) throw new Error("productId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (locationId) payload.locationId = locationId;
  if (name) payload.name = name;
  if (description) payload.description = description;
  if (productType) payload.productType = productType;
  if (currency) payload.currency = currency;
  if (image) payload.image = image;
  if (availableInStore !== undefined) payload.availableInStore = availableInStore;
  const response = await client.put(`/products/${productId}`, payload);
  return response.data;
}

async function deleteProduct({ productId, locationId } = {}) {
  if (!productId) throw new Error("productId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  await client.delete(`/products/${productId}`, { params: { locationId } });
  return { success: true, productId };
}

async function listProducts({ locationId, limit = 10, offset = 0, search, collectionIds, availableInStore } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (search) params.search = search;
  if (collectionIds) params.collectionIds = collectionIds;
  if (availableInStore !== undefined) params.availableInStore = availableInStore;
  const response = await client.get("/products/", { params });
  return response.data;
}

async function createProductPrice({ productId, locationId, name, amount, type, currency, billingCycle, trialDays } = {}) {
  if (!productId) throw new Error("productId is required");
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  if (amount === undefined) throw new Error("amount is required");
  const client = locationClient(locationId);
  const payload = { locationId, name, amount };
  if (type) payload.type = type;
  if (currency) payload.currency = currency;
  if (billingCycle) payload.billingCycle = billingCycle;
  if (trialDays !== undefined) payload.trialDays = trialDays;
  const response = await client.post(`/products/${productId}/price`, payload);
  return response.data;
}

async function listProductPrices({ productId, locationId, limit = 10, offset = 0 } = {}) {
  if (!productId) throw new Error("productId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/products/${productId}/price`, { params: { locationId, limit, offset } });
  return response.data;
}

async function getProductPrice({ productId, priceId, locationId } = {}) {
  if (!productId) throw new Error("productId is required");
  if (!priceId) throw new Error("priceId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/products/${productId}/price/${priceId}`, { params: { locationId } });
  return response.data;
}

async function updateProductPrice({ productId, priceId, locationId, name, amount, currency } = {}) {
  if (!productId) throw new Error("productId is required");
  if (!priceId) throw new Error("priceId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (locationId) payload.locationId = locationId;
  if (name) payload.name = name;
  if (amount !== undefined) payload.amount = amount;
  if (currency) payload.currency = currency;
  const response = await client.put(`/products/${productId}/price/${priceId}`, payload);
  return response.data;
}

async function deleteProductPrice({ productId, priceId, locationId } = {}) {
  if (!productId) throw new Error("productId is required");
  if (!priceId) throw new Error("priceId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  await client.delete(`/products/${productId}/price/${priceId}`, { params: { locationId } });
  return { success: true, productId, priceId };
}

async function listInventory({ locationId, productId, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (productId) params.productId = productId;
  const response = await client.get("/products/inventory", { params });
  return response.data;
}

async function createProductCollection({ locationId, name, slug, description, seoTitle, seoDescription } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const payload = { locationId, name };
  if (slug) payload.slug = slug;
  if (description) payload.description = description;
  if (seoTitle) payload.seoTitle = seoTitle;
  if (seoDescription) payload.seoDescription = seoDescription;
  const response = await client.post("/products/collections", payload);
  return response.data;
}

async function listProductCollections({ locationId, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/products/collections", { params: { locationId, limit, offset } });
  return response.data;
}

async function deleteProductCollection({ collectionId, locationId } = {}) {
  if (!collectionId) throw new Error("collectionId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  await client.delete(`/products/collections/${collectionId}`, { params: { locationId } });
  return { success: true, collectionId };
}

async function listProductReviews({ locationId, productId, status, limit = 10, offset = 0 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, limit, offset };
  if (productId) params.productId = productId;
  if (status) params.status = status;
  const response = await client.get("/products/reviews", { params });
  return response.data;
}

async function updateProductReview({ reviewId, locationId, status, reply } = {}) {
  if (!reviewId) throw new Error("reviewId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { locationId };
  if (status) payload.status = status;
  if (reply) payload.reply = reply;
  const response = await client.put(`/products/reviews/${reviewId}`, payload);
  return response.data;
}

async function deleteProductReview({ reviewId, locationId } = {}) {
  if (!reviewId) throw new Error("reviewId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  await client.delete(`/products/reviews/${reviewId}`, { params: { locationId } });
  return { success: true, reviewId };
}

// ============================================================================
// SOCIAL MEDIA
// ============================================================================

async function searchSocialPosts({ locationId, skip = 0, limit = 10, accountIds, status, startDate, endDate } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { skip, limit };
  if (accountIds) payload.accountIds = accountIds;
  if (status) payload.status = status;
  if (startDate) payload.startDate = startDate;
  if (endDate) payload.endDate = endDate;
  const response = await client.post(`/social-media-posting/${locationId}/posts/list`, payload);
  return response.data;
}

async function createSocialPost({ locationId, type, accountIds, summary, scheduledAt, mediaUrls, tags, categoryIds } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!type) throw new Error("type is required");
  if (!accountIds || !accountIds.length) throw new Error("accountIds is required");
  const client = locationClient(locationId);
  const payload = { type, accountIds };
  if (summary) payload.summary = summary;
  if (scheduledAt) payload.scheduledAt = scheduledAt;
  if (mediaUrls) payload.mediaUrls = mediaUrls;
  if (tags) payload.tags = tags;
  if (categoryIds) payload.categoryIds = categoryIds;
  const response = await client.post(`/social-media-posting/${locationId}/posts`, payload);
  return response.data;
}

async function getSocialPost({ locationId, postId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!postId) throw new Error("postId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/social-media-posting/${locationId}/posts/${postId}`);
  return response.data;
}

async function updateSocialPost({ locationId, postId, summary, scheduledAt, mediaUrls, tags, categoryIds } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!postId) throw new Error("postId is required");
  const client = locationClient(locationId);
  const payload = {};
  if (summary) payload.summary = summary;
  if (scheduledAt) payload.scheduledAt = scheduledAt;
  if (mediaUrls) payload.mediaUrls = mediaUrls;
  if (tags) payload.tags = tags;
  if (categoryIds) payload.categoryIds = categoryIds;
  const response = await client.put(`/social-media-posting/${locationId}/posts/${postId}`, payload);
  return response.data;
}

async function deleteSocialPost({ locationId, postId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!postId) throw new Error("postId is required");
  const client = locationClient(locationId);
  await client.delete(`/social-media-posting/${locationId}/posts/${postId}`);
  return { success: true, postId };
}

async function bulkDeleteSocialPosts({ locationId, postIds } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!postIds || !postIds.length) throw new Error("postIds is required");
  const client = locationClient(locationId);
  const response = await client.post(`/social-media-posting/${locationId}/posts/bulk-delete`, { postIds });
  return response.data;
}

async function getSocialAccounts({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/social-media-posting/${locationId}/accounts`);
  return response.data;
}

async function deleteSocialAccount({ locationId, accountId, companyId, userId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!accountId) throw new Error("accountId is required");
  const client = locationClient(locationId);
  const params = {};
  if (companyId) params.companyId = companyId;
  if (userId) params.userId = userId;
  await client.delete(`/social-media-posting/${locationId}/accounts/${accountId}`, { params });
  return { success: true, accountId };
}

async function getSocialCSVUploadStatus({ locationId, skip, limit, includeUsers, userId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = {};
  if (skip !== undefined) params.skip = skip;
  if (limit !== undefined) params.limit = limit;
  if (includeUsers !== undefined) params.includeUsers = includeUsers;
  if (userId) params.userId = userId;
  const response = await client.get(`/social-media-posting/${locationId}/csv`, { params });
  return response.data;
}

async function getSocialCSVPosts({ locationId, csvId, skip, limit } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!csvId) throw new Error("csvId is required");
  const client = locationClient(locationId);
  const params = {};
  if (skip !== undefined) params.skip = skip;
  if (limit !== undefined) params.limit = limit;
  const response = await client.get(`/social-media-posting/${locationId}/csv/${csvId}`, { params });
  return response.data;
}

async function deleteSocialCSV({ locationId, csvId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!csvId) throw new Error("csvId is required");
  const client = locationClient(locationId);
  await client.delete(`/social-media-posting/${locationId}/csv/${csvId}`);
  return { success: true, csvId };
}

async function deleteSocialCSVPost({ locationId, csvId, postId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!csvId) throw new Error("csvId is required");
  if (!postId) throw new Error("postId is required");
  const client = locationClient(locationId);
  await client.delete(`/social-media-posting/${locationId}/csv/${csvId}/post/${postId}`);
  return { success: true, csvId, postId };
}

// ============================================================================
// SURVEYS
// ============================================================================

async function getSurveys({ locationId, skip = 0, limit = 50, type } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, skip, limit };
  if (type) params.type = type;
  const response = await client.get("/surveys/", { params });
  return response.data;
}

async function getSurveySubmissions({ locationId, surveyId, page = 1, limit = 25, q, startAt, endAt } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = new URLSearchParams();
  if (page) params.append("page", page.toString());
  if (limit) params.append("limit", limit.toString());
  if (surveyId) params.append("surveyId", surveyId);
  if (q) params.append("q", q);
  if (startAt) params.append("startAt", startAt);
  if (endAt) params.append("endAt", endAt);
  const response = await client.get(`/locations/${locationId}/surveys/submissions?${params.toString()}`);
  return response.data;
}

// ============================================================================
// WORKFLOWS
// ============================================================================

async function getWorkflows({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/workflows/", { params: { locationId } });
  return response.data;
}

// ============================================================================
// MEDIA
// ============================================================================

async function getMediaFiles({ altId, altType = "location", sortBy = "created_at", sortOrder = "desc", type, query, parentId, offset, limit } = {}) {
  if (!altId) throw new Error("altId is required");
  const client = locationClient();
  const params = { altId, altType, sortBy, sortOrder };
  if (type) params.type = type;
  if (query) params.query = query;
  if (parentId) params.parentId = parentId;
  if (offset !== undefined) params.offset = offset;
  if (limit !== undefined) params.limit = limit;
  const response = await client.get("/medias/files", { params });
  return response.data;
}

async function deleteMediaFile({ id, altId, altType = "location" } = {}) {
  if (!id) throw new Error("id is required");
  if (!altId) throw new Error("altId is required");
  const client = locationClient();
  await client.delete(`/medias/${id}`, { params: { altId, altType } });
  return { success: true, id };
}

// ============================================================================
// CUSTOM FIELDS V2
// ============================================================================

async function getCustomFieldV2ById({ id } = {}) {
  if (!id) throw new Error("id is required");
  const client = locationClient();
  const response = await client.get(`/custom-fields/${id}`);
  return response.data;
}

async function createCustomFieldV2({ locationId, dataType, objectKey, parentId, name, placeholder, isRequired, options } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  if (!dataType) throw new Error("dataType is required");
  if (!objectKey) throw new Error("objectKey is required");
  const fieldKey = `contact.${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
  const client = locationClient(locationId);
  const payload = { locationId, dataType, fieldKey, objectKey, name };
  if (parentId) payload.parentId = parentId;
  if (placeholder) payload.placeholder = placeholder;
  if (isRequired !== undefined) payload.isRequired = isRequired;
  if (options) payload.options = options;
  console.log("[create_custom_field_v2] request body:", JSON.stringify(payload));
  try {
    const response = await client.post("/custom-fields/", payload);
    return response.data;
  } catch (error) {
    console.log("[create_custom_field_v2] error:", error?.response?.status, JSON.stringify(error?.response?.data));
    throw error;
  }
}

async function updateCustomFieldV2({ id, locationId, name, placeholder, options } = {}) {
  if (!id) throw new Error("id is required");
  const client = locationClient(locationId);
  const payload = {};
  if (locationId) payload.locationId = locationId;
  if (name) payload.name = name;
  if (placeholder) payload.placeholder = placeholder;
  if (options) payload.options = options;
  const response = await client.put(`/custom-fields/${id}`, payload);
  return response.data;
}

async function deleteCustomFieldV2({ id } = {}) {
  if (!id) throw new Error("id is required");
  const client = locationClient();
  await client.delete(`/custom-fields/${id}`);
  return { success: true, id };
}

async function getCustomFieldsV2ByObjectKey({ objectKey, locationId } = {}) {
  if (!objectKey) throw new Error("objectKey is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/custom-fields/object-key/${objectKey}`, { params: { locationId } });
  return response.data;
}

async function createCustomFieldFolder({ locationId, name, objectKey } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  if (!objectKey) throw new Error("objectKey is required");
  const client = locationClient(locationId);
  const response = await client.post("/custom-fields/folder", { locationId, name, objectKey });
  return response.data;
}

async function updateCustomFieldFolder({ id, locationId, name } = {}) {
  if (!id) throw new Error("id is required");
  if (!locationId) throw new Error("locationId is required");
  if (!name) throw new Error("name is required");
  const client = locationClient(locationId);
  const response = await client.put(`/custom-fields/folder/${id}`, { locationId, name });
  return response.data;
}

async function deleteCustomFieldFolder({ id, locationId } = {}) {
  if (!id) throw new Error("id is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  await client.delete(`/custom-fields/folder/${id}`, { params: { locationId } });
  return { success: true, id };
}

// ============================================================================
// STORE (SHIPPING)
// ============================================================================

async function createShippingZone({ altId, altType = "location", name, countries } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  if (!name) throw new Error("name is required");
  const client = locationClient();
  const payload = { altId, altType, name };
  if (countries) payload.countries = countries;
  const response = await client.post("/store/shipping-zone", payload);
  return response.data;
}

async function listShippingZones({ altId, altType = "location", limit, offset, withShippingRate } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  if (limit) params.append("limit", limit.toString());
  if (offset) params.append("offset", offset.toString());
  if (withShippingRate !== undefined) params.append("withShippingRate", withShippingRate.toString());
  const response = await client.get(`/store/shipping-zone?${params.toString()}`);
  return response.data;
}

async function getShippingZone({ shippingZoneId, altId, altType = "location", withShippingRate } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  if (withShippingRate !== undefined) params.append("withShippingRate", withShippingRate.toString());
  const response = await client.get(`/store/shipping-zone/${shippingZoneId}?${params.toString()}`);
  return response.data;
}

async function updateShippingZone({ shippingZoneId, altId, altType = "location", name, countries } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (name) payload.name = name;
  if (countries) payload.countries = countries;
  const response = await client.put(`/store/shipping-zone/${shippingZoneId}`, payload);
  return response.data;
}

async function deleteShippingZone({ shippingZoneId, altId, altType = "location" } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  await client.delete(`/store/shipping-zone/${shippingZoneId}?${params.toString()}`);
  return { success: true, shippingZoneId };
}

async function createShippingRate({ shippingZoneId, altId, altType = "location", name, type, amount, minOrderAmount, maxOrderAmount } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  if (!name) throw new Error("name is required");
  const client = locationClient();
  const payload = { altId, altType, name };
  if (type) payload.type = type;
  if (amount !== undefined) payload.amount = amount;
  if (minOrderAmount !== undefined) payload.minOrderAmount = minOrderAmount;
  if (maxOrderAmount !== undefined) payload.maxOrderAmount = maxOrderAmount;
  const response = await client.post(`/store/shipping-zone/${shippingZoneId}/shipping-rate`, payload);
  return response.data;
}

async function listShippingRates({ shippingZoneId, altId, altType = "location", limit, offset } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  if (limit) params.append("limit", limit.toString());
  if (offset) params.append("offset", offset.toString());
  const response = await client.get(`/store/shipping-zone/${shippingZoneId}/shipping-rate?${params.toString()}`);
  return response.data;
}

async function getShippingRate({ shippingZoneId, shippingRateId, altId, altType = "location" } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!shippingRateId) throw new Error("shippingRateId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  const response = await client.get(`/store/shipping-zone/${shippingZoneId}/shipping-rate/${shippingRateId}?${params.toString()}`);
  return response.data;
}

async function updateShippingRate({ shippingZoneId, shippingRateId, altId, altType = "location", name, type, amount } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!shippingRateId) throw new Error("shippingRateId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (name) payload.name = name;
  if (type) payload.type = type;
  if (amount !== undefined) payload.amount = amount;
  const response = await client.put(`/store/shipping-zone/${shippingZoneId}/shipping-rate/${shippingRateId}`, payload);
  return response.data;
}

async function deleteShippingRate({ shippingZoneId, shippingRateId, altId, altType = "location" } = {}) {
  if (!shippingZoneId) throw new Error("shippingZoneId is required");
  if (!shippingRateId) throw new Error("shippingRateId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  await client.delete(`/store/shipping-zone/${shippingZoneId}/shipping-rate/${shippingRateId}?${params.toString()}`);
  return { success: true, shippingZoneId, shippingRateId };
}

async function createShippingCarrier({ altId, altType = "location", name, services } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  if (!name) throw new Error("name is required");
  const client = locationClient();
  const payload = { altId, altType, name };
  if (services) payload.services = services;
  const response = await client.post("/store/shipping-carrier", payload);
  return response.data;
}

async function listShippingCarriers({ altId, altType = "location" } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  const response = await client.get(`/store/shipping-carrier?${params.toString()}`);
  return response.data;
}

async function getShippingCarrier({ shippingCarrierId, altId, altType = "location" } = {}) {
  if (!shippingCarrierId) throw new Error("shippingCarrierId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  const response = await client.get(`/store/shipping-carrier/${shippingCarrierId}?${params.toString()}`);
  return response.data;
}

async function updateShippingCarrier({ shippingCarrierId, altId, altType = "location", name, services } = {}) {
  if (!shippingCarrierId) throw new Error("shippingCarrierId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (name) payload.name = name;
  if (services) payload.services = services;
  const response = await client.put(`/store/shipping-carrier/${shippingCarrierId}`, payload);
  return response.data;
}

async function deleteShippingCarrier({ shippingCarrierId, altId, altType = "location" } = {}) {
  if (!shippingCarrierId) throw new Error("shippingCarrierId is required");
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  await client.delete(`/store/shipping-carrier/${shippingCarrierId}?${params.toString()}`);
  return { success: true, shippingCarrierId };
}

async function createStoreSetting({ altId, altType = "location", originAddress, notificationEmails } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const payload = { altId, altType };
  if (originAddress) payload.originAddress = originAddress;
  if (notificationEmails) payload.notificationEmails = notificationEmails;
  const response = await client.post("/store/store-setting", payload);
  return response.data;
}

async function getStoreSetting({ altId, altType = "location" } = {}) {
  if (!altId) throw new Error("altId (locationId) is required");
  const client = locationClient();
  const params = new URLSearchParams({ altId, altType });
  const response = await client.get(`/store/store-setting?${params.toString()}`);
  return response.data;
}

// ============================================================================
// ASSOCIATIONS
// ============================================================================

async function getAllAssociations({ locationId, skip = 0, limit = 25 } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/associations/", { params: { locationId, skip: skip.toString(), limit: limit.toString() } });
  return response.data;
}

async function createAssociation({ locationId, label, key, fromObjectKey, toObjectKey, reverse } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!label) throw new Error("label is required");
  if (!fromObjectKey) throw new Error("fromObjectKey is required");
  if (!toObjectKey) throw new Error("toObjectKey is required");
  const client = locationClient(locationId);
  const payload = { locationId, label, fromObjectKey, toObjectKey };
  if (key) payload.key = key;
  if (reverse) payload.reverse = reverse;
  const response = await client.post("/associations/", payload);
  return response.data;
}

async function getAssociationById({ associationId } = {}) {
  if (!associationId) throw new Error("associationId is required");
  const client = locationClient();
  const response = await client.get(`/associations/${associationId}`);
  return response.data;
}

async function getAssociationByKey({ keyName, locationId } = {}) {
  if (!keyName) throw new Error("keyName is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get(`/associations/key/${keyName}`, { params: { locationId } });
  return response.data;
}

async function getAssociationByObjectKey({ objectKey, locationId } = {}) {
  if (!objectKey) throw new Error("objectKey is required");
  const client = locationClient(locationId);
  const params = {};
  if (locationId) params.locationId = locationId;
  const response = await client.get(`/associations/objectKey/${objectKey}`, { params });
  return response.data;
}

async function updateAssociation({ associationId, label, reverse } = {}) {
  if (!associationId) throw new Error("associationId is required");
  const client = locationClient();
  const payload = {};
  if (label) payload.label = label;
  if (reverse) payload.reverse = reverse;
  const response = await client.put(`/associations/${associationId}`, payload);
  return response.data;
}

async function deleteAssociation({ associationId } = {}) {
  if (!associationId) throw new Error("associationId is required");
  const client = locationClient();
  await client.delete(`/associations/${associationId}`);
  return { success: true, associationId };
}

async function createRelation({ locationId, associationId, firstRecordId, secondRecordId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!associationId) throw new Error("associationId is required");
  if (!firstRecordId) throw new Error("firstRecordId is required");
  if (!secondRecordId) throw new Error("secondRecordId is required");
  const client = locationClient(locationId);
  const response = await client.post("/associations/relations", { locationId, associationId, firstRecordId, secondRecordId });
  return response.data;
}

async function getRelationsByRecord({ recordId, locationId, skip = 0, limit = 25, associationIds } = {}) {
  if (!recordId) throw new Error("recordId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId, skip: skip.toString(), limit: limit.toString() };
  if (associationIds) params.associationIds = associationIds;
  const response = await client.get(`/associations/relations/${recordId}`, { params });
  return response.data;
}

async function deleteRelation({ relationId, locationId } = {}) {
  if (!relationId) throw new Error("relationId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  await client.delete(`/associations/relations/${relationId}`, { params: { locationId } });
  return { success: true, relationId };
}

// ============================================================================
// OBJECTS (CUSTOM)
// ============================================================================

async function getObjectsByLocation({ locationId } = {}) {
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const response = await client.get("/objects/", { params: { locationId } });
  return response.data;
}

async function createObjectSchema({ locationId, labels, key, properties } = {}) {
  if (!locationId) throw new Error("locationId is required");
  if (!labels) throw new Error("labels is required");
  const client = locationClient(locationId);
  const payload = { locationId, labels };
  if (key) payload.key = key;
  if (properties) payload.properties = properties;
  const response = await client.post("/objects/", payload);
  return response.data;
}

async function getObjectSchema({ key, locationId, fetchProperties } = {}) {
  if (!key) throw new Error("key is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const params = { locationId };
  if (fetchProperties !== undefined) params.fetchProperties = fetchProperties.toString();
  const response = await client.get(`/objects/${key}`, { params });
  return response.data;
}

async function updateObjectSchema({ key, locationId, labels, properties } = {}) {
  if (!key) throw new Error("key is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { locationId };
  if (labels) payload.labels = labels;
  if (properties) payload.properties = properties;
  const response = await client.put(`/objects/${key}`, payload);
  return response.data;
}

async function createObjectRecord({ schemaKey, locationId, properties, ownerId, followers } = {}) {
  if (!schemaKey) throw new Error("schemaKey is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { locationId };
  if (properties) payload.properties = properties;
  if (ownerId) payload.ownerId = ownerId;
  if (followers) payload.followers = followers;
  const response = await client.post(`/objects/${schemaKey}/records`, payload);
  return response.data;
}

async function getObjectRecord({ schemaKey, recordId } = {}) {
  if (!schemaKey) throw new Error("schemaKey is required");
  if (!recordId) throw new Error("recordId is required");
  const client = locationClient();
  const response = await client.get(`/objects/${schemaKey}/records/${recordId}`);
  return response.data;
}

async function updateObjectRecord({ schemaKey, recordId, locationId, properties, ownerId, followers } = {}) {
  if (!schemaKey) throw new Error("schemaKey is required");
  if (!recordId) throw new Error("recordId is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { locationId };
  if (properties) payload.properties = properties;
  if (ownerId) payload.ownerId = ownerId;
  if (followers) payload.followers = followers;
  const response = await client.put(`/objects/${schemaKey}/records/${recordId}`, payload, { params: { locationId } });
  return response.data;
}

async function deleteObjectRecord({ schemaKey, recordId } = {}) {
  if (!schemaKey) throw new Error("schemaKey is required");
  if (!recordId) throw new Error("recordId is required");
  const client = locationClient();
  await client.delete(`/objects/${schemaKey}/records/${recordId}`);
  return { success: true, schemaKey, recordId };
}

async function searchObjectRecords({ schemaKey, locationId, query, searchAfter, limit = 25 } = {}) {
  if (!schemaKey) throw new Error("schemaKey is required");
  if (!locationId) throw new Error("locationId is required");
  const client = locationClient(locationId);
  const payload = { locationId, limit };
  if (query) payload.query = query;
  if (searchAfter) payload.searchAfter = searchAfter;
  const response = await client.post(`/objects/${schemaKey}/records/search`, payload);
  return response.data;
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Contacts (extended)
  getContactTasks,
  createContactTask,
  getContactTask,
  updateContactTask,
  deleteContactTask,
  updateTaskCompletion,
  getContactNote,
  updateContactNote,
  deleteContactNote,
  upsertContact,
  getDuplicateContact,
  getContactsByBusiness,
  getContactAppointments,
  bulkUpdateContactTags,
  bulkUpdateContactBusiness,
  addContactFollowers,
  removeContactFollowers,
  addContactToCampaign,
  removeContactFromCampaign,
  removeContactFromAllCampaigns,
  addContactToWorkflow,
  removeContactFromWorkflow,

  // Conversations (extended)
  createConversation,
  updateConversation,
  deleteConversation,
  getMessage,
  getEmailMessage,
  cancelScheduledEmail,
  cancelScheduledMessage,
  addInboundMessage,
  addOutboundCall,
  updateMessageStatus,
  getMessageRecording,
  getMessageTranscription,
  downloadMessageTranscription,
  liveChatTyping,

  // Opportunities (extended)
  getOpportunity,
  updateOpportunityStatus,
  upsertOpportunity,
  addOpportunityFollowers,
  removeOpportunityFollowers,

  // Calendar (extended)
  getCalendarGroups,
  createCalendarGroup,
  updateCalendarGroup,
  deleteCalendarGroup,
  disableCalendarGroup,
  validateCalendarGroupSlug,
  createCalendar,
  getCalendar,
  updateCalendar,
  deleteCalendar,
  getFreeSlots,
  getBlockedSlots,
  createAppointment,
  getAppointment,
  updateAppointment,
  deleteAppointment,
  createBlockSlot,
  updateBlockSlot,
  getAppointmentNotes,
  createAppointmentNote,
  updateAppointmentNote,
  deleteAppointmentNote,
  getCalendarResources,
  createCalendarResource,
  getCalendarResource,
  updateCalendarResource,
  deleteCalendarResource,
  getCalendarNotifications,
  createCalendarNotification,
  getCalendarNotification,
  updateCalendarNotification,
  deleteCalendarNotification,

  // Location (extended)
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationTags,
  createLocationTag,
  getLocationTag,
  updateLocationTag,
  deleteLocationTag,
  searchLocationTasks,
  getLocationCustomFields,
  createLocationCustomField,
  getLocationCustomField,
  updateLocationCustomField,
  deleteLocationCustomField,
  getLocationCustomValues,
  createLocationCustomValue,
  getLocationCustomValue,
  updateLocationCustomValue,
  deleteLocationCustomValue,
  getLocationTemplates,
  deleteLocationTemplate,
  getTimezones,

  // Blog
  getBlogSites,
  getBlogPosts,
  createBlogPost,
  updateBlogPost,
  getBlogAuthors,
  getBlogCategories,
  checkBlogUrlSlug,

  // Email
  getEmailCampaigns,
  createEmailTemplate,
  getEmailTemplates,
  updateEmailTemplate,
  deleteEmailTemplate,

  // Email ISV
  verifyEmail,

  // Invoices
  createInvoiceTemplate,
  listInvoiceTemplates,
  getInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  createInvoiceSchedule,
  listInvoiceSchedules,
  getInvoiceSchedule,
  deleteInvoiceSchedule,
  cancelInvoiceSchedule,
  generateInvoiceNumber,
  createInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  recordInvoicePayment,
  voidInvoice,
  text2payInvoice,

  // Payments
  listOrders,
  getOrder,
  createOrderFulfillment,
  listOrderFulfillments,
  listTransactions,
  getTransaction,
  listSubscriptions,
  getSubscription,
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,

  // Products
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  createProductPrice,
  listProductPrices,
  getProductPrice,
  updateProductPrice,
  deleteProductPrice,
  listInventory,
  createProductCollection,
  listProductCollections,
  deleteProductCollection,
  listProductReviews,
  updateProductReview,
  deleteProductReview,

  // Social Media
  searchSocialPosts,
  createSocialPost,
  getSocialPost,
  updateSocialPost,
  deleteSocialPost,
  bulkDeleteSocialPosts,
  getSocialAccounts,
  deleteSocialAccount,
  getSocialCSVUploadStatus,
  getSocialCSVPosts,
  deleteSocialCSV,
  deleteSocialCSVPost,

  // Surveys
  getSurveys,
  getSurveySubmissions,

  // Workflows
  getWorkflows,

  // Media
  getMediaFiles,
  deleteMediaFile,

  // Custom Fields V2
  getCustomFieldV2ById,
  createCustomFieldV2,
  updateCustomFieldV2,
  deleteCustomFieldV2,
  getCustomFieldsV2ByObjectKey,
  createCustomFieldFolder,
  updateCustomFieldFolder,
  deleteCustomFieldFolder,

  // Store / Shipping
  createShippingZone,
  listShippingZones,
  getShippingZone,
  updateShippingZone,
  deleteShippingZone,
  createShippingRate,
  listShippingRates,
  getShippingRate,
  updateShippingRate,
  deleteShippingRate,
  createShippingCarrier,
  listShippingCarriers,
  getShippingCarrier,
  updateShippingCarrier,
  deleteShippingCarrier,
  createStoreSetting,
  getStoreSetting,

  // Associations
  getAllAssociations,
  createAssociation,
  getAssociationById,
  getAssociationByKey,
  getAssociationByObjectKey,
  updateAssociation,
  deleteAssociation,
  createRelation,
  getRelationsByRecord,
  deleteRelation,

  // Objects
  getObjectsByLocation,
  createObjectSchema,
  getObjectSchema,
  updateObjectSchema,
  createObjectRecord,
  getObjectRecord,
  updateObjectRecord,
  deleteObjectRecord,
  searchObjectRecords,
};
