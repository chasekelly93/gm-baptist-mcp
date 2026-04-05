require("dotenv").config();

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express = require("express");
const { randomUUID } = require("node:crypto");
const { runSync } = require("../sync");
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

  s.tool("get_sub_accounts", "List all sub-accounts (locations) under the agency.",
    { limit: z.number().int().min(1).max(100).default(10), skip: z.number().int().min(0).default(0) },
    ghlWrap(({ limit, skip }) => getSubAccounts({ limit, skip }))
  );
  s.tool("get_contacts", "Get contacts for a sub-account location.",
    { locationId: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0), query: z.string().optional() },
    ghlWrap(getContacts)
  );
  s.tool("create_contact", "Create a new contact in a GHL sub-account.",
    { locationId: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), tags: z.array(z.string()).optional(), source: z.string().optional() },
    ghlWrap(createContact)
  );
  s.tool("get_conversations", "Get conversations for a GHL location.",
    { locationId: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0), contactId: z.string().optional(), status: z.enum(["all","read","unread","open"]).optional() },
    ghlWrap(getConversations)
  );
  s.tool("send_message", "Send an SMS or Email via GHL.",
    { type: z.enum(["SMS","Email"]), locationId: z.string(), contactId: z.string().optional(), conversationId: z.string().optional(), message: z.string(), subject: z.string().optional(), emailFrom: z.string().optional(), emailFromName: z.string().optional() },
    ghlWrap(sendMessage)
  );
  s.tool("get_messages", "Get messages for a conversation.",
    { conversationId: z.string(), limit: z.number().int().min(1).max(100).default(20), lastMessageId: z.string().optional() },
    ghlWrap(getMessages)
  );
  s.tool("get_billing_charges", "Get agency billing/wallet charges.",
    { startDate: z.string().optional(), endDate: z.string().optional(), locationId: z.string().optional(), limit: z.number().int().min(1).max(100).default(100), skip: z.number().int().min(0).default(0) },
    ghlWrap(getBillingCharges)
  );

  // ── Contact detail tools ───────────────────────────────────────────────────
  s.tool("get_contact", "Get full profile of a single contact by ID.",
    { contactId: z.string() },
    ghlWrap(getContact)
  );
  s.tool("update_contact", "Update fields on an existing contact.",
    { contactId: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), tags: z.array(z.string()).optional(), companyName: z.string().optional(), address1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), website: z.string().optional(), source: z.string().optional(), dnd: z.boolean().optional(), customFields: z.array(z.object({ id: z.string(), field_value: z.unknown() })).optional() },
    ghlWrap(updateContact)
  );
  s.tool("delete_contact", "Permanently delete a contact by ID.",
    { contactId: z.string() },
    ghlWrap(deleteContact)
  );
  s.tool("add_contact_tags", "Add tags to a contact.",
    { contactId: z.string(), tags: z.array(z.string()) },
    ghlWrap(addContactTags)
  );
  s.tool("remove_contact_tags", "Remove tags from a contact.",
    { contactId: z.string(), tags: z.array(z.string()) },
    ghlWrap(removeContactTags)
  );
  s.tool("search_contacts", "Search contacts in a location by name, email, or phone.",
    { locationId: z.string(), query: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    ghlWrap(searchContacts)
  );
  s.tool("get_contact_notes", "Get all notes on a contact.",
    { contactId: z.string() },
    ghlWrap(getContactNotes)
  );
  s.tool("add_contact_note", "Add a note to a contact.",
    { contactId: z.string(), body: z.string(), userId: z.string().optional() },
    ghlWrap(addContactNote)
  );

  // ── Conversation detail tools ──────────────────────────────────────────────
  s.tool("mark_conversation_read", "Mark a conversation as read (unreadCount = 0).",
    { conversationId: z.string() },
    ghlWrap(markConversationRead)
  );
  s.tool("get_conversation", "Get details of a single conversation by ID.",
    { conversationId: z.string() },
    ghlWrap(getConversation)
  );

  // ── Pipeline & opportunity tools ───────────────────────────────────────────
  s.tool("get_pipelines", "List all pipelines and their stages for a location.",
    { locationId: z.string() },
    ghlWrap(getPipelines)
  );
  s.tool("get_opportunities", "Search opportunities in a pipeline.",
    { locationId: z.string(), pipelineId: z.string().optional(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).optional(), contactId: z.string().optional(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    ghlWrap(getOpportunities)
  );
  s.tool("create_opportunity", "Create a new opportunity in a pipeline.",
    { locationId: z.string(), pipelineId: z.string(), name: z.string(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).default("open"), contactId: z.string().optional(), monetaryValue: z.number().optional(), assignedTo: z.string().optional() },
    ghlWrap(createOpportunity)
  );
  s.tool("update_opportunity", "Update an existing opportunity.",
    { opportunityId: z.string(), name: z.string().optional(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).optional(), monetaryValue: z.number().optional(), assignedTo: z.string().optional() },
    ghlWrap(updateOpportunity)
  );
  s.tool("delete_opportunity", "Delete an opportunity by ID.",
    { opportunityId: z.string() },
    ghlWrap(deleteOpportunity)
  );

  // ── Calendar & appointment tools ───────────────────────────────────────────
  s.tool("get_calendars", "List all calendars for a location.",
    { locationId: z.string() },
    ghlWrap(getCalendars)
  );
  s.tool("get_appointments", "Get upcoming appointments for a location or calendar.",
    { locationId: z.string(), calendarId: z.string().optional(), contactId: z.string().optional(), startTime: z.string().optional(), endTime: z.string().optional() },
    ghlWrap(getAppointments)
  );
  s.tool("get_users", "Get users (team members) for a location. Requires users.readonly scope.",
    { locationId: z.string() },
    ghlWrap(getUsers)
  );
  s.tool("get_contacts_by_tag", "Get contacts filtered by one or more tags.",
    { locationId: z.string(), tags: z.array(z.string()), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    ghlWrap(getContactsByTag)
  );

  // ── Contacts extended ──────────────────────────────────────────────────────
  s.tool("get_contact_tasks", "Get all tasks for a contact.", { contactId: z.string() }, ghlWrap(getContactTasks));
  s.tool("create_contact_task", "Create a task for a contact.", { contactId: z.string(), title: z.string(), dueDate: z.string().optional(), status: z.string().optional(), assignedTo: z.string().optional(), description: z.string().optional() }, ghlWrap(createContactTask));
  s.tool("get_contact_task", "Get a single task for a contact.", { contactId: z.string(), taskId: z.string() }, ghlWrap(getContactTask));
  s.tool("update_contact_task", "Update a task for a contact.", { contactId: z.string(), taskId: z.string(), title: z.string().optional(), dueDate: z.string().optional(), status: z.string().optional(), description: z.string().optional() }, ghlWrap(updateContactTask));
  s.tool("delete_contact_task", "Delete a task from a contact.", { contactId: z.string(), taskId: z.string() }, ghlWrap(deleteContactTask));
  s.tool("update_task_completion", "Mark a contact task complete or incomplete.", { contactId: z.string(), taskId: z.string(), completed: z.boolean() }, ghlWrap(updateTaskCompletion));
  s.tool("get_contact_note", "Get a single note on a contact.", { contactId: z.string(), noteId: z.string() }, ghlWrap(getContactNote));
  s.tool("update_contact_note", "Update a note on a contact.", { contactId: z.string(), noteId: z.string(), body: z.string() }, ghlWrap(updateContactNote));
  s.tool("delete_contact_note", "Delete a note from a contact.", { contactId: z.string(), noteId: z.string() }, ghlWrap(deleteContactNote));
  s.tool("upsert_contact", "Create or update a contact by email/phone.", { locationId: z.string(), email: z.string().optional(), phone: z.string().optional(), firstName: z.string().optional(), lastName: z.string().optional() }, ghlWrap(upsertContact));
  s.tool("get_duplicate_contact", "Find a duplicate contact by email or phone.", { locationId: z.string(), email: z.string().optional(), phone: z.string().optional() }, ghlWrap(getDuplicateContact));
  s.tool("get_contacts_by_business", "Get contacts linked to a business.", { locationId: z.string(), businessId: z.string() }, ghlWrap(getContactsByBusiness));
  s.tool("get_contact_appointments", "Get appointments for a contact.", { contactId: z.string() }, ghlWrap(getContactAppointments));
  s.tool("bulk_update_contact_tags", "Bulk add or remove tags across contacts.", { locationId: z.string(), contactIds: z.array(z.string()), tags: z.array(z.string()), action: z.enum(["add", "remove"]) }, ghlWrap(bulkUpdateContactTags));
  s.tool("bulk_update_contact_business", "Bulk assign contacts to a business.", { locationId: z.string(), contactIds: z.array(z.string()), businessId: z.string() }, ghlWrap(bulkUpdateContactBusiness));
  s.tool("add_contact_followers", "Add followers to a contact.", { contactId: z.string(), followers: z.array(z.string()) }, ghlWrap(addContactFollowers));
  s.tool("remove_contact_followers", "Remove followers from a contact.", { contactId: z.string(), followers: z.array(z.string()) }, ghlWrap(removeContactFollowers));
  s.tool("add_contact_to_campaign", "Add a contact to a campaign.", { contactId: z.string(), campaignId: z.string() }, ghlWrap(addContactToCampaign));
  s.tool("remove_contact_from_campaign", "Remove a contact from a campaign.", { contactId: z.string(), campaignId: z.string() }, ghlWrap(removeContactFromCampaign));
  s.tool("remove_contact_from_all_campaigns", "Remove a contact from all campaigns.", { contactId: z.string() }, ghlWrap(removeContactFromAllCampaigns));
  s.tool("add_contact_to_workflow", "Add a contact to a workflow.", { contactId: z.string(), workflowId: z.string(), eventStartTime: z.string().optional() }, ghlWrap(addContactToWorkflow));
  s.tool("remove_contact_from_workflow", "Remove a contact from a workflow.", { contactId: z.string(), workflowId: z.string() }, ghlWrap(removeContactFromWorkflow));

  // ── Conversations extended ─────────────────────────────────────────────────
  s.tool("create_conversation", "Create a new conversation.", { locationId: z.string(), contactId: z.string() }, ghlWrap(createConversation));
  s.tool("update_conversation", "Update a conversation (e.g. mark read).", { conversationId: z.string(), unreadCount: z.number().optional(), starred: z.boolean().optional() }, ghlWrap(updateConversation));
  s.tool("delete_conversation", "Delete a conversation.", { conversationId: z.string() }, ghlWrap(deleteConversation));
  s.tool("get_message", "Get a single message by ID.", { messageId: z.string() }, ghlWrap(getMessage));
  s.tool("get_email_message", "Get an email message by ID.", { messageId: z.string() }, ghlWrap(getEmailMessage));
  s.tool("cancel_scheduled_email", "Cancel a scheduled email message.", { messageId: z.string() }, ghlWrap(cancelScheduledEmail));
  s.tool("cancel_scheduled_message", "Cancel a scheduled SMS/message.", { messageId: z.string() }, ghlWrap(cancelScheduledMessage));
  s.tool("add_inbound_message", "Simulate an inbound message on a conversation.", { conversationId: z.string(), type: z.string(), message: z.string() }, ghlWrap(addInboundMessage));
  s.tool("add_outbound_call", "Log an outbound call on a conversation.", { conversationId: z.string(), to: z.string(), from: z.string().optional() }, ghlWrap(addOutboundCall));
  s.tool("update_message_status", "Update the status of a message.", { messageId: z.string(), status: z.string() }, ghlWrap(updateMessageStatus));
  s.tool("get_message_recording", "Get the recording URL for a call message.", { messageId: z.string() }, ghlWrap(getMessageRecording));
  s.tool("get_message_transcription", "Get the transcription of a call message.", { messageId: z.string() }, ghlWrap(getMessageTranscription));
  s.tool("live_chat_typing", "Send a typing indicator in a live chat.", { conversationId: z.string(), typing: z.boolean() }, ghlWrap(liveChatTyping));

  // ── Opportunities extended ─────────────────────────────────────────────────
  s.tool("get_opportunity", "Get a single opportunity by ID.", { opportunityId: z.string() }, ghlWrap(getOpportunity));
  s.tool("update_opportunity_status", "Update the status of an opportunity.", { opportunityId: z.string(), status: z.enum(["open","won","lost","abandoned"]) }, ghlWrap(updateOpportunityStatus));
  s.tool("upsert_opportunity", "Create or update an opportunity.", { locationId: z.string(), pipelineId: z.string(), name: z.string(), contactId: z.string().optional(), pipelineStageId: z.string().optional(), monetaryValue: z.number().optional() }, ghlWrap(upsertOpportunity));
  s.tool("add_opportunity_followers", "Add followers to an opportunity.", { opportunityId: z.string(), followers: z.array(z.string()) }, ghlWrap(addOpportunityFollowers));
  s.tool("remove_opportunity_followers", "Remove followers from an opportunity.", { opportunityId: z.string(), followers: z.array(z.string()) }, ghlWrap(removeOpportunityFollowers));

  // ── Calendars extended ─────────────────────────────────────────────────────
  s.tool("get_calendar_groups", "Get all calendar groups for a location.", { locationId: z.string() }, ghlWrap(getCalendarGroups));
  s.tool("create_calendar_group", "Create a calendar group.", { locationId: z.string(), name: z.string(), description: z.string().optional() }, ghlWrap(createCalendarGroup));
  s.tool("update_calendar_group", "Update a calendar group.", { groupId: z.string(), name: z.string().optional(), description: z.string().optional() }, ghlWrap(updateCalendarGroup));
  s.tool("delete_calendar_group", "Delete a calendar group.", { groupId: z.string() }, ghlWrap(deleteCalendarGroup));
  s.tool("disable_calendar_group", "Enable or disable a calendar group.", { groupId: z.string(), isActive: z.boolean() }, ghlWrap(disableCalendarGroup));
  s.tool("validate_calendar_group_slug", "Check if a calendar group slug is available.", { locationId: z.string(), slug: z.string() }, ghlWrap(validateCalendarGroupSlug));
  s.tool("create_calendar", "Create a new calendar.", { locationId: z.string(), name: z.string(), description: z.string().optional(), calendarType: z.string().optional() }, ghlWrap(createCalendar));
  s.tool("get_calendar", "Get a calendar by ID.", { calendarId: z.string() }, ghlWrap(getCalendar));
  s.tool("update_calendar", "Update a calendar.", { calendarId: z.string(), name: z.string().optional(), description: z.string().optional() }, ghlWrap(updateCalendar));
  s.tool("delete_calendar", "Delete a calendar.", { calendarId: z.string() }, ghlWrap(deleteCalendar));
  s.tool("get_free_slots", "Get available booking slots for a calendar.", { calendarId: z.string(), startDate: z.string(), endDate: z.string(), timezone: z.string().optional() }, ghlWrap(getFreeSlots));
  s.tool("get_blocked_slots", "Get blocked time slots for a calendar.", { locationId: z.string(), startTime: z.string(), endTime: z.string(), calendarId: z.string().optional() }, ghlWrap(getBlockedSlots));
  s.tool("create_appointment", "Create a calendar appointment.", { calendarId: z.string(), locationId: z.string(), contactId: z.string(), startTime: z.string(), endTime: z.string().optional(), title: z.string().optional() }, ghlWrap(createAppointment));
  s.tool("get_appointment", "Get an appointment by ID.", { appointmentId: z.string() }, ghlWrap(getAppointment));
  s.tool("update_appointment", "Update an appointment.", { appointmentId: z.string(), startTime: z.string().optional(), endTime: z.string().optional(), status: z.string().optional(), title: z.string().optional() }, ghlWrap(updateAppointment));
  s.tool("delete_appointment", "Delete an appointment.", { appointmentId: z.string() }, ghlWrap(deleteAppointment));
  s.tool("create_block_slot", "Create a blocked time slot on a calendar.", { calendarId: z.string(), locationId: z.string(), startTime: z.string(), endTime: z.string(), title: z.string().optional() }, ghlWrap(createBlockSlot));
  s.tool("update_block_slot", "Update a blocked time slot.", { appointmentId: z.string(), startTime: z.string().optional(), endTime: z.string().optional(), title: z.string().optional() }, ghlWrap(updateBlockSlot));
  s.tool("get_appointment_notes", "Get notes for an appointment.", { calendarId: z.string(), appointmentId: z.string() }, ghlWrap(getAppointmentNotes));
  s.tool("create_appointment_note", "Add a note to an appointment.", { calendarId: z.string(), appointmentId: z.string(), body: z.string() }, ghlWrap(createAppointmentNote));
  s.tool("update_appointment_note", "Update a note on an appointment.", { calendarId: z.string(), appointmentId: z.string(), noteId: z.string(), body: z.string() }, ghlWrap(updateAppointmentNote));
  s.tool("delete_appointment_note", "Delete a note from an appointment.", { calendarId: z.string(), appointmentId: z.string(), noteId: z.string() }, ghlWrap(deleteAppointmentNote));
  s.tool("get_calendar_resources", "Get calendar resources (rooms or equipment).", { locationId: z.string(), resourceType: z.enum(["rooms","equipments"]) }, ghlWrap(getCalendarResources));
  s.tool("create_calendar_resource", "Create a calendar resource.", { locationId: z.string(), resourceType: z.enum(["rooms","equipments"]), name: z.string(), capacity: z.number().optional() }, ghlWrap(createCalendarResource));
  s.tool("get_calendar_resource", "Get a single calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string() }, ghlWrap(getCalendarResource));
  s.tool("update_calendar_resource", "Update a calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string(), name: z.string().optional(), capacity: z.number().optional() }, ghlWrap(updateCalendarResource));
  s.tool("delete_calendar_resource", "Delete a calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string() }, ghlWrap(deleteCalendarResource));
  s.tool("get_calendar_notifications", "Get notifications for a calendar.", { calendarId: z.string() }, ghlWrap(getCalendarNotifications));
  s.tool("create_calendar_notification", "Create a notification for a calendar.", { calendarId: z.string(), type: z.string(), value: z.number().optional() }, ghlWrap(createCalendarNotification));
  s.tool("get_calendar_notification", "Get a single calendar notification.", { calendarId: z.string(), notificationId: z.string() }, ghlWrap(getCalendarNotification));
  s.tool("update_calendar_notification", "Update a calendar notification.", { calendarId: z.string(), notificationId: z.string(), type: z.string().optional(), value: z.number().optional() }, ghlWrap(updateCalendarNotification));
  s.tool("delete_calendar_notification", "Delete a calendar notification.", { calendarId: z.string(), notificationId: z.string() }, ghlWrap(deleteCalendarNotification));

  // ── Locations ──────────────────────────────────────────────────────────────
  s.tool("get_location_by_id", "Get a location by ID.", { locationId: z.string() }, ghlWrap(getLocationById));
  s.tool("create_location", "Create a new sub-account/location.", { name: z.string(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), country: z.string().optional() }, ghlWrap(createLocation));
  s.tool("update_location", "Update a location.", { locationId: z.string(), name: z.string().optional(), phone: z.string().optional(), email: z.string().optional() }, ghlWrap(updateLocation));
  s.tool("delete_location", "Delete a location.", { locationId: z.string(), deleteTwilioAccount: z.boolean().optional() }, ghlWrap(deleteLocation));
  s.tool("get_location_tags", "Get tags for a location.", { locationId: z.string() }, ghlWrap(getLocationTags));
  s.tool("create_location_tag", "Create a tag for a location.", { locationId: z.string(), name: z.string() }, ghlWrap(createLocationTag));
  s.tool("get_location_tag", "Get a location tag by ID.", { locationId: z.string(), tagId: z.string() }, ghlWrap(getLocationTag));
  s.tool("update_location_tag", "Update a location tag.", { locationId: z.string(), tagId: z.string(), name: z.string() }, ghlWrap(updateLocationTag));
  s.tool("delete_location_tag", "Delete a location tag.", { locationId: z.string(), tagId: z.string() }, ghlWrap(deleteLocationTag));
  s.tool("search_location_tasks", "Search tasks for a location.", { locationId: z.string() }, ghlWrap(searchLocationTasks));
  s.tool("get_location_custom_fields", "Get custom fields for a location.", { locationId: z.string() }, ghlWrap(getLocationCustomFields));
  s.tool("create_location_custom_field", "Create a custom field for a location.", { locationId: z.string(), name: z.string(), dataType: z.string(), placeholder: z.string().optional() }, ghlWrap(createLocationCustomField));
  s.tool("get_location_custom_field", "Get a location custom field by ID.", { locationId: z.string(), customFieldId: z.string() }, ghlWrap(getLocationCustomField));
  s.tool("update_location_custom_field", "Update a custom field for a location.", { locationId: z.string(), customFieldId: z.string(), name: z.string().optional() }, ghlWrap(updateLocationCustomField));
  s.tool("delete_location_custom_field", "Delete a custom field for a location.", { locationId: z.string(), customFieldId: z.string() }, ghlWrap(deleteLocationCustomField));
  s.tool("get_location_custom_values", "Get custom values for a location.", { locationId: z.string() }, ghlWrap(getLocationCustomValues));
  s.tool("create_location_custom_value", "Create a custom value for a location.", { locationId: z.string(), name: z.string(), value: z.string() }, ghlWrap(createLocationCustomValue));
  s.tool("get_location_custom_value", "Get a location custom value by ID.", { locationId: z.string(), customValueId: z.string() }, ghlWrap(getLocationCustomValue));
  s.tool("update_location_custom_value", "Update a custom value for a location.", { locationId: z.string(), customValueId: z.string(), name: z.string().optional(), value: z.string().optional() }, ghlWrap(updateLocationCustomValue));
  s.tool("delete_location_custom_value", "Delete a custom value for a location.", { locationId: z.string(), customValueId: z.string() }, ghlWrap(deleteLocationCustomValue));
  s.tool("get_location_templates", "Get templates for a location.", { locationId: z.string(), type: z.string().optional() }, ghlWrap(getLocationTemplates));
  s.tool("delete_location_template", "Delete a location template.", { locationId: z.string(), templateId: z.string() }, ghlWrap(deleteLocationTemplate));
  s.tool("get_timezones", "Get list of available timezones.", async () => ({ content: [{ type: "text", text: JSON.stringify(await getTimezones({}), null, 2) }] }));

  // ── Blogs ──────────────────────────────────────────────────────────────────
  s.tool("get_blog_sites", "Get blog sites for a location.", { locationId: z.string() }, ghlWrap(getBlogSites));
  s.tool("get_blog_posts", "Get blog posts for a location.", { locationId: z.string(), limit: z.number().optional(), skip: z.number().optional() }, ghlWrap(getBlogPosts));
  s.tool("create_blog_post", "Create a blog post.", { locationId: z.string(), title: z.string(), rawHTML: z.string().optional(), status: z.string().optional() }, ghlWrap(createBlogPost));
  s.tool("update_blog_post", "Update a blog post.", { locationId: z.string(), postId: z.string(), title: z.string().optional(), rawHTML: z.string().optional(), status: z.string().optional() }, ghlWrap(updateBlogPost));
  s.tool("get_blog_authors", "Get blog authors for a location.", { locationId: z.string() }, ghlWrap(getBlogAuthors));
  s.tool("get_blog_categories", "Get blog categories for a location.", { locationId: z.string() }, ghlWrap(getBlogCategories));
  s.tool("check_blog_url_slug", "Check if a blog URL slug is available.", { locationId: z.string(), slug: z.string() }, ghlWrap(checkBlogUrlSlug));

  // ── Emails ─────────────────────────────────────────────────────────────────
  s.tool("get_email_campaigns", "Get email campaigns for a location.", { locationId: z.string() }, ghlWrap(getEmailCampaigns));
  s.tool("create_email_template", "Create an email template.", { locationId: z.string(), name: z.string(), body: z.string().optional() }, ghlWrap(createEmailTemplate));
  s.tool("get_email_templates", "Get email templates for a location.", { locationId: z.string() }, ghlWrap(getEmailTemplates));
  s.tool("update_email_template", "Update an email template.", { locationId: z.string(), templateId: z.string(), name: z.string().optional(), body: z.string().optional() }, ghlWrap(updateEmailTemplate));
  s.tool("delete_email_template", "Delete an email template.", { locationId: z.string(), templateId: z.string() }, ghlWrap(deleteEmailTemplate));
  s.tool("verify_email", "Verify email deliverability.", { locationId: z.string(), email: z.string() }, ghlWrap(verifyEmail));

  // ── Invoices ───────────────────────────────────────────────────────────────
  s.tool("create_invoice_template", "Create an invoice template.", { locationId: z.string(), name: z.string() }, ghlWrap(createInvoiceTemplate));
  s.tool("list_invoice_templates", "List invoice templates.", { locationId: z.string() }, ghlWrap(listInvoiceTemplates));
  s.tool("get_invoice_template", "Get an invoice template by ID.", { locationId: z.string(), templateId: z.string() }, ghlWrap(getInvoiceTemplate));
  s.tool("update_invoice_template", "Update an invoice template.", { locationId: z.string(), templateId: z.string(), name: z.string().optional() }, ghlWrap(updateInvoiceTemplate));
  s.tool("delete_invoice_template", "Delete an invoice template.", { locationId: z.string(), templateId: z.string() }, ghlWrap(deleteInvoiceTemplate));
  s.tool("create_invoice_schedule", "Create an invoice schedule.", { locationId: z.string(), name: z.string() }, ghlWrap(createInvoiceSchedule));
  s.tool("list_invoice_schedules", "List invoice schedules.", { locationId: z.string() }, ghlWrap(listInvoiceSchedules));
  s.tool("get_invoice_schedule", "Get an invoice schedule by ID.", { locationId: z.string(), scheduleId: z.string() }, ghlWrap(getInvoiceSchedule));
  s.tool("delete_invoice_schedule", "Delete an invoice schedule.", { locationId: z.string(), scheduleId: z.string() }, ghlWrap(deleteInvoiceSchedule));
  s.tool("cancel_invoice_schedule", "Cancel an invoice schedule.", { locationId: z.string(), scheduleId: z.string() }, ghlWrap(cancelInvoiceSchedule));
  s.tool("generate_invoice_number", "Generate the next invoice number.", { locationId: z.string() }, ghlWrap(generateInvoiceNumber));
  s.tool("create_invoice", "Create an invoice.", { locationId: z.string(), contactId: z.string(), items: z.array(z.object({ name: z.string(), amount: z.number(), qty: z.number().optional() })).optional() }, ghlWrap(createInvoice));
  s.tool("list_invoices", "List invoices for a location.", { locationId: z.string(), contactId: z.string().optional(), status: z.string().optional() }, ghlWrap(listInvoices));
  s.tool("get_invoice", "Get an invoice by ID.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(getInvoice));
  s.tool("update_invoice", "Update an invoice.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(updateInvoice));
  s.tool("delete_invoice", "Delete an invoice.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(deleteInvoice));
  s.tool("send_invoice", "Send an invoice to a contact.", { locationId: z.string(), invoiceId: z.string(), sendEmail: z.boolean().optional() }, ghlWrap(sendInvoice));
  s.tool("record_invoice_payment", "Record a manual payment on an invoice.", { locationId: z.string(), invoiceId: z.string(), amount: z.number(), mode: z.string().optional() }, ghlWrap(recordInvoicePayment));
  s.tool("void_invoice", "Void an invoice.", { locationId: z.string(), invoiceId: z.string() }, ghlWrap(voidInvoice));

  // ── Payments ───────────────────────────────────────────────────────────────
  s.tool("list_orders", "List payment orders.", { locationId: z.string(), contactId: z.string().optional(), status: z.string().optional() }, ghlWrap(listOrders));
  s.tool("get_order", "Get a payment order by ID.", { locationId: z.string(), orderId: z.string() }, ghlWrap(getOrder));
  s.tool("create_order_fulfillment", "Create a fulfillment for an order.", { locationId: z.string(), orderId: z.string(), trackingNumber: z.string().optional() }, ghlWrap(createOrderFulfillment));
  s.tool("list_order_fulfillments", "List fulfillments for an order.", { locationId: z.string(), orderId: z.string() }, ghlWrap(listOrderFulfillments));
  s.tool("list_transactions", "List payment transactions.", { locationId: z.string(), contactId: z.string().optional() }, ghlWrap(listTransactions));
  s.tool("get_transaction", "Get a transaction by ID.", { locationId: z.string(), transactionId: z.string() }, ghlWrap(getTransaction));
  s.tool("list_subscriptions", "List payment subscriptions.", { locationId: z.string(), contactId: z.string().optional() }, ghlWrap(listSubscriptions));
  s.tool("get_subscription", "Get a subscription by ID.", { locationId: z.string(), subscriptionId: z.string() }, ghlWrap(getSubscription));
  s.tool("list_coupons", "List coupons for a location.", { locationId: z.string() }, ghlWrap(listCoupons));
  s.tool("get_coupon", "Get a coupon by ID.", { locationId: z.string(), couponId: z.string() }, ghlWrap(getCoupon));
  s.tool("create_coupon", "Create a coupon.", { locationId: z.string(), name: z.string(), code: z.string(), discountType: z.string(), discount: z.number() }, ghlWrap(createCoupon));
  s.tool("update_coupon", "Update a coupon.", { locationId: z.string(), couponId: z.string(), name: z.string().optional(), discount: z.number().optional() }, ghlWrap(updateCoupon));
  s.tool("delete_coupon", "Delete a coupon.", { locationId: z.string(), couponId: z.string() }, ghlWrap(deleteCoupon));

  // ── Products ───────────────────────────────────────────────────────────────
  s.tool("create_product", "Create a product.", { locationId: z.string(), name: z.string(), description: z.string().optional() }, ghlWrap(createProduct));
  s.tool("get_product", "Get a product by ID.", { locationId: z.string(), productId: z.string() }, ghlWrap(getProduct));
  s.tool("update_product", "Update a product.", { locationId: z.string(), productId: z.string(), name: z.string().optional(), description: z.string().optional() }, ghlWrap(updateProduct));
  s.tool("delete_product", "Delete a product.", { locationId: z.string(), productId: z.string() }, ghlWrap(deleteProduct));
  s.tool("list_products", "List products for a location.", { locationId: z.string() }, ghlWrap(listProducts));
  s.tool("create_product_price", "Create a price for a product.", { locationId: z.string(), productId: z.string(), name: z.string(), amount: z.number(), currency: z.string().optional() }, ghlWrap(createProductPrice));
  s.tool("list_product_prices", "List prices for a product.", { locationId: z.string(), productId: z.string() }, ghlWrap(listProductPrices));
  s.tool("get_product_price", "Get a product price by ID.", { locationId: z.string(), productId: z.string(), priceId: z.string() }, ghlWrap(getProductPrice));
  s.tool("update_product_price", "Update a product price.", { locationId: z.string(), productId: z.string(), priceId: z.string(), amount: z.number().optional() }, ghlWrap(updateProductPrice));
  s.tool("delete_product_price", "Delete a product price.", { locationId: z.string(), productId: z.string(), priceId: z.string() }, ghlWrap(deleteProductPrice));
  s.tool("list_inventory", "List inventory for a location.", { locationId: z.string() }, ghlWrap(listInventory));
  s.tool("create_product_collection", "Create a product collection.", { locationId: z.string(), name: z.string() }, ghlWrap(createProductCollection));
  s.tool("list_product_collections", "List product collections.", { locationId: z.string() }, ghlWrap(listProductCollections));

  // ── Social Media ───────────────────────────────────────────────────────────
  s.tool("search_social_posts", "Search social media posts.", { locationId: z.string(), skip: z.number().optional(), limit: z.number().optional() }, ghlWrap(searchSocialPosts));
  s.tool("create_social_post", "Create a social media post.", { locationId: z.string(), content: z.string(), accountIds: z.array(z.string()).optional(), scheduleDate: z.string().optional() }, ghlWrap(createSocialPost));
  s.tool("get_social_post", "Get a social media post by ID.", { locationId: z.string(), postId: z.string() }, ghlWrap(getSocialPost));
  s.tool("update_social_post", "Update a social media post.", { locationId: z.string(), postId: z.string(), content: z.string().optional() }, ghlWrap(updateSocialPost));
  s.tool("delete_social_post", "Delete a social media post.", { locationId: z.string(), postId: z.string() }, ghlWrap(deleteSocialPost));
  s.tool("bulk_delete_social_posts", "Bulk delete social media posts.", { locationId: z.string(), postIds: z.array(z.string()) }, ghlWrap(bulkDeleteSocialPosts));
  s.tool("get_social_accounts", "Get connected social media accounts.", { locationId: z.string() }, ghlWrap(getSocialAccounts));
  s.tool("delete_social_account", "Disconnect a social media account.", { locationId: z.string(), accountId: z.string() }, ghlWrap(deleteSocialAccount));

  // ── Surveys ────────────────────────────────────────────────────────────────
  s.tool("get_surveys", "List all surveys for a location.", { locationId: z.string() }, ghlWrap(getSurveys));
  s.tool("get_survey_submissions", "Get submissions for a survey.", { locationId: z.string(), surveyId: z.string().optional() }, ghlWrap(getSurveySubmissions));

  // ── Workflows ──────────────────────────────────────────────────────────────
  s.tool("get_workflows", "List all workflows for a location.", { locationId: z.string() }, ghlWrap(getWorkflows));

  // ── Media ──────────────────────────────────────────────────────────────────
  s.tool("get_media_files", "List media files for a location.", { locationId: z.string() }, ghlWrap(getMediaFiles));
  s.tool("delete_media_file", "Delete a media file.", { locationId: z.string(), fileId: z.string() }, ghlWrap(deleteMediaFile));

  // ── Custom Fields V2 ───────────────────────────────────────────────────────
  s.tool("get_custom_field_v2", "Get a custom field by ID (v2).", { customFieldId: z.string() }, ghlWrap(getCustomFieldV2ById));
  s.tool("create_custom_field_v2", "Create a custom field (v2). fieldKey is auto-generated from name as contact.{snake_case_name}.", { locationId: z.string(), name: z.string(), dataType: z.enum(["TEXT", "LARGE_TEXT", "NUMERICAL", "PHONE", "MONETARY", "CHECKBOX", "MULTIPLE_OPTIONS", "SINGLE_OPTIONS", "DATE", "TEXTBOX_LIST", "FILE_UPLOAD", "SIGNATURE"]), objectKey: z.string(), parentId: z.string().optional(), placeholder: z.string().optional(), isRequired: z.boolean().optional(), options: z.array(z.string()).optional() }, ghlWrap(createCustomFieldV2));
  s.tool("update_custom_field_v2", "Update a custom field (v2).", { customFieldId: z.string(), name: z.string().optional() }, ghlWrap(updateCustomFieldV2));
  s.tool("delete_custom_field_v2", "Delete a custom field (v2).", { customFieldId: z.string() }, ghlWrap(deleteCustomFieldV2));
  s.tool("get_custom_fields_v2_by_object_key", "Get custom fields by object key (v2).", { locationId: z.string(), objectKey: z.string() }, ghlWrap(getCustomFieldsV2ByObjectKey));
  s.tool("create_custom_field_folder", "Create a custom field folder.", { locationId: z.string(), name: z.string() }, ghlWrap(createCustomFieldFolder));
  s.tool("update_custom_field_folder", "Update a custom field folder.", { folderId: z.string(), name: z.string() }, ghlWrap(updateCustomFieldFolder));
  s.tool("delete_custom_field_folder", "Delete a custom field folder.", { folderId: z.string() }, ghlWrap(deleteCustomFieldFolder));

  // ── Store / Shipping ───────────────────────────────────────────────────────
  s.tool("create_shipping_zone", "Create a shipping zone.", { locationId: z.string(), name: z.string() }, ghlWrap(createShippingZone));
  s.tool("list_shipping_zones", "List shipping zones.", { locationId: z.string() }, ghlWrap(listShippingZones));
  s.tool("get_shipping_zone", "Get a shipping zone by ID.", { locationId: z.string(), zoneId: z.string() }, ghlWrap(getShippingZone));
  s.tool("update_shipping_zone", "Update a shipping zone.", { locationId: z.string(), zoneId: z.string(), name: z.string().optional() }, ghlWrap(updateShippingZone));
  s.tool("delete_shipping_zone", "Delete a shipping zone.", { locationId: z.string(), zoneId: z.string() }, ghlWrap(deleteShippingZone));
  s.tool("create_shipping_rate", "Create a shipping rate.", { locationId: z.string(), name: z.string(), amount: z.number().optional() }, ghlWrap(createShippingRate));
  s.tool("list_shipping_rates", "List shipping rates.", { locationId: z.string() }, ghlWrap(listShippingRates));
  s.tool("get_shipping_rate", "Get a shipping rate by ID.", { locationId: z.string(), rateId: z.string() }, ghlWrap(getShippingRate));
  s.tool("update_shipping_rate", "Update a shipping rate.", { locationId: z.string(), rateId: z.string(), name: z.string().optional(), amount: z.number().optional() }, ghlWrap(updateShippingRate));
  s.tool("delete_shipping_rate", "Delete a shipping rate.", { locationId: z.string(), rateId: z.string() }, ghlWrap(deleteShippingRate));
  s.tool("create_shipping_carrier", "Create a shipping carrier.", { locationId: z.string(), name: z.string() }, ghlWrap(createShippingCarrier));
  s.tool("list_shipping_carriers", "List shipping carriers.", { locationId: z.string() }, ghlWrap(listShippingCarriers));
  s.tool("get_shipping_carrier", "Get a shipping carrier by ID.", { locationId: z.string(), carrierId: z.string() }, ghlWrap(getShippingCarrier));
  s.tool("update_shipping_carrier", "Update a shipping carrier.", { locationId: z.string(), carrierId: z.string(), name: z.string().optional() }, ghlWrap(updateShippingCarrier));
  s.tool("delete_shipping_carrier", "Delete a shipping carrier.", { locationId: z.string(), carrierId: z.string() }, ghlWrap(deleteShippingCarrier));
  s.tool("create_store_setting", "Create store settings.", { locationId: z.string() }, ghlWrap(createStoreSetting));
  s.tool("get_store_setting", "Get store settings.", { locationId: z.string() }, ghlWrap(getStoreSetting));

  // ── Associations ───────────────────────────────────────────────────────────
  s.tool("get_all_associations", "Get all association types.", { locationId: z.string() }, ghlWrap(getAllAssociations));
  s.tool("create_association", "Create a new association type.", { locationId: z.string(), key: z.string(), firstLabel: z.string(), secondLabel: z.string() }, ghlWrap(createAssociation));
  s.tool("get_association_by_id", "Get an association by ID.", { associationId: z.string() }, ghlWrap(getAssociationById));
  s.tool("get_association_by_key", "Get an association by key.", { locationId: z.string(), key: z.string() }, ghlWrap(getAssociationByKey));
  s.tool("get_association_by_object_key", "Get associations by object key.", { locationId: z.string(), objectKey: z.string() }, ghlWrap(getAssociationByObjectKey));
  s.tool("update_association", "Update an association.", { associationId: z.string(), firstLabel: z.string().optional(), secondLabel: z.string().optional() }, ghlWrap(updateAssociation));
  s.tool("delete_association", "Delete an association type.", { associationId: z.string() }, ghlWrap(deleteAssociation));
  s.tool("create_relation", "Link two records together.", { associationId: z.string(), firstRecordId: z.string(), secondRecordId: z.string() }, ghlWrap(createRelation));
  s.tool("get_relations_by_record", "Get all relations for a record.", { locationId: z.string(), recordId: z.string() }, ghlWrap(getRelationsByRecord));
  s.tool("delete_relation", "Delete a relation between two records.", { relationId: z.string() }, ghlWrap(deleteRelation));

  // ── Objects ────────────────────────────────────────────────────────────────
  s.tool("get_objects_by_location", "Get custom object schemas for a location.", { locationId: z.string() }, ghlWrap(getObjectsByLocation));
  s.tool("create_object_schema", "Create a custom object schema.", { locationId: z.string(), key: z.string(), singular: z.string(), plural: z.string() }, ghlWrap(createObjectSchema));
  s.tool("get_object_schema", "Get a custom object schema.", { locationId: z.string(), schemaId: z.string() }, ghlWrap(getObjectSchema));
  s.tool("update_object_schema", "Update a custom object schema.", { locationId: z.string(), schemaId: z.string(), singular: z.string().optional(), plural: z.string().optional() }, ghlWrap(updateObjectSchema));
  s.tool("create_object_record", "Create a record in a custom object.", { locationId: z.string(), schemaId: z.string(), properties: z.record(z.string(), z.unknown()).optional() }, ghlWrap(createObjectRecord));
  s.tool("get_object_record", "Get a custom object record by ID.", { locationId: z.string(), schemaId: z.string(), recordId: z.string() }, ghlWrap(getObjectRecord));
  s.tool("update_object_record", "Update a custom object record.", { locationId: z.string(), schemaId: z.string(), recordId: z.string(), properties: z.record(z.string(), z.unknown()).optional() }, ghlWrap(updateObjectRecord));
  s.tool("delete_object_record", "Delete a custom object record.", { locationId: z.string(), schemaId: z.string(), recordId: z.string() }, ghlWrap(deleteObjectRecord));
  s.tool("search_object_records", "Search records in a custom object.", { locationId: z.string(), schemaId: z.string(), query: z.string().optional() }, ghlWrap(searchObjectRecords));

  s.tool("run_sync", "Sync location IDs to contact custom fields. Loops through all GHL sub-accounts and writes the location ID to the GHL Location ID custom field on the matching contact in the primary location.",
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

// Manual sync trigger
app.post("/sync", async (_req, res) => {
  res.json({ message: "Sync started", timestamp: new Date().toISOString() });
  runSync().catch((err) => console.error("[sync] fatal:", err.message));
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "gm-baptist-mcp", version: "1.1.0" });
});

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
