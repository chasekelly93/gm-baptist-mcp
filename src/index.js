require("dotenv").config();

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express = require("express");
const { randomUUID } = require("node:crypto");
const reportsRouter = require("./routes/reports");
const syncRouter = require("./routes/sync");
const healthRouter = require("./routes/health");
const { z } = require("zod");
const {
  getSubAccounts, getContacts, createContact, getConversations, sendMessage, getMessages, getBillingCharges,
  getContact, updateContact, deleteContact, addContactTags, removeContactTags, searchContacts,
  getContactNotes, addContactNote, markConversationRead, getConversation,
  getPipelines, getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
  getCalendars, getAppointments, getUsers, getContactsByTag,
} = require("./tools");

const {
  // Contacts extended
  getContactTasks, createContactTask, getContactTask, updateContactTask, deleteContactTask,
  updateTaskCompletion, getContactNote, updateContactNote, deleteContactNote,
  upsertContact, getDuplicateContact, getContactsByBusiness, getContactAppointments,
  bulkUpdateContactTags, bulkUpdateContactBusiness, addContactFollowers, removeContactFollowers,
  addContactToCampaign, removeContactFromCampaign, removeContactFromAllCampaigns,
  addContactToWorkflow, removeContactFromWorkflow,
  // Conversations extended
  createConversation, updateConversation, deleteConversation, getMessage, getEmailMessage,
  cancelScheduledEmail, cancelScheduledMessage, addInboundMessage, addOutboundCall,
  updateMessageStatus, getMessageRecording, getMessageTranscription, downloadMessageTranscription,
  liveChatTyping,
  // Opportunities extended
  getOpportunity, updateOpportunityStatus, upsertOpportunity, addOpportunityFollowers, removeOpportunityFollowers,
  // Calendars extended
  getCalendarGroups, createCalendarGroup, updateCalendarGroup, deleteCalendarGroup,
  disableCalendarGroup, validateCalendarGroupSlug,
  createCalendar, getCalendar, updateCalendar, deleteCalendar, getFreeSlots, getBlockedSlots,
  createAppointment, getAppointment, updateAppointment, deleteAppointment,
  createBlockSlot, updateBlockSlot,
  getAppointmentNotes, createAppointmentNote, updateAppointmentNote, deleteAppointmentNote,
  getCalendarResources, createCalendarResource, getCalendarResource, updateCalendarResource, deleteCalendarResource,
  getCalendarNotifications, createCalendarNotification, getCalendarNotification, updateCalendarNotification, deleteCalendarNotification,
  // Locations
  getLocationById, createLocation, updateLocation, deleteLocation,
  getLocationTags, createLocationTag, getLocationTag, updateLocationTag, deleteLocationTag,
  searchLocationTasks,
  getLocationCustomFields, createLocationCustomField, getLocationCustomField, updateLocationCustomField, deleteLocationCustomField,
  getLocationCustomValues, createLocationCustomValue, getLocationCustomValue, updateLocationCustomValue, deleteLocationCustomValue,
  getLocationTemplates, deleteLocationTemplate, getTimezones,
  // Blogs
  getBlogSites, getBlogPosts, createBlogPost, updateBlogPost, getBlogAuthors, getBlogCategories, checkBlogUrlSlug,
  // Emails
  getEmailCampaigns, createEmailTemplate, getEmailTemplates, updateEmailTemplate, deleteEmailTemplate,
  // Email ISV
  verifyEmail,
  // Invoices
  createInvoiceTemplate, listInvoiceTemplates, getInvoiceTemplate, updateInvoiceTemplate, deleteInvoiceTemplate,
  createInvoiceSchedule, listInvoiceSchedules, getInvoiceSchedule, deleteInvoiceSchedule, cancelInvoiceSchedule,
  generateInvoiceNumber, createInvoice, listInvoices, getInvoice, updateInvoice, deleteInvoice,
  sendInvoice, recordInvoicePayment, voidInvoice, text2payInvoice,
  // Payments
  listOrders, getOrder, createOrderFulfillment, listOrderFulfillments,
  listTransactions, getTransaction, listSubscriptions, getSubscription,
  listCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon,
  // Products
  createProduct, getProduct, updateProduct, deleteProduct, listProducts,
  createProductPrice, listProductPrices, getProductPrice, updateProductPrice, deleteProductPrice,
  listInventory, createProductCollection, listProductCollections, deleteProductCollection,
  listProductReviews, updateProductReview, deleteProductReview,
  // Social media
  searchSocialPosts, createSocialPost, getSocialPost, updateSocialPost, deleteSocialPost, bulkDeleteSocialPosts,
  getSocialAccounts, deleteSocialAccount,
  getSocialCSVUploadStatus, getSocialCSVPosts, deleteSocialCSV, deleteSocialCSVPost,
  // Surveys
  getSurveys, getSurveySubmissions,
  // Workflows
  getWorkflows,
  // Media
  getMediaFiles, deleteMediaFile,
  // Custom Fields V2
  getCustomFieldV2ById, createCustomFieldV2, updateCustomFieldV2, deleteCustomFieldV2,
  getCustomFieldsV2ByObjectKey, createCustomFieldFolder, updateCustomFieldFolder, deleteCustomFieldFolder,
  // Store / Shipping
  createShippingZone, listShippingZones, getShippingZone, updateShippingZone, deleteShippingZone,
  createShippingRate, listShippingRates, getShippingRate, updateShippingRate, deleteShippingRate,
  createShippingCarrier, listShippingCarriers, getShippingCarrier, updateShippingCarrier, deleteShippingCarrier,
  createStoreSetting, getStoreSetting,
  // Associations
  getAllAssociations, createAssociation, getAssociationById, getAssociationByKey, getAssociationByObjectKey,
  updateAssociation, deleteAssociation, createRelation, getRelationsByRecord, deleteRelation,
  // Objects
  getObjectsByLocation, createObjectSchema, getObjectSchema, updateObjectSchema,
  createObjectRecord, getObjectRecord, updateObjectRecord, deleteObjectRecord, searchObjectRecords,
} = require("./tools-extended");

const {
  listApps: doListApps, getApp: doGetApp, listDeployments: doListDeployments,
  getDeployment: doGetDeployment, createDeployment: doCreateDeployment,
  getDeploymentLogs: doGetDeploymentLogs, getAppLogs: doGetAppLogs,
  cancelDeployment: doCancelDeployment, restartApp: doRestartApp,
} = require("./do-tools");

// ── Start HTTP server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// CORS — required for browser-based clients like Claude.ai
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// session ID → { transport }
const sessions = new Map();

function createServer() {
  const s = new McpServer({ name: "gm-baptist-mcp", version: "1.1.0" });

  // Global error wrapper for GHL tools — returns clear error messages instead of generic failures
  const ghlWrap = (fn) => async (args) => {
    try { return { content: [{ type: "text", text: JSON.stringify(await fn(args), null, 2) }] }; }
    catch (e) {
      const msg = e.response ? `GHL API ${e.response.status} on ${e.config?.method?.toUpperCase() || "?"} ${e.config?.url || "?"}: ${JSON.stringify(e.response.data)}` : e.message;
      return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
    }
  };

  s.tool("get_sub_accounts", "[Agency] List all sub-accounts (locations) under the agency.",
    { limit: z.number().int().min(1).max(100).default(10), skip: z.number().int().min(0).default(0) },
    ghlWrap(({ limit, skip }) => getSubAccounts({ limit, skip }))
  );
  s.tool("get_contacts", "[Location] Get contacts for a sub-account location.",
    { locationId: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0), query: z.string().optional() },
    ghlWrap(getContacts)
  );
  s.tool("create_contact", "[Location] Create a new contact in a GHL sub-account.",
    { locationId: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), tags: z.array(z.string()).optional(), source: z.string().optional() },
    ghlWrap(createContact)
  );
  s.tool("get_conversations", "[Location] Get conversations for a GHL location.",
    { locationId: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0), contactId: z.string().optional(), status: z.enum(["all","read","unread","open"]).optional() },
    ghlWrap(getConversations)
  );
  s.tool("send_message", "[Location] Send an SMS or Email via GHL.",
    { type: z.enum(["SMS","Email"]), locationId: z.string(), contactId: z.string().optional(), conversationId: z.string().optional(), message: z.string(), subject: z.string().optional(), emailFrom: z.string().optional(), emailFromName: z.string().optional() },
    ghlWrap(sendMessage)
  );
  s.tool("get_messages", "[Location] Get messages for a conversation.",
    { conversationId: z.string(), limit: z.number().int().min(1).max(100).default(20), lastMessageId: z.string().optional() },
    ghlWrap(getMessages)
  );
  s.tool("get_billing_charges", "[Agency] Get agency billing/wallet charges.",
    { startDate: z.string().optional(), endDate: z.string().optional(), locationId: z.string().optional(), limit: z.number().int().min(1).max(100).default(100), skip: z.number().int().min(0).default(0) },
    ghlWrap(getBillingCharges)
  );

  // ── Contact detail tools ───────────────────────────────────────────────────
  s.tool("get_contact", "[Location] Get full profile of a single contact by ID.",
    { contactId: z.string() },
    ghlWrap(getContact)
  );
  s.tool("update_contact", "[Location] Update fields on an existing contact.",
    { contactId: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), tags: z.array(z.string()).optional(), companyName: z.string().optional(), address1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), website: z.string().optional(), source: z.string().optional(), dnd: z.boolean().optional(), customFields: z.array(z.object({ id: z.string(), field_value: z.unknown() })).optional() },
    ghlWrap(updateContact)
  );
  s.tool("delete_contact", "[Location] Permanently delete a contact by ID.",
    { contactId: z.string() },
    ghlWrap(deleteContact)
  );
  s.tool("add_contact_tags", "[Location] Add tags to a contact.",
    { contactId: z.string(), tags: z.array(z.string()) },
    ghlWrap(addContactTags)
  );
  s.tool("remove_contact_tags", "[Location] Remove tags from a contact.",
    { contactId: z.string(), tags: z.array(z.string()) },
    ghlWrap(removeContactTags)
  );
  s.tool("search_contacts", "[Location] Search contacts in a location by name, email, or phone.",
    { locationId: z.string(), query: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    ghlWrap(searchContacts)
  );
  s.tool("get_contact_notes", "[Location] Get all notes on a contact.",
    { contactId: z.string() },
    ghlWrap(getContactNotes)
  );
  s.tool("add_contact_note", "[Location] Add a note to a contact.",
    { contactId: z.string(), body: z.string(), userId: z.string().optional() },
    ghlWrap(addContactNote)
  );

  // ── Conversation detail tools ──────────────────────────────────────────────
  s.tool("mark_conversation_read", "[Location] Mark a conversation as read (unreadCount = 0).",
    { conversationId: z.string() },
    ghlWrap(markConversationRead)
  );
  s.tool("get_conversation", "[Location] Get details of a single conversation by ID.",
    { conversationId: z.string() },
    ghlWrap(getConversation)
  );

  // ── Pipeline & opportunity tools ───────────────────────────────────────────
  s.tool("get_pipelines", "[Location] List all pipelines and their stages for a location.",
    { locationId: z.string() },
    ghlWrap(getPipelines)
  );
  s.tool("get_opportunities", "[Location] Search opportunities in a pipeline.",
    { locationId: z.string(), pipelineId: z.string().optional(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).optional(), contactId: z.string().optional(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    ghlWrap(getOpportunities)
  );
  s.tool("create_opportunity", "[Location] Create a new opportunity in a pipeline.",
    { locationId: z.string(), pipelineId: z.string(), name: z.string(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).default("open"), contactId: z.string().optional(), monetaryValue: z.number().optional(), assignedTo: z.string().optional() },
    ghlWrap(createOpportunity)
  );
  s.tool("update_opportunity", "[Location] Update an existing opportunity.",
    { opportunityId: z.string(), name: z.string().optional(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).optional(), monetaryValue: z.number().optional(), assignedTo: z.string().optional() },
    ghlWrap(updateOpportunity)
  );
  s.tool("delete_opportunity", "[Location] Delete an opportunity by ID.",
    { opportunityId: z.string() },
    ghlWrap(deleteOpportunity)
  );

  // ── Calendar & appointment tools ───────────────────────────────────────────
  s.tool("get_calendars", "[Location] List all calendars for a location.",
    { locationId: z.string() },
    ghlWrap(getCalendars)
  );
  s.tool("get_appointments", "[Location] Get upcoming appointments for a location or calendar.",
    { locationId: z.string(), calendarId: z.string().optional(), contactId: z.string().optional(), startTime: z.string().optional(), endTime: z.string().optional() },
    ghlWrap(getAppointments)
  );
  s.tool("get_users", "[Agency] Get users (team members) for a location. Requires users.readonly scope.",
    { locationId: z.string() },
    ghlWrap(getUsers)
  );
  s.tool("get_contacts_by_tag", "[Location] Get contacts filtered by one or more tags.",
    { locationId: z.string(), tags: z.array(z.string()), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    ghlWrap(getContactsByTag)
  );

  // ── Contacts extended ──────────────────────────────────────────────────────
  s.tool("get_contact_tasks", "[Location] Get all tasks for a contact.", { contactId: z.string() }, ghlWrap(getContactTasks));
  s.tool("create_contact_task", "[Location] Create a task for a contact.", { contactId: z.string(), title: z.string(), dueDate: z.string().optional(), status: z.string().optional(), assignedTo: z.string().optional(), description: z.string().optional() }, ghlWrap(createContactTask));
  s.tool("get_contact_task", "[Location] Get a single task for a contact.", { contactId: z.string(), taskId: z.string() }, ghlWrap(getContactTask));
  s.tool("update_contact_task", "[Location] Update a task for a contact.", { contactId: z.string(), taskId: z.string(), title: z.string().optional(), dueDate: z.string().optional(), status: z.string().optional(), description: z.string().optional() }, ghlWrap(updateContactTask));
  s.tool("delete_contact_task", "[Location] Delete a task from a contact.", { contactId: z.string(), taskId: z.string() }, ghlWrap(deleteContactTask));
  s.tool("update_task_completion", "[Location] Mark a contact task complete or incomplete.", { contactId: z.string(), taskId: z.string(), completed: z.boolean() }, ghlWrap(updateTaskCompletion));
  s.tool("get_contact_note", "[Location] Get a single note on a contact.", { contactId: z.string(), noteId: z.string() }, ghlWrap(getContactNote));
  s.tool("update_contact_note", "[Location] Update a note on a contact.", { contactId: z.string(), noteId: z.string(), body: z.string() }, ghlWrap(updateContactNote));
  s.tool("delete_contact_note", "[Location] Delete a note from a contact.", { contactId: z.string(), noteId: z.string() }, ghlWrap(deleteContactNote));
  s.tool("upsert_contact", "[Location] Create or update a contact by email/phone.", { locationId: z.string(), email: z.string().optional(), phone: z.string().optional(), firstName: z.string().optional(), lastName: z.string().optional() }, ghlWrap(upsertContact));
  s.tool("get_duplicate_contact", "[Location] Find a duplicate contact by email or phone.", { locationId: z.string(), email: z.string().optional(), phone: z.string().optional() }, ghlWrap(getDuplicateContact));
  s.tool("get_contacts_by_business", "[Location] Get contacts linked to a business.", { locationId: z.string(), businessId: z.string() }, ghlWrap(getContactsByBusiness));
  s.tool("get_contact_appointments", "[Location] Get appointments for a contact.", { contactId: z.string() }, ghlWrap(getContactAppointments));
  s.tool("bulk_update_contact_tags", "[Location] Bulk add or remove tags across contacts.", { locationId: z.string(), contactIds: z.array(z.string()), tags: z.array(z.string()), action: z.enum(["add", "remove"]) }, ghlWrap(bulkUpdateContactTags));
  s.tool("bulk_update_contact_business", "[Location] Bulk assign contacts to a business.", { locationId: z.string(), contactIds: z.array(z.string()), businessId: z.string() }, ghlWrap(bulkUpdateContactBusiness));
  s.tool("add_contact_followers", "[Location] Add followers to a contact.", { contactId: z.string(), followers: z.array(z.string()) }, ghlWrap(addContactFollowers));
  s.tool("remove_contact_followers", "[Location] Remove followers from a contact.", { contactId: z.string(), followers: z.array(z.string()) }, ghlWrap(removeContactFollowers));
  s.tool("add_contact_to_campaign", "[Location] Add a contact to a campaign.", { contactId: z.string(), campaignId: z.string() }, ghlWrap(addContactToCampaign));
  s.tool("remove_contact_from_campaign", "[Location] Remove a contact from a campaign.", { contactId: z.string(), campaignId: z.string() }, ghlWrap(removeContactFromCampaign));
  s.tool("remove_contact_from_all_campaigns", "[Location] Remove a contact from all campaigns.", { contactId: z.string() }, ghlWrap(removeContactFromAllCampaigns));
  s.tool("add_contact_to_workflow", "[Location] Add a contact to a workflow.", { contactId: z.string(), workflowId: z.string(), eventStartTime: z.string().optional() }, ghlWrap(addContactToWorkflow));
  s.tool("remove_contact_from_workflow", "[Location] Remove a contact from a workflow.", { contactId: z.string(), workflowId: z.string() }, ghlWrap(removeContactFromWorkflow));

  // ── Conversations extended ─────────────────────────────────────────────────
  s.tool("create_conversation", "[Location] Create a new conversation.", { locationId: z.string(), contactId: z.string() }, ghlWrap(createConversation));
  s.tool("update_conversation", "[Location] Update a conversation (e.g. mark read).", { conversationId: z.string(), unreadCount: z.number().optional(), starred: z.boolean().optional() }, ghlWrap(updateConversation));
  s.tool("delete_conversation", "[Location] Delete a conversation.", { conversationId: z.string() }, ghlWrap(deleteConversation));
  s.tool("get_message", "[Location] Get a single message by ID.", { messageId: z.string() }, ghlWrap(getMessage));
  s.tool("get_email_message", "[Location] Get an email message by ID.", { messageId: z.string() }, ghlWrap(getEmailMessage));
  s.tool("cancel_scheduled_email", "[Location] Cancel a scheduled email message.", { messageId: z.string() }, ghlWrap(cancelScheduledEmail));
  s.tool("cancel_scheduled_message", "[Location] Cancel a scheduled SMS/message.", { messageId: z.string() }, ghlWrap(cancelScheduledMessage));
  s.tool("add_inbound_message", "[Location] Simulate an inbound message on a conversation.", { conversationId: z.string(), type: z.string(), message: z.string() }, ghlWrap(addInboundMessage));
  s.tool("add_outbound_call", "[Location] Log an outbound call on a conversation.", { conversationId: z.string(), to: z.string(), from: z.string().optional() }, ghlWrap(addOutboundCall));
  s.tool("update_message_status", "[Location] Update the status of a message.", { messageId: z.string(), status: z.string() }, ghlWrap(updateMessageStatus));
  s.tool("get_message_recording", "[Location] Get the recording URL for a call message.", { messageId: z.string() }, ghlWrap(getMessageRecording));
  s.tool("get_message_transcription", "[Location] Get the transcription of a call message.", { messageId: z.string() }, ghlWrap(getMessageTranscription));
  s.tool("live_chat_typing", "[Location] Send a typing indicator in a live chat.", { conversationId: z.string(), typing: z.boolean() }, ghlWrap(liveChatTyping));

  // ── Opportunities extended ─────────────────────────────────────────────────
  s.tool("get_opportunity", "[Location] Get a single opportunity by ID.", { opportunityId: z.string() }, ghlWrap(getOpportunity));
  s.tool("update_opportunity_status", "[Location] Update the status of an opportunity.", { opportunityId: z.string(), status: z.enum(["open","won","lost","abandoned"]) }, ghlWrap(updateOpportunityStatus));
  s.tool("upsert_opportunity", "[Location] Create or update an opportunity.", { locationId: z.string(), pipelineId: z.string(), name: z.string(), contactId: z.string().optional(), pipelineStageId: z.string().optional(), monetaryValue: z.number().optional() }, ghlWrap(upsertOpportunity));
  s.tool("add_opportunity_followers", "[Location] Add followers to an opportunity.", { opportunityId: z.string(), followers: z.array(z.string()) }, ghlWrap(addOpportunityFollowers));
  s.tool("remove_opportunity_followers", "[Location] Remove followers from an opportunity.", { opportunityId: z.string(), followers: z.array(z.string()) }, ghlWrap(removeOpportunityFollowers));

  // ── Calendars extended ─────────────────────────────────────────────────────
  s.tool("get_calendar_groups", "[Location] Get all calendar groups for a location.", { locationId: z.string() }, ghlWrap(getCalendarGroups));
  s.tool("create_calendar_group", "[Location] Create a calendar group.", { locationId: z.string(), name: z.string(), description: z.string().optional() }, ghlWrap(createCalendarGroup));
  s.tool("update_calendar_group", "[Location] Update a calendar group.", { groupId: z.string(), name: z.string().optional(), description: z.string().optional() }, ghlWrap(updateCalendarGroup));
  s.tool("delete_calendar_group", "[Location] Delete a calendar group.", { groupId: z.string() }, ghlWrap(deleteCalendarGroup));
  s.tool("disable_calendar_group", "[Location] Enable or disable a calendar group.", { groupId: z.string(), isActive: z.boolean() }, ghlWrap(disableCalendarGroup));
  s.tool("validate_calendar_group_slug", "[Location] Check if a calendar group slug is available.", { locationId: z.string(), slug: z.string() }, ghlWrap(validateCalendarGroupSlug));
  s.tool("create_calendar", "[Location] Create a new calendar.", { locationId: z.string(), name: z.string(), description: z.string().optional(), calendarType: z.string().optional() }, ghlWrap(createCalendar));
  s.tool("get_calendar", "[Location] Get a calendar by ID.", { calendarId: z.string() }, ghlWrap(getCalendar));
  s.tool("update_calendar", "[Location] Update a calendar.", { calendarId: z.string(), name: z.string().optional(), description: z.string().optional() }, ghlWrap(updateCalendar));
  s.tool("delete_calendar", "[Location] Delete a calendar.", { calendarId: z.string() }, ghlWrap(deleteCalendar));
  s.tool("get_free_slots", "[Location] Get available booking slots for a calendar.", { calendarId: z.string(), startDate: z.string(), endDate: z.string(), timezone: z.string().optional() }, ghlWrap(getFreeSlots));
  s.tool("get_blocked_slots", "[Location] Get blocked time slots for a calendar.", { locationId: z.string(), startTime: z.string(), endTime: z.string(), calendarId: z.string().optional() }, ghlWrap(getBlockedSlots));
  s.tool("create_appointment", "[Location] Create a calendar appointment.", { calendarId: z.string(), locationId: z.string(), contactId: z.string(), startTime: z.string(), endTime: z.string().optional(), title: z.string().optional() }, ghlWrap(createAppointment));
  s.tool("get_appointment", "[Location] Get an appointment by ID.", { appointmentId: z.string() }, ghlWrap(getAppointment));
  s.tool("update_appointment", "[Location] Update an appointment.", { appointmentId: z.string(), startTime: z.string().optional(), endTime: z.string().optional(), status: z.string().optional(), title: z.string().optional() }, ghlWrap(updateAppointment));
  s.tool("delete_appointment", "[Location] Delete an appointment.", { appointmentId: z.string() }, ghlWrap(deleteAppointment));
  s.tool("create_block_slot", "[Location] Create a blocked time slot on a calendar.", { calendarId: z.string(), locationId: z.string(), startTime: z.string(), endTime: z.string(), title: z.string().optional() }, ghlWrap(createBlockSlot));
  s.tool("update_block_slot", "[Location] Update a blocked time slot.", { appointmentId: z.string(), startTime: z.string().optional(), endTime: z.string().optional(), title: z.string().optional() }, ghlWrap(updateBlockSlot));
  s.tool("get_appointment_notes", "[Location] Get notes for an appointment.", { calendarId: z.string(), appointmentId: z.string() }, ghlWrap(getAppointmentNotes));
  s.tool("create_appointment_note", "[Location] Add a note to an appointment.", { calendarId: z.string(), appointmentId: z.string(), body: z.string() }, ghlWrap(createAppointmentNote));
  s.tool("update_appointment_note", "[Location] Update a note on an appointment.", { calendarId: z.string(), appointmentId: z.string(), noteId: z.string(), body: z.string() }, ghlWrap(updateAppointmentNote));
  s.tool("delete_appointment_note", "[Location] Delete a note from an appointment.", { calendarId: z.string(), appointmentId: z.string(), noteId: z.string() }, ghlWrap(deleteAppointmentNote));
  s.tool("get_calendar_resources", "[Location] Get calendar resources (rooms or equipment).", { locationId: z.string(), resourceType: z.enum(["rooms","equipments"]) }, ghlWrap(getCalendarResources));
  s.tool("create_calendar_resource", "[Location] Create a calendar resource.", { locationId: z.string(), resourceType: z.enum(["rooms","equipments"]), name: z.string(), capacity: z.number().optional() }, ghlWrap(createCalendarResource));
  s.tool("get_calendar_resource", "[Location] Get a single calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string() }, ghlWrap(getCalendarResource));
  s.tool("update_calendar_resource", "[Location] Update a calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string(), name: z.string().optional(), capacity: z.number().optional() }, ghlWrap(updateCalendarResource));
  s.tool("delete_calendar_resource", "[Location] Delete a calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string() }, ghlWrap(deleteCalendarResource));
  s.tool("get_calendar_notifications", "[Location] Get notifications for a calendar.", { calendarId: z.string() }, ghlWrap(getCalendarNotifications));
  s.tool("create_calendar_notification", "[Location] Create a notification for a calendar.", { calendarId: z.string(), type: z.string(), value: z.number().optional() }, ghlWrap(createCalendarNotification));
  s.tool("get_calendar_notification", "[Location] Get a single calendar notification.", { calendarId: z.string(), notificationId: z.string() }, ghlWrap(getCalendarNotification));
  s.tool("update_calendar_notification", "[Location] Update a calendar notification.", { calendarId: z.string(), notificationId: z.string(), type: z.string().optional(), value: z.number().optional() }, ghlWrap(updateCalendarNotification));
  s.tool("delete_calendar_notification", "[Location] Delete a calendar notification.", { calendarId: z.string(), notificationId: z.string() }, ghlWrap(deleteCalendarNotification));

  // ── Locations ──────────────────────────────────────────────────────────────
  s.tool("get_location_by_id", "[Location] Get a location by ID.", { locationId: z.string() }, ghlWrap(getLocationById));
  s.tool("create_location", "[Agency] Create a new sub-account/location.", { name: z.string(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), country: z.string().optional() }, ghlWrap(createLocation));
  s.tool("update_location", "[Agency] Update a location.", { locationId: z.string(), name: z.string().optional(), phone: z.string().optional(), email: z.string().optional() }, ghlWrap(updateLocation));
  s.tool("delete_location", "[Agency] Delete a location.", { locationId: z.string(), deleteTwilioAccount: z.boolean().optional() }, ghlWrap(deleteLocation));
  s.tool("get_location_tags", "[Location] Get tags for a location.", { locationId: z.string() }, ghlWrap(getLocationTags));
  s.tool("create_location_tag", "[Location] Create a tag for a location.", { locationId: z.string(), name: z.string() }, ghlWrap(createLocationTag));
  s.tool("get_location_tag", "[Location] Get a location tag by ID.", { locationId: z.string(), tagId: z.string() }, ghlWrap(getLocationTag));
  s.tool("update_location_tag", "[Location] Update a location tag.", { locationId: z.string(), tagId: z.string(), name: z.string() }, ghlWrap(updateLocationTag));
  s.tool("delete_location_tag", "[Location] Delete a location tag.", { locationId: z.string(), tagId: z.string() }, ghlWrap(deleteLocationTag));
  s.tool("search_location_tasks", "[Location] Search tasks for a location.", { locationId: z.string() }, ghlWrap(searchLocationTasks));
  s.tool("get_location_custom_fields", "[Location] Get custom fields for a location.", { locationId: z.string() }, ghlWrap(getLocationCustomFields));
  s.tool("create_location_custom_field", "[Location] Create a custom field for a location.", { locationId: z.string(), name: z.string(), dataType: z.string(), placeholder: z.string().optional() }, ghlWrap(createLocationCustomField));
  s.tool("get_location_custom_field", "[Location] Get a location custom field by ID.", { locationId: z.string(), customFieldId: z.string() }, ghlWrap(getLocationCustomField));
  s.tool("update_location_custom_field", "[Location] Update a custom field for a location.", { locationId: z.string(), customFieldId: z.string(), name: z.string().optional() }, ghlWrap(updateLocationCustomField));
  s.tool("delete_location_custom_field", "[Location] Delete a custom field for a location.", { locationId: z.string(), customFieldId: z.string() }, ghlWrap(deleteLocationCustomField));
  s.tool("get_location_custom_values", "[Location] Get custom values for a location.", { locationId: z.string() }, ghlWrap(getLocationCustomValues));
  s.tool("create_location_custom_value", "[Location] Create a custom value for a location.", { locationId: z.string(), name: z.string(), value: z.string() }, ghlWrap(createLocationCustomValue));
  s.tool("get_location_custom_value", "[Location] Get a location custom value by ID.", { locationId: z.string(), customValueId: z.string() }, ghlWrap(getLocationCustomValue));
  s.tool("update_location_custom_value", "[Location] Update a custom value for a location.", { locationId: z.string(), customValueId: z.string(), name: z.string().optional(), value: z.string().optional() }, ghlWrap(updateLocationCustomValue));
  s.tool("delete_location_custom_value", "[Location] Delete a custom value for a location.", { locationId: z.string(), customValueId: z.string() }, ghlWrap(deleteLocationCustomValue));
  s.tool("get_location_templates", "[Location] Get templates for a location.", { locationId: z.string(), type: z.string().optional() }, ghlWrap(getLocationTemplates));
  s.tool("delete_location_template", "[Location] Delete a location template.", { locationId: z.string(), templateId: z.string() }, ghlWrap(deleteLocationTemplate));
  s.tool("get_timezones", "[Location] Get list of available timezones.", async () => ({ content: [{ type: "text", text: JSON.stringify(await getTimezones({}), null, 2) }] }));

  // ── Blogs ──────────────────────────────────────────────────────────────────
  s.tool("get_blog_sites", "[Location] Get blog sites for a location.", { locationId: z.string() }, ghlWrap(getBlogSites));
  s.tool("get_blog_posts", "[Location] Get blog posts for a location.", { locationId: z.string(), limit: z.number().optional(), skip: z.number().optional() }, ghlWrap(getBlogPosts));
  s.tool("create_blog_post", "[Location] Create a blog post.", { locationId: z.string(), title: z.string(), rawHTML: z.string().optional(), status: z.string().optional() }, ghlWrap(createBlogPost));
  s.tool("update_blog_post", "[Location] Update a blog post.", { locationId: z.string(), postId: z.string(), title: z.string().optional(), rawHTML: z.string().optional(), status: z.string().optional() }, ghlWrap(updateBlogPost));
  s.tool("get_blog_authors", "[Location] Get blog authors for a location.", { locationId: z.string() }, ghlWrap(getBlogAuthors));
  s.tool("get_blog_categories", "[Location] Get blog categories for a location.", { locationId: z.string() }, ghlWrap(getBlogCategories));
  s.tool("check_blog_url_slug", "[Location] Check if a blog URL slug is available.", { locationId: z.string(), slug: z.string() }, ghlWrap(checkBlogUrlSlug));

  // ── Emails ─────────────────────────────────────────────────────────────────
  s.tool("get_email_campaigns", "[Location] Get email campaigns for a location.", { locationId: z.string() }, ghlWrap(getEmailCampaigns));
  s.tool("create_email_template", "[Location] Create an email template.", { locationId: z.string(), name: z.string(), body: z.string().optional() }, ghlWrap(createEmailTemplate));
  s.tool("get_email_templates", "[Location] Get email templates for a location.", { locationId: z.string() }, ghlWrap(getEmailTemplates));
  s.tool("update_email_template", "[Location] Update an email template.", { locationId: z.string(), templateId: z.string(), name: z.string().optional(), body: z.string().optional() }, ghlWrap(updateEmailTemplate));
  s.tool("delete_email_template", "[Location] Delete an email template.", { locationId: z.string(), templateId: z.string() }, ghlWrap(deleteEmailTemplate));
  s.tool("verify_email", "[Location] Verify email deliverability.", { locationId: z.string(), email: z.string() }, ghlWrap(verifyEmail));

  // ── Invoices ───────────────────────────────────────────────────────────────
  s.tool("create_invoice_template", "[Location] Create an invoice template.", { locationId: z.string(), name: z.string() }, ghlWrap(createInvoiceTemplate));
  s.tool("list_invoice_templates", "[Location] List invoice templates.", { locationId: z.string() }, ghlWrap(listInvoiceTemplates));
  s.tool("get_invoice_template", "[Location] Get an invoice template by ID.", { locationId: z.string(), templateId: z.string() }, ghlWrap(getInvoiceTemplate));
  s.tool("update_invoice_template", "[Location] Update an invoice template.", { locationId: z.string(), templateId: z.string(), name: z.string().optional() }, ghlWrap(updateInvoiceTemplate));
  s.tool("delete_invoice_template", "[Location] Delete an invoice template.", { locationId: z.string(), templateId: z.string() }, ghlWrap(deleteInvoiceTemplate));
  s.tool("create_invoice_schedule", "[Location] Create an invoice schedule.", { locationId: z.string(), name: z.string() }, ghlWrap(createInvoiceSchedule));
  s.tool("list_invoice_schedules", "[Location] List invoice schedules.", { locationId: z.string() }, ghlWrap(listInvoiceSchedules));
  s.tool("get_invoice_schedule", "[Location] Get an invoice schedule by ID.", { locationId: z.string(), scheduleId: z.string() }, ghlWrap(getInvoiceSchedule));
  s.tool("delete_invoice_schedule", "[Location] Delete an invoice schedule.", { locationId: z.string(), scheduleId: z.string() }, ghlWrap(deleteInvoiceSchedule));
  s.tool("cancel_invoice_schedule", "[Location] Cancel an invoice schedule.", { locationId: z.string(), scheduleId: z.string() }, ghlWrap(cancelInvoiceSchedule));
  s.tool("generate_invoice_number", "[Location] Generate the next invoice number.", { locationId: z.string() }, ghlWrap(generateInvoiceNumber));
  s.tool("create_invoice", "[Location] Create an invoice.", { locationId: z.string(), contactId: z.string(), items: z.array(z.object({ name: z.string(), amount: z.number(), qty: z.number().optional() })).optional() }, ghlWrap(createInvoice));
  s.tool("list_invoices", "[Location] List invoices for a location.", { locationId: z.string(), contactId: z.string().optional(), status: z.string().optional() }, ghlWrap(listInvoices));
  s.tool("get_invoice", "[Location] Get an invoice by ID.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(getInvoice));
  s.tool("update_invoice", "[Location] Update an invoice.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(updateInvoice));
  s.tool("delete_invoice", "[Location] Delete an invoice.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(deleteInvoice));
  s.tool("send_invoice", "[Location] Send an invoice to a contact.", { locationId: z.string(), invoiceId: z.string(), sendEmail: z.boolean().optional() }, ghlWrap(sendInvoice));
  s.tool("record_invoice_payment", "[Location] Record a manual payment on an invoice.", { locationId: z.string(), invoiceId: z.string(), amount: z.number(), mode: z.string().optional() }, ghlWrap(recordInvoicePayment));
  s.tool("void_invoice", "[Location] Void an invoice.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(voidInvoice));

  // ── Payments ───────────────────────────────────────────────────────────────
  s.tool("list_orders", "[Location] List payment orders.", { locationId: z.string(), contactId: z.string().optional(), status: z.string().optional() }, ghlWrap(listOrders));
  s.tool("get_order", "[Location] Get a payment order by ID.", { locationId: z.string(), orderId: z.string() }, ghlWrap(getOrder));
  s.tool("create_order_fulfillment", "[Location] Create a fulfillment for an order.", { locationId: z.string(), orderId: z.string(), trackingNumber: z.string().optional() }, ghlWrap(createOrderFulfillment));
  s.tool("list_order_fulfillments", "[Location] List fulfillments for an order.", { locationId: z.string(), orderId: z.string() }, ghlWrap(listOrderFulfillments));
  s.tool("list_transactions", "[Location] List payment transactions.", { locationId: z.string(), contactId: z.string().optional() }, ghlWrap(listTransactions));
  s.tool("get_transaction", "[Location] Get a transaction by ID.", { locationId: z.string(), transactionId: z.string() }, ghlWrap(getTransaction));
  s.tool("list_subscriptions", "[Location] List payment subscriptions.", { locationId: z.string(), contactId: z.string().optional() }, ghlWrap(listSubscriptions));
  s.tool("get_subscription", "[Location] Get a subscription by ID.", { locationId: z.string(), subscriptionId: z.string() }, ghlWrap(getSubscription));
  s.tool("list_coupons", "[Location] List coupons for a location.", { locationId: z.string() }, ghlWrap(listCoupons));
  s.tool("get_coupon", "[Location] Get a coupon by ID.", { locationId: z.string(), couponId: z.string() }, ghlWrap(getCoupon));
  s.tool("create_coupon", "[Location] Create a coupon.", { locationId: z.string(), name: z.string(), code: z.string(), discountType: z.string(), discount: z.number() }, ghlWrap(createCoupon));
  s.tool("update_coupon", "[Location] Update a coupon.", { locationId: z.string(), couponId: z.string(), name: z.string().optional(), discount: z.number().optional() }, ghlWrap(updateCoupon));
  s.tool("delete_coupon", "[Location] Delete a coupon.", { locationId: z.string(), couponId: z.string() }, ghlWrap(deleteCoupon));

  // ── Products ───────────────────────────────────────────────────────────────
  s.tool("create_product", "[Location] Create a product.", { locationId: z.string(), name: z.string(), description: z.string().optional() }, ghlWrap(createProduct));
  s.tool("get_product", "[Location] Get a product by ID.", { locationId: z.string(), productId: z.string() }, ghlWrap(getProduct));
  s.tool("update_product", "[Location] Update a product.", { locationId: z.string(), productId: z.string(), name: z.string().optional(), description: z.string().optional() }, ghlWrap(updateProduct));
  s.tool("delete_product", "[Location] Delete a product.", { locationId: z.string(), productId: z.string() }, ghlWrap(deleteProduct));
  s.tool("list_products", "[Location] List products for a location.", { locationId: z.string() }, ghlWrap(listProducts));
  s.tool("create_product_price", "[Location] Create a price for a product.", { locationId: z.string(), productId: z.string(), name: z.string(), amount: z.number(), currency: z.string().optional() }, ghlWrap(createProductPrice));
  s.tool("list_product_prices", "[Location] List prices for a product.", { locationId: z.string(), productId: z.string() }, ghlWrap(listProductPrices));
  s.tool("get_product_price", "[Location] Get a product price by ID.", { locationId: z.string(), productId: z.string(), priceId: z.string() }, ghlWrap(getProductPrice));
  s.tool("update_product_price", "[Location] Update a product price.", { locationId: z.string(), productId: z.string(), priceId: z.string(), amount: z.number().optional() }, ghlWrap(updateProductPrice));
  s.tool("delete_product_price", "[Location] Delete a product price.", { locationId: z.string(), productId: z.string(), priceId: z.string() }, ghlWrap(deleteProductPrice));
  s.tool("list_inventory", "[Location] List inventory for a location.", { locationId: z.string() }, ghlWrap(listInventory));
  s.tool("create_product_collection", "[Location] Create a product collection.", { locationId: z.string(), name: z.string() }, ghlWrap(createProductCollection));
  s.tool("list_product_collections", "[Location] List product collections.", { locationId: z.string() }, ghlWrap(listProductCollections));

  // ── Social Media ───────────────────────────────────────────────────────────
  s.tool("search_social_posts", "[Location] Search social media posts.", { locationId: z.string(), skip: z.number().optional(), limit: z.number().optional() }, ghlWrap(searchSocialPosts));
  s.tool("create_social_post", "[Location] Create a social media post.", { locationId: z.string(), content: z.string(), accountIds: z.array(z.string()).optional(), scheduleDate: z.string().optional() }, ghlWrap(createSocialPost));
  s.tool("get_social_post", "[Location] Get a social media post by ID.", { locationId: z.string(), postId: z.string() }, ghlWrap(getSocialPost));
  s.tool("update_social_post", "[Location] Update a social media post.", { locationId: z.string(), postId: z.string(), content: z.string().optional() }, ghlWrap(updateSocialPost));
  s.tool("delete_social_post", "[Location] Delete a social media post.", { locationId: z.string(), postId: z.string() }, ghlWrap(deleteSocialPost));
  s.tool("bulk_delete_social_posts", "[Location] Bulk delete social media posts.", { locationId: z.string(), postIds: z.array(z.string()) }, ghlWrap(bulkDeleteSocialPosts));
  s.tool("get_social_accounts", "[Location] Get connected social media accounts.", { locationId: z.string() }, ghlWrap(getSocialAccounts));
  s.tool("delete_social_account", "[Location] Disconnect a social media account.", { locationId: z.string(), accountId: z.string() }, ghlWrap(deleteSocialAccount));

  // ── Surveys ────────────────────────────────────────────────────────────────
  s.tool("get_surveys", "[Location] List all surveys for a location.", { locationId: z.string() }, ghlWrap(getSurveys));
  s.tool("get_survey_submissions", "[Location] Get submissions for a survey.", { locationId: z.string(), surveyId: z.string().optional() }, ghlWrap(getSurveySubmissions));

  // ── Workflows ──────────────────────────────────────────────────────────────
  s.tool("get_workflows", "[Location] List all workflows for a location.", { locationId: z.string() }, ghlWrap(getWorkflows));

  // ── Media ──────────────────────────────────────────────────────────────────
  s.tool("get_media_files", "[Location] List media files for a location.", { locationId: z.string() }, ghlWrap(getMediaFiles));
  s.tool("delete_media_file", "[Location] Delete a media file.", { locationId: z.string(), fileId: z.string() }, ghlWrap(deleteMediaFile));

  // ── Custom Fields V2 ───────────────────────────────────────────────────────
  s.tool("get_custom_field_v2", "[Location] Get a custom field by ID (v2).", { customFieldId: z.string() }, ghlWrap(getCustomFieldV2ById));
  s.tool("create_custom_field_v2", "[Location] Create a custom field (v2). fieldKey is auto-generated from name as contact.{snake_case_name}.", { locationId: z.string(), name: z.string(), dataType: z.enum(["TEXT", "LARGE_TEXT", "NUMERICAL", "PHONE", "MONETARY", "CHECKBOX", "MULTIPLE_OPTIONS", "SINGLE_OPTIONS", "DATE", "TEXTBOX_LIST", "FILE_UPLOAD", "SIGNATURE"]), objectKey: z.string(), parentId: z.string().optional(), placeholder: z.string().optional(), isRequired: z.boolean().optional(), options: z.array(z.string()).optional() }, ghlWrap(createCustomFieldV2));
  s.tool("update_custom_field_v2", "[Location] Update a custom field (v2).", { customFieldId: z.string(), name: z.string().optional() }, ghlWrap(updateCustomFieldV2));
  s.tool("delete_custom_field_v2", "[Location] Delete a custom field (v2).", { customFieldId: z.string() }, ghlWrap(deleteCustomFieldV2));
  s.tool("get_custom_fields_v2_by_object_key", "[Location] Get custom fields by object key (v2).", { locationId: z.string(), objectKey: z.string() }, ghlWrap(getCustomFieldsV2ByObjectKey));
  s.tool("create_custom_field_folder", "[Location] Create a custom field folder.", { locationId: z.string(), name: z.string() }, ghlWrap(createCustomFieldFolder));
  s.tool("update_custom_field_folder", "[Location] Update a custom field folder.", { folderId: z.string(), name: z.string() }, ghlWrap(updateCustomFieldFolder));
  s.tool("delete_custom_field_folder", "[Location] Delete a custom field folder.", { folderId: z.string() }, ghlWrap(deleteCustomFieldFolder));

  // ── Store / Shipping ───────────────────────────────────────────────────────
  s.tool("create_shipping_zone", "[Location] Create a shipping zone.", { locationId: z.string(), name: z.string() }, ghlWrap(createShippingZone));
  s.tool("list_shipping_zones", "[Location] List shipping zones.", { locationId: z.string() }, ghlWrap(listShippingZones));
  s.tool("get_shipping_zone", "[Location] Get a shipping zone by ID.", { locationId: z.string(), zoneId: z.string() }, ghlWrap(getShippingZone));
  s.tool("update_shipping_zone", "[Location] Update a shipping zone.", { locationId: z.string(), zoneId: z.string(), name: z.string().optional() }, ghlWrap(updateShippingZone));
  s.tool("delete_shipping_zone", "[Location] Delete a shipping zone.", { locationId: z.string(), zoneId: z.string() }, ghlWrap(deleteShippingZone));
  s.tool("create_shipping_rate", "[Location] Create a shipping rate.", { locationId: z.string(), name: z.string(), amount: z.number().optional() }, ghlWrap(createShippingRate));
  s.tool("list_shipping_rates", "[Location] List shipping rates.", { locationId: z.string() }, ghlWrap(listShippingRates));
  s.tool("get_shipping_rate", "[Location] Get a shipping rate by ID.", { locationId: z.string(), rateId: z.string() }, ghlWrap(getShippingRate));
  s.tool("update_shipping_rate", "[Location] Update a shipping rate.", { locationId: z.string(), rateId: z.string(), name: z.string().optional(), amount: z.number().optional() }, ghlWrap(updateShippingRate));
  s.tool("delete_shipping_rate", "[Location] Delete a shipping rate.", { locationId: z.string(), rateId: z.string() }, ghlWrap(deleteShippingRate));
  s.tool("create_shipping_carrier", "[Location] Create a shipping carrier.", { locationId: z.string(), name: z.string() }, ghlWrap(createShippingCarrier));
  s.tool("list_shipping_carriers", "[Location] List shipping carriers.", { locationId: z.string() }, ghlWrap(listShippingCarriers));
  s.tool("get_shipping_carrier", "[Location] Get a shipping carrier by ID.", { locationId: z.string(), carrierId: z.string() }, ghlWrap(getShippingCarrier));
  s.tool("update_shipping_carrier", "[Location] Update a shipping carrier.", { locationId: z.string(), carrierId: z.string(), name: z.string().optional() }, ghlWrap(updateShippingCarrier));
  s.tool("delete_shipping_carrier", "[Location] Delete a shipping carrier.", { locationId: z.string(), carrierId: z.string() }, ghlWrap(deleteShippingCarrier));
  s.tool("create_store_setting", "[Location] Create store settings.", { locationId: z.string() }, ghlWrap(createStoreSetting));
  s.tool("get_store_setting", "[Location] Get store settings.", { locationId: z.string() }, ghlWrap(getStoreSetting));

  // ── Associations ───────────────────────────────────────────────────────────
  s.tool("get_all_associations", "[Location] Get all association types.", { locationId: z.string() }, ghlWrap(getAllAssociations));
  s.tool("create_association", "[Location] Create a new association type.", { locationId: z.string(), key: z.string(), firstLabel: z.string(), secondLabel: z.string() }, ghlWrap(createAssociation));
  s.tool("get_association_by_id", "[Location] Get an association by ID.", { associationId: z.string() }, ghlWrap(getAssociationById));
  s.tool("get_association_by_key", "[Location] Get an association by key.", { locationId: z.string(), key: z.string() }, ghlWrap(getAssociationByKey));
  s.tool("get_association_by_object_key", "[Location] Get associations by object key.", { locationId: z.string(), objectKey: z.string() }, ghlWrap(getAssociationByObjectKey));
  s.tool("update_association", "[Location] Update an association.", { associationId: z.string(), firstLabel: z.string().optional(), secondLabel: z.string().optional() }, ghlWrap(updateAssociation));
  s.tool("delete_association", "[Location] Delete an association type.", { associationId: z.string() }, ghlWrap(deleteAssociation));
  s.tool("create_relation", "[Location] Link two records together.", { associationId: z.string(), firstRecordId: z.string(), secondRecordId: z.string() }, ghlWrap(createRelation));
  s.tool("get_relations_by_record", "[Location] Get all relations for a record.", { locationId: z.string(), recordId: z.string() }, ghlWrap(getRelationsByRecord));
  s.tool("delete_relation", "[Location] Delete a relation between two records.", { relationId: z.string() }, ghlWrap(deleteRelation));

  // ── Objects ────────────────────────────────────────────────────────────────
  s.tool("get_objects_by_location", "[Location] Get custom object schemas for a location.", { locationId: z.string() }, ghlWrap(getObjectsByLocation));
  s.tool("create_object_schema", "[Location] Create a custom object schema.", { locationId: z.string(), key: z.string(), singular: z.string(), plural: z.string() }, ghlWrap(createObjectSchema));
  s.tool("get_object_schema", "[Location] Get a custom object schema.", { locationId: z.string(), schemaId: z.string() }, ghlWrap(getObjectSchema));
  s.tool("update_object_schema", "[Location] Update a custom object schema.", { locationId: z.string(), schemaId: z.string(), singular: z.string().optional(), plural: z.string().optional() }, ghlWrap(updateObjectSchema));
  s.tool("create_object_record", "[Location] Create a record in a custom object.", { locationId: z.string(), schemaId: z.string(), properties: z.record(z.string(), z.unknown()).optional() }, ghlWrap(createObjectRecord));
  s.tool("get_object_record", "[Location] Get a custom object record by ID.", { locationId: z.string(), schemaId: z.string(), recordId: z.string() }, ghlWrap(getObjectRecord));
  s.tool("update_object_record", "[Location] Update a custom object record.", { locationId: z.string(), schemaId: z.string(), recordId: z.string(), properties: z.record(z.string(), z.unknown()).optional() }, ghlWrap(updateObjectRecord));
  s.tool("delete_object_record", "[Location] Delete a custom object record.", { locationId: z.string(), schemaId: z.string(), recordId: z.string() }, ghlWrap(deleteObjectRecord));
  s.tool("search_object_records", "[Location] Search records in a custom object.", { locationId: z.string(), schemaId: z.string(), query: z.string().optional() }, ghlWrap(searchObjectRecords));

  s.tool("run_sync", "[Location] Sync location IDs to contact custom fields. Loops through all GHL sub-accounts and writes the location ID to the GHL Location ID custom field on the matching contact in the primary location.",
    { confirm: z.string().optional().describe("Pass 'yes' to confirm sync start") },
    async () => {
      runSync().catch((err) => console.error("[sync] fatal:", err.message));
      return { content: [{ type: "text", text: JSON.stringify({ message: "Sync started", timestamp: new Date().toISOString() }) }] };
    }
  );

  // ── DigitalOcean App Platform ─────────────────────────────────────────────
  const doWrap = (fn) => async (args) => {
    try { return { content: [{ type: "text", text: JSON.stringify(await fn(args), null, 2) }] }; }
    catch (e) {
      const msg = e.response ? `DO API ${e.response.status}: ${JSON.stringify(e.response.data)}` : e.message;
      return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
    }
  };
  s.tool("do_check_token", "Diagnostic: check if DIGITALOCEAN_API_TOKEN is set and valid (does not expose the token).", {}, async () => {
    const token = process.env.DIGITALOCEAN_API_TOKEN;
    if (!token) return { content: [{ type: "text", text: "DIGITALOCEAN_API_TOKEN is NOT set" }], isError: true };
    const info = { length: token.length, prefix: token.substring(0, 4) + "...", hasWhitespace: token !== token.trim(), hasQuotes: token.includes('"') || token.includes("'") };
    try {
      const res = await require("axios").get("https://api.digitalocean.com/v2/account", { headers: { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" } });
      info.apiStatus = res.status;
      info.email = res.data?.account?.email;
    } catch (e) { info.apiStatus = e.response?.status; info.apiError = e.response?.data || e.message; }
    return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
  });
  s.tool("do_list_apps", "List all DigitalOcean apps.", {}, doWrap(() => doListApps()));
  s.tool("do_get_app", "Get details of a DigitalOcean app including deploy status.", { appId: z.string() }, doWrap(doGetApp));
  s.tool("do_list_deployments", "List recent deployments for a DigitalOcean app.", { appId: z.string(), limit: z.number().int().min(1).max(50).default(10) }, doWrap(doListDeployments));
  s.tool("do_get_deployment", "Get details of a specific deployment.", { appId: z.string(), deploymentId: z.string() }, doWrap(doGetDeployment));
  s.tool("do_create_deployment", "Trigger a new deployment (redeploy) for a DigitalOcean app.", { appId: z.string(), forceBuild: z.boolean().default(false) }, doWrap(doCreateDeployment));
  s.tool("do_get_deployment_logs", "Get build or deploy logs for a deployment.", { appId: z.string(), deploymentId: z.string(), component: z.string(), logType: z.enum(["BUILD", "DEPLOY", "RUN"]).default("BUILD") }, doWrap(doGetDeploymentLogs));
  s.tool("do_get_app_logs", "Get runtime logs for a running DigitalOcean app.", { appId: z.string(), component: z.string(), logType: z.enum(["BUILD", "DEPLOY", "RUN"]).default("RUN") }, doWrap(doGetAppLogs));
  s.tool("do_cancel_deployment", "Cancel an in-progress deployment.", { appId: z.string(), deploymentId: z.string() }, doWrap(doCancelDeployment));
  s.tool("do_restart_app", "Force restart a DigitalOcean app (triggers a force rebuild).", { appId: z.string() }, doWrap(doRestartApp));

  return s;
}

// ── Routes ──
app.use("/api", reportsRouter);
app.use("/sync", syncRouter);
app.use("/health", healthRouter);

// MCP GET — SSE stream for existing session
app.get("/mcp", async (req, res) => {
  req.headers["accept"] = "application/json, text/event-stream";
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: "Invalid or missing session ID" });
  }
  await sessions.get(sessionId).handleRequest(req, res);
});

// MCP POST — initialize or continue session
app.post("/mcp", async (req, res) => {
  req.headers["accept"] = "application/json, text/event-stream";
  const sessionId = req.headers["mcp-session-id"];

  if (sessionId && sessions.has(sessionId)) {
    await sessions.get(sessionId).handleRequest(req, res, req.body);
    return;
  }

  const mcpServer = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => sessions.set(id, transport),
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// MCP DELETE — close session
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId);
    sessions.delete(sessionId);
    await transport.close();
  }
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`GM Baptist MCP server listening on port ${PORT}`);
});
