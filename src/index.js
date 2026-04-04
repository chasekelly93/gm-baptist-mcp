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

  s.tool("get_sub_accounts", "List all sub-accounts (locations) under the agency.",
    { limit: z.number().int().min(1).max(100).default(10), skip: z.number().int().min(0).default(0) },
    async ({ limit, skip }) => ({ content: [{ type: "text", text: JSON.stringify(await getSubAccounts({ limit, skip }), null, 2) }] })
  );
  s.tool("get_contacts", "Get contacts for a sub-account location.",
    { locationId: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0), query: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContacts(args), null, 2) }] })
  );
  s.tool("create_contact", "Create a new contact in a GHL sub-account.",
    { locationId: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), tags: z.array(z.string()).optional(), source: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createContact(args), null, 2) }] })
  );
  s.tool("get_conversations", "Get conversations for a GHL location.",
    { locationId: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0), contactId: z.string().optional(), status: z.enum(["all","read","unread","open"]).optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getConversations(args), null, 2) }] })
  );
  s.tool("send_message", "Send an SMS or Email via GHL.",
    { type: z.enum(["SMS","Email"]), locationId: z.string(), contactId: z.string().optional(), conversationId: z.string().optional(), message: z.string(), subject: z.string().optional(), emailFrom: z.string().optional(), emailFromName: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await sendMessage(args), null, 2) }] })
  );
  s.tool("get_messages", "Get messages for a conversation.",
    { conversationId: z.string(), limit: z.number().int().min(1).max(100).default(20), lastMessageId: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getMessages(args), null, 2) }] })
  );
  s.tool("get_billing_charges", "Get agency billing/wallet charges.",
    { startDate: z.string().optional(), endDate: z.string().optional(), locationId: z.string().optional(), limit: z.number().int().min(1).max(100).default(100), skip: z.number().int().min(0).default(0) },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getBillingCharges(args), null, 2) }] })
  );

  // ── Contact detail tools ───────────────────────────────────────────────────
  s.tool("get_contact", "Get full profile of a single contact by ID.",
    { contactId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContact(args), null, 2) }] })
  );
  s.tool("update_contact", "Update fields on an existing contact.",
    { contactId: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), tags: z.array(z.string()).optional(), companyName: z.string().optional(), address1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), website: z.string().optional(), source: z.string().optional(), dnd: z.boolean().optional(), customFields: z.array(z.object({ id: z.string(), field_value: z.unknown() })).optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateContact(args), null, 2) }] })
  );
  s.tool("delete_contact", "Permanently delete a contact by ID.",
    { contactId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteContact(args), null, 2) }] })
  );
  s.tool("add_contact_tags", "Add tags to a contact.",
    { contactId: z.string(), tags: z.array(z.string()) },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addContactTags(args), null, 2) }] })
  );
  s.tool("remove_contact_tags", "Remove tags from a contact.",
    { contactId: z.string(), tags: z.array(z.string()) },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await removeContactTags(args), null, 2) }] })
  );
  s.tool("search_contacts", "Search contacts in a location by name, email, or phone.",
    { locationId: z.string(), query: z.string(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await searchContacts(args), null, 2) }] })
  );
  s.tool("get_contact_notes", "Get all notes on a contact.",
    { contactId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContactNotes(args), null, 2) }] })
  );
  s.tool("add_contact_note", "Add a note to a contact.",
    { contactId: z.string(), body: z.string(), userId: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addContactNote(args), null, 2) }] })
  );

  // ── Conversation detail tools ──────────────────────────────────────────────
  s.tool("mark_conversation_read", "Mark a conversation as read (unreadCount = 0).",
    { conversationId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await markConversationRead(args), null, 2) }] })
  );
  s.tool("get_conversation", "Get details of a single conversation by ID.",
    { conversationId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getConversation(args), null, 2) }] })
  );

  // ── Pipeline & opportunity tools ───────────────────────────────────────────
  s.tool("get_pipelines", "List all pipelines and their stages for a location.",
    { locationId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getPipelines(args), null, 2) }] })
  );
  s.tool("get_opportunities", "Search opportunities in a pipeline.",
    { locationId: z.string(), pipelineId: z.string().optional(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).optional(), contactId: z.string().optional(), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getOpportunities(args), null, 2) }] })
  );
  s.tool("create_opportunity", "Create a new opportunity in a pipeline.",
    { locationId: z.string(), pipelineId: z.string(), name: z.string(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).default("open"), contactId: z.string().optional(), monetaryValue: z.number().optional(), assignedTo: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createOpportunity(args), null, 2) }] })
  );
  s.tool("update_opportunity", "Update an existing opportunity.",
    { opportunityId: z.string(), name: z.string().optional(), pipelineStageId: z.string().optional(), status: z.enum(["open","won","lost","abandoned"]).optional(), monetaryValue: z.number().optional(), assignedTo: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateOpportunity(args), null, 2) }] })
  );
  s.tool("delete_opportunity", "Delete an opportunity by ID.",
    { opportunityId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteOpportunity(args), null, 2) }] })
  );

  // ── Calendar & appointment tools ───────────────────────────────────────────
  s.tool("get_calendars", "List all calendars for a location.",
    { locationId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCalendars(args), null, 2) }] })
  );
  s.tool("get_appointments", "Get upcoming appointments for a location or calendar.",
    { locationId: z.string(), calendarId: z.string().optional(), contactId: z.string().optional(), startTime: z.string().optional(), endTime: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getAppointments(args), null, 2) }] })
  );
  s.tool("get_users", "Get users (team members) for a location. Requires users.readonly scope.",
    { locationId: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getUsers(args), null, 2) }] })
  );
  s.tool("get_contacts_by_tag", "Get contacts filtered by one or more tags.",
    { locationId: z.string(), tags: z.array(z.string()), limit: z.number().int().min(1).max(100).default(20), skip: z.number().int().min(0).default(0) },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContactsByTag(args), null, 2) }] })
  );

  // ── Contacts extended ──────────────────────────────────────────────────────
  s.tool("get_contact_tasks", "Get all tasks for a contact.", { contactId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContactTasks(args), null, 2) }] }));
  s.tool("create_contact_task", "Create a task for a contact.", { contactId: z.string(), title: z.string(), dueDate: z.string().optional(), status: z.string().optional(), assignedTo: z.string().optional(), description: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createContactTask(args), null, 2) }] }));
  s.tool("get_contact_task", "Get a single task for a contact.", { contactId: z.string(), taskId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContactTask(args), null, 2) }] }));
  s.tool("update_contact_task", "Update a task for a contact.", { contactId: z.string(), taskId: z.string(), title: z.string().optional(), dueDate: z.string().optional(), status: z.string().optional(), description: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateContactTask(args), null, 2) }] }));
  s.tool("delete_contact_task", "Delete a task from a contact.", { contactId: z.string(), taskId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteContactTask(args), null, 2) }] }));
  s.tool("update_task_completion", "Mark a contact task complete or incomplete.", { contactId: z.string(), taskId: z.string(), completed: z.boolean() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateTaskCompletion(args), null, 2) }] }));
  s.tool("get_contact_note", "Get a single note on a contact.", { contactId: z.string(), noteId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContactNote(args), null, 2) }] }));
  s.tool("update_contact_note", "Update a note on a contact.", { contactId: z.string(), noteId: z.string(), body: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateContactNote(args), null, 2) }] }));
  s.tool("delete_contact_note", "Delete a note from a contact.", { contactId: z.string(), noteId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteContactNote(args), null, 2) }] }));
  s.tool("upsert_contact", "Create or update a contact by email/phone.", { locationId: z.string(), email: z.string().optional(), phone: z.string().optional(), firstName: z.string().optional(), lastName: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await upsertContact(args), null, 2) }] }));
  s.tool("get_duplicate_contact", "Find a duplicate contact by email or phone.", { locationId: z.string(), email: z.string().optional(), phone: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getDuplicateContact(args), null, 2) }] }));
  s.tool("get_contacts_by_business", "Get contacts linked to a business.", { locationId: z.string(), businessId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContactsByBusiness(args), null, 2) }] }));
  s.tool("get_contact_appointments", "Get appointments for a contact.", { contactId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getContactAppointments(args), null, 2) }] }));
  s.tool("bulk_update_contact_tags", "Bulk add or remove tags across contacts.", { locationId: z.string(), contactIds: z.array(z.string()), tags: z.array(z.string()), action: z.enum(["add", "remove"]) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await bulkUpdateContactTags(args), null, 2) }] }));
  s.tool("bulk_update_contact_business", "Bulk assign contacts to a business.", { locationId: z.string(), contactIds: z.array(z.string()), businessId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await bulkUpdateContactBusiness(args), null, 2) }] }));
  s.tool("add_contact_followers", "Add followers to a contact.", { contactId: z.string(), followers: z.array(z.string()) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addContactFollowers(args), null, 2) }] }));
  s.tool("remove_contact_followers", "Remove followers from a contact.", { contactId: z.string(), followers: z.array(z.string()) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await removeContactFollowers(args), null, 2) }] }));
  s.tool("add_contact_to_campaign", "Add a contact to a campaign.", { contactId: z.string(), campaignId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addContactToCampaign(args), null, 2) }] }));
  s.tool("remove_contact_from_campaign", "Remove a contact from a campaign.", { contactId: z.string(), campaignId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await removeContactFromCampaign(args), null, 2) }] }));
  s.tool("remove_contact_from_all_campaigns", "Remove a contact from all campaigns.", { contactId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await removeContactFromAllCampaigns(args), null, 2) }] }));
  s.tool("add_contact_to_workflow", "Add a contact to a workflow.", { contactId: z.string(), workflowId: z.string(), eventStartTime: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addContactToWorkflow(args), null, 2) }] }));
  s.tool("remove_contact_from_workflow", "Remove a contact from a workflow.", { contactId: z.string(), workflowId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await removeContactFromWorkflow(args), null, 2) }] }));

  // ── Conversations extended ─────────────────────────────────────────────────
  s.tool("create_conversation", "Create a new conversation.", { locationId: z.string(), contactId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createConversation(args), null, 2) }] }));
  s.tool("update_conversation", "Update a conversation (e.g. mark read).", { conversationId: z.string(), unreadCount: z.number().optional(), starred: z.boolean().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateConversation(args), null, 2) }] }));
  s.tool("delete_conversation", "Delete a conversation.", { conversationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteConversation(args), null, 2) }] }));
  s.tool("get_message", "Get a single message by ID.", { messageId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getMessage(args), null, 2) }] }));
  s.tool("get_email_message", "Get an email message by ID.", { messageId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getEmailMessage(args), null, 2) }] }));
  s.tool("cancel_scheduled_email", "Cancel a scheduled email message.", { messageId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await cancelScheduledEmail(args), null, 2) }] }));
  s.tool("cancel_scheduled_message", "Cancel a scheduled SMS/message.", { messageId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await cancelScheduledMessage(args), null, 2) }] }));
  s.tool("add_inbound_message", "Simulate an inbound message on a conversation.", { conversationId: z.string(), type: z.string(), message: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addInboundMessage(args), null, 2) }] }));
  s.tool("add_outbound_call", "Log an outbound call on a conversation.", { conversationId: z.string(), to: z.string(), from: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addOutboundCall(args), null, 2) }] }));
  s.tool("update_message_status", "Update the status of a message.", { messageId: z.string(), status: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateMessageStatus(args), null, 2) }] }));
  s.tool("get_message_recording", "Get the recording URL for a call message.", { messageId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getMessageRecording(args), null, 2) }] }));
  s.tool("get_message_transcription", "Get the transcription of a call message.", { messageId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getMessageTranscription(args), null, 2) }] }));
  s.tool("live_chat_typing", "Send a typing indicator in a live chat.", { conversationId: z.string(), typing: z.boolean() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await liveChatTyping(args), null, 2) }] }));

  // ── Opportunities extended ─────────────────────────────────────────────────
  s.tool("get_opportunity", "Get a single opportunity by ID.", { opportunityId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getOpportunity(args), null, 2) }] }));
  s.tool("update_opportunity_status", "Update the status of an opportunity.", { opportunityId: z.string(), status: z.enum(["open","won","lost","abandoned"]) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateOpportunityStatus(args), null, 2) }] }));
  s.tool("upsert_opportunity", "Create or update an opportunity.", { locationId: z.string(), pipelineId: z.string(), name: z.string(), contactId: z.string().optional(), pipelineStageId: z.string().optional(), monetaryValue: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await upsertOpportunity(args), null, 2) }] }));
  s.tool("add_opportunity_followers", "Add followers to an opportunity.", { opportunityId: z.string(), followers: z.array(z.string()) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await addOpportunityFollowers(args), null, 2) }] }));
  s.tool("remove_opportunity_followers", "Remove followers from an opportunity.", { opportunityId: z.string(), followers: z.array(z.string()) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await removeOpportunityFollowers(args), null, 2) }] }));

  // ── Calendars extended ─────────────────────────────────────────────────────
  s.tool("get_calendar_groups", "Get all calendar groups for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCalendarGroups(args), null, 2) }] }));
  s.tool("create_calendar_group", "Create a calendar group.", { locationId: z.string(), name: z.string(), description: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createCalendarGroup(args), null, 2) }] }));
  s.tool("update_calendar_group", "Update a calendar group.", { groupId: z.string(), name: z.string().optional(), description: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateCalendarGroup(args), null, 2) }] }));
  s.tool("delete_calendar_group", "Delete a calendar group.", { groupId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteCalendarGroup(args), null, 2) }] }));
  s.tool("disable_calendar_group", "Enable or disable a calendar group.", { groupId: z.string(), isActive: z.boolean() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await disableCalendarGroup(args), null, 2) }] }));
  s.tool("validate_calendar_group_slug", "Check if a calendar group slug is available.", { locationId: z.string(), slug: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await validateCalendarGroupSlug(args), null, 2) }] }));
  s.tool("create_calendar", "Create a new calendar.", { locationId: z.string(), name: z.string(), description: z.string().optional(), calendarType: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createCalendar(args), null, 2) }] }));
  s.tool("get_calendar", "Get a calendar by ID.", { calendarId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCalendar(args), null, 2) }] }));
  s.tool("update_calendar", "Update a calendar.", { calendarId: z.string(), name: z.string().optional(), description: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateCalendar(args), null, 2) }] }));
  s.tool("delete_calendar", "Delete a calendar.", { calendarId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteCalendar(args), null, 2) }] }));
  s.tool("get_free_slots", "Get available booking slots for a calendar.", { calendarId: z.string(), startDate: z.string(), endDate: z.string(), timezone: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getFreeSlots(args), null, 2) }] }));
  s.tool("get_blocked_slots", "Get blocked time slots for a calendar.", { locationId: z.string(), startTime: z.string(), endTime: z.string(), calendarId: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getBlockedSlots(args), null, 2) }] }));
  s.tool("create_appointment", "Create a calendar appointment.", { calendarId: z.string(), locationId: z.string(), contactId: z.string(), startTime: z.string(), endTime: z.string().optional(), title: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createAppointment(args), null, 2) }] }));
  s.tool("get_appointment", "Get an appointment by ID.", { appointmentId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getAppointment(args), null, 2) }] }));
  s.tool("update_appointment", "Update an appointment.", { appointmentId: z.string(), startTime: z.string().optional(), endTime: z.string().optional(), status: z.string().optional(), title: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateAppointment(args), null, 2) }] }));
  s.tool("delete_appointment", "Delete an appointment.", { appointmentId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteAppointment(args), null, 2) }] }));
  s.tool("create_block_slot", "Create a blocked time slot on a calendar.", { calendarId: z.string(), locationId: z.string(), startTime: z.string(), endTime: z.string(), title: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createBlockSlot(args), null, 2) }] }));
  s.tool("update_block_slot", "Update a blocked time slot.", { appointmentId: z.string(), startTime: z.string().optional(), endTime: z.string().optional(), title: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateBlockSlot(args), null, 2) }] }));
  s.tool("get_appointment_notes", "Get notes for an appointment.", { calendarId: z.string(), appointmentId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getAppointmentNotes(args), null, 2) }] }));
  s.tool("create_appointment_note", "Add a note to an appointment.", { calendarId: z.string(), appointmentId: z.string(), body: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createAppointmentNote(args), null, 2) }] }));
  s.tool("update_appointment_note", "Update a note on an appointment.", { calendarId: z.string(), appointmentId: z.string(), noteId: z.string(), body: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateAppointmentNote(args), null, 2) }] }));
  s.tool("delete_appointment_note", "Delete a note from an appointment.", { calendarId: z.string(), appointmentId: z.string(), noteId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteAppointmentNote(args), null, 2) }] }));
  s.tool("get_calendar_resources", "Get calendar resources (rooms or equipment).", { locationId: z.string(), resourceType: z.enum(["rooms","equipments"]) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCalendarResources(args), null, 2) }] }));
  s.tool("create_calendar_resource", "Create a calendar resource.", { locationId: z.string(), resourceType: z.enum(["rooms","equipments"]), name: z.string(), capacity: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createCalendarResource(args), null, 2) }] }));
  s.tool("get_calendar_resource", "Get a single calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCalendarResource(args), null, 2) }] }));
  s.tool("update_calendar_resource", "Update a calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string(), name: z.string().optional(), capacity: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateCalendarResource(args), null, 2) }] }));
  s.tool("delete_calendar_resource", "Delete a calendar resource.", { resourceType: z.enum(["rooms","equipments"]), resourceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteCalendarResource(args), null, 2) }] }));
  s.tool("get_calendar_notifications", "Get notifications for a calendar.", { calendarId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCalendarNotifications(args), null, 2) }] }));
  s.tool("create_calendar_notification", "Create a notification for a calendar.", { calendarId: z.string(), type: z.string(), value: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createCalendarNotification(args), null, 2) }] }));
  s.tool("get_calendar_notification", "Get a single calendar notification.", { calendarId: z.string(), notificationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCalendarNotification(args), null, 2) }] }));
  s.tool("update_calendar_notification", "Update a calendar notification.", { calendarId: z.string(), notificationId: z.string(), type: z.string().optional(), value: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateCalendarNotification(args), null, 2) }] }));
  s.tool("delete_calendar_notification", "Delete a calendar notification.", { calendarId: z.string(), notificationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteCalendarNotification(args), null, 2) }] }));

  // ── Locations ──────────────────────────────────────────────────────────────
  s.tool("get_location_by_id", "Get a location by ID.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationById(args), null, 2) }] }));
  s.tool("create_location", "Create a new sub-account/location.", { name: z.string(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), country: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createLocation(args), null, 2) }] }));
  s.tool("update_location", "Update a location.", { locationId: z.string(), name: z.string().optional(), phone: z.string().optional(), email: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateLocation(args), null, 2) }] }));
  s.tool("delete_location", "Delete a location.", { locationId: z.string(), deleteTwilioAccount: z.boolean().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteLocation(args), null, 2) }] }));
  s.tool("get_location_tags", "Get tags for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationTags(args), null, 2) }] }));
  s.tool("create_location_tag", "Create a tag for a location.", { locationId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createLocationTag(args), null, 2) }] }));
  s.tool("get_location_tag", "Get a location tag by ID.", { locationId: z.string(), tagId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationTag(args), null, 2) }] }));
  s.tool("update_location_tag", "Update a location tag.", { locationId: z.string(), tagId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateLocationTag(args), null, 2) }] }));
  s.tool("delete_location_tag", "Delete a location tag.", { locationId: z.string(), tagId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteLocationTag(args), null, 2) }] }));
  s.tool("search_location_tasks", "Search tasks for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await searchLocationTasks(args), null, 2) }] }));
  s.tool("get_location_custom_fields", "Get custom fields for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationCustomFields(args), null, 2) }] }));
  s.tool("create_location_custom_field", "Create a custom field for a location.", { locationId: z.string(), name: z.string(), dataType: z.string(), placeholder: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createLocationCustomField(args), null, 2) }] }));
  s.tool("get_location_custom_field", "Get a location custom field by ID.", { locationId: z.string(), customFieldId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationCustomField(args), null, 2) }] }));
  s.tool("update_location_custom_field", "Update a custom field for a location.", { locationId: z.string(), customFieldId: z.string(), name: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateLocationCustomField(args), null, 2) }] }));
  s.tool("delete_location_custom_field", "Delete a custom field for a location.", { locationId: z.string(), customFieldId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteLocationCustomField(args), null, 2) }] }));
  s.tool("get_location_custom_values", "Get custom values for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationCustomValues(args), null, 2) }] }));
  s.tool("create_location_custom_value", "Create a custom value for a location.", { locationId: z.string(), name: z.string(), value: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createLocationCustomValue(args), null, 2) }] }));
  s.tool("get_location_custom_value", "Get a location custom value by ID.", { locationId: z.string(), customValueId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationCustomValue(args), null, 2) }] }));
  s.tool("update_location_custom_value", "Update a custom value for a location.", { locationId: z.string(), customValueId: z.string(), name: z.string().optional(), value: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateLocationCustomValue(args), null, 2) }] }));
  s.tool("delete_location_custom_value", "Delete a custom value for a location.", { locationId: z.string(), customValueId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteLocationCustomValue(args), null, 2) }] }));
  s.tool("get_location_templates", "Get templates for a location.", { locationId: z.string(), type: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getLocationTemplates(args), null, 2) }] }));
  s.tool("delete_location_template", "Delete a location template.", { locationId: z.string(), templateId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteLocationTemplate(args), null, 2) }] }));
  s.tool("get_timezones", "Get list of available timezones.", async () => ({ content: [{ type: "text", text: JSON.stringify(await getTimezones({}), null, 2) }] }));

  // ── Blogs ──────────────────────────────────────────────────────────────────
  s.tool("get_blog_sites", "Get blog sites for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getBlogSites(args), null, 2) }] }));
  s.tool("get_blog_posts", "Get blog posts for a location.", { locationId: z.string(), limit: z.number().optional(), skip: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getBlogPosts(args), null, 2) }] }));
  s.tool("create_blog_post", "Create a blog post.", { locationId: z.string(), title: z.string(), rawHTML: z.string().optional(), status: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createBlogPost(args), null, 2) }] }));
  s.tool("update_blog_post", "Update a blog post.", { locationId: z.string(), postId: z.string(), title: z.string().optional(), rawHTML: z.string().optional(), status: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateBlogPost(args), null, 2) }] }));
  s.tool("get_blog_authors", "Get blog authors for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getBlogAuthors(args), null, 2) }] }));
  s.tool("get_blog_categories", "Get blog categories for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getBlogCategories(args), null, 2) }] }));
  s.tool("check_blog_url_slug", "Check if a blog URL slug is available.", { locationId: z.string(), slug: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await checkBlogUrlSlug(args), null, 2) }] }));

  // ── Emails ─────────────────────────────────────────────────────────────────
  s.tool("get_email_campaigns", "Get email campaigns for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getEmailCampaigns(args), null, 2) }] }));
  s.tool("create_email_template", "Create an email template.", { locationId: z.string(), name: z.string(), body: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createEmailTemplate(args), null, 2) }] }));
  s.tool("get_email_templates", "Get email templates for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getEmailTemplates(args), null, 2) }] }));
  s.tool("update_email_template", "Update an email template.", { locationId: z.string(), templateId: z.string(), name: z.string().optional(), body: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateEmailTemplate(args), null, 2) }] }));
  s.tool("delete_email_template", "Delete an email template.", { locationId: z.string(), templateId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteEmailTemplate(args), null, 2) }] }));
  s.tool("verify_email", "Verify email deliverability.", { locationId: z.string(), email: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await verifyEmail(args), null, 2) }] }));

  // ── Invoices ───────────────────────────────────────────────────────────────
  s.tool("create_invoice_template", "Create an invoice template.", { locationId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createInvoiceTemplate(args), null, 2) }] }));
  s.tool("list_invoice_templates", "List invoice templates.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listInvoiceTemplates(args), null, 2) }] }));
  s.tool("get_invoice_template", "Get an invoice template by ID.", { locationId: z.string(), templateId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getInvoiceTemplate(args), null, 2) }] }));
  s.tool("update_invoice_template", "Update an invoice template.", { locationId: z.string(), templateId: z.string(), name: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateInvoiceTemplate(args), null, 2) }] }));
  s.tool("delete_invoice_template", "Delete an invoice template.", { locationId: z.string(), templateId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteInvoiceTemplate(args), null, 2) }] }));
  s.tool("create_invoice_schedule", "Create an invoice schedule.", { locationId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createInvoiceSchedule(args), null, 2) }] }));
  s.tool("list_invoice_schedules", "List invoice schedules.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listInvoiceSchedules(args), null, 2) }] }));
  s.tool("get_invoice_schedule", "Get an invoice schedule by ID.", { locationId: z.string(), scheduleId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getInvoiceSchedule(args), null, 2) }] }));
  s.tool("delete_invoice_schedule", "Delete an invoice schedule.", { locationId: z.string(), scheduleId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteInvoiceSchedule(args), null, 2) }] }));
  s.tool("cancel_invoice_schedule", "Cancel an invoice schedule.", { locationId: z.string(), scheduleId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await cancelInvoiceSchedule(args), null, 2) }] }));
  s.tool("generate_invoice_number", "Generate the next invoice number.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await generateInvoiceNumber(args), null, 2) }] }));
  s.tool("create_invoice", "Create an invoice.", { locationId: z.string(), contactId: z.string(), items: z.array(z.object({ name: z.string(), amount: z.number(), qty: z.number().optional() })).optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createInvoice(args), null, 2) }] }));
  s.tool("list_invoices", "List invoices for a location.", { locationId: z.string(), contactId: z.string().optional(), status: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listInvoices(args), null, 2) }] }));
  s.tool("get_invoice", "Get an invoice by ID.", { locationId: z.string(), invoiceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getInvoice(args), null, 2) }] }));
  s.tool("update_invoice", "Update an invoice.", { locationId: z.string(), invoiceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateInvoice(args), null, 2) }] }));
  s.tool("delete_invoice", "Delete an invoice.", { locationId: z.string(), invoiceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteInvoice(args), null, 2) }] }));
  s.tool("send_invoice", "Send an invoice to a contact.", { locationId: z.string(), invoiceId: z.string(), sendEmail: z.boolean().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await sendInvoice(args), null, 2) }] }));
  s.tool("record_invoice_payment", "Record a manual payment on an invoice.", { locationId: z.string(), invoiceId: z.string(), amount: z.number(), mode: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await recordInvoicePayment(args), null, 2) }] }));
  s.tool("void_invoice", "Void an invoice.", { locationId: z.string(), invoiceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await voidInvoice(args), null, 2) }] }));

  // ── Payments ───────────────────────────────────────────────────────────────
  s.tool("list_orders", "List payment orders.", { locationId: z.string(), contactId: z.string().optional(), status: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listOrders(args), null, 2) }] }));
  s.tool("get_order", "Get a payment order by ID.", { locationId: z.string(), orderId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getOrder(args), null, 2) }] }));
  s.tool("create_order_fulfillment", "Create a fulfillment for an order.", { locationId: z.string(), orderId: z.string(), trackingNumber: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createOrderFulfillment(args), null, 2) }] }));
  s.tool("list_order_fulfillments", "List fulfillments for an order.", { locationId: z.string(), orderId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listOrderFulfillments(args), null, 2) }] }));
  s.tool("list_transactions", "List payment transactions.", { locationId: z.string(), contactId: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listTransactions(args), null, 2) }] }));
  s.tool("get_transaction", "Get a transaction by ID.", { locationId: z.string(), transactionId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getTransaction(args), null, 2) }] }));
  s.tool("list_subscriptions", "List payment subscriptions.", { locationId: z.string(), contactId: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listSubscriptions(args), null, 2) }] }));
  s.tool("get_subscription", "Get a subscription by ID.", { locationId: z.string(), subscriptionId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getSubscription(args), null, 2) }] }));
  s.tool("list_coupons", "List coupons for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listCoupons(args), null, 2) }] }));
  s.tool("get_coupon", "Get a coupon by ID.", { locationId: z.string(), couponId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCoupon(args), null, 2) }] }));
  s.tool("create_coupon", "Create a coupon.", { locationId: z.string(), name: z.string(), code: z.string(), discountType: z.string(), discount: z.number() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createCoupon(args), null, 2) }] }));
  s.tool("update_coupon", "Update a coupon.", { locationId: z.string(), couponId: z.string(), name: z.string().optional(), discount: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateCoupon(args), null, 2) }] }));
  s.tool("delete_coupon", "Delete a coupon.", { locationId: z.string(), couponId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteCoupon(args), null, 2) }] }));

  // ── Products ───────────────────────────────────────────────────────────────
  s.tool("create_product", "Create a product.", { locationId: z.string(), name: z.string(), description: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createProduct(args), null, 2) }] }));
  s.tool("get_product", "Get a product by ID.", { locationId: z.string(), productId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getProduct(args), null, 2) }] }));
  s.tool("update_product", "Update a product.", { locationId: z.string(), productId: z.string(), name: z.string().optional(), description: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateProduct(args), null, 2) }] }));
  s.tool("delete_product", "Delete a product.", { locationId: z.string(), productId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteProduct(args), null, 2) }] }));
  s.tool("list_products", "List products for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listProducts(args), null, 2) }] }));
  s.tool("create_product_price", "Create a price for a product.", { locationId: z.string(), productId: z.string(), name: z.string(), amount: z.number(), currency: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createProductPrice(args), null, 2) }] }));
  s.tool("list_product_prices", "List prices for a product.", { locationId: z.string(), productId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listProductPrices(args), null, 2) }] }));
  s.tool("get_product_price", "Get a product price by ID.", { locationId: z.string(), productId: z.string(), priceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getProductPrice(args), null, 2) }] }));
  s.tool("update_product_price", "Update a product price.", { locationId: z.string(), productId: z.string(), priceId: z.string(), amount: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateProductPrice(args), null, 2) }] }));
  s.tool("delete_product_price", "Delete a product price.", { locationId: z.string(), productId: z.string(), priceId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteProductPrice(args), null, 2) }] }));
  s.tool("list_inventory", "List inventory for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listInventory(args), null, 2) }] }));
  s.tool("create_product_collection", "Create a product collection.", { locationId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createProductCollection(args), null, 2) }] }));
  s.tool("list_product_collections", "List product collections.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listProductCollections(args), null, 2) }] }));

  // ── Social Media ───────────────────────────────────────────────────────────
  s.tool("search_social_posts", "Search social media posts.", { locationId: z.string(), skip: z.number().optional(), limit: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await searchSocialPosts(args), null, 2) }] }));
  s.tool("create_social_post", "Create a social media post.", { locationId: z.string(), content: z.string(), accountIds: z.array(z.string()).optional(), scheduleDate: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createSocialPost(args), null, 2) }] }));
  s.tool("get_social_post", "Get a social media post by ID.", { locationId: z.string(), postId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getSocialPost(args), null, 2) }] }));
  s.tool("update_social_post", "Update a social media post.", { locationId: z.string(), postId: z.string(), content: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateSocialPost(args), null, 2) }] }));
  s.tool("delete_social_post", "Delete a social media post.", { locationId: z.string(), postId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteSocialPost(args), null, 2) }] }));
  s.tool("bulk_delete_social_posts", "Bulk delete social media posts.", { locationId: z.string(), postIds: z.array(z.string()) }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await bulkDeleteSocialPosts(args), null, 2) }] }));
  s.tool("get_social_accounts", "Get connected social media accounts.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getSocialAccounts(args), null, 2) }] }));
  s.tool("delete_social_account", "Disconnect a social media account.", { locationId: z.string(), accountId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteSocialAccount(args), null, 2) }] }));

  // ── Surveys ────────────────────────────────────────────────────────────────
  s.tool("get_surveys", "List all surveys for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getSurveys(args), null, 2) }] }));
  s.tool("get_survey_submissions", "Get submissions for a survey.", { locationId: z.string(), surveyId: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getSurveySubmissions(args), null, 2) }] }));

  // ── Workflows ──────────────────────────────────────────────────────────────
  s.tool("get_workflows", "List all workflows for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getWorkflows(args), null, 2) }] }));

  // ── Media ──────────────────────────────────────────────────────────────────
  s.tool("get_media_files", "List media files for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getMediaFiles(args), null, 2) }] }));
  s.tool("delete_media_file", "Delete a media file.", { locationId: z.string(), fileId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteMediaFile(args), null, 2) }] }));

  // ── Custom Fields V2 ───────────────────────────────────────────────────────
  s.tool("get_custom_field_v2", "Get a custom field by ID (v2).", { customFieldId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCustomFieldV2ById(args), null, 2) }] }));
  s.tool("create_custom_field_v2", "Create a custom field (v2). fieldKey is auto-generated from name as contact.{snake_case_name}.", { locationId: z.string(), name: z.string(), dataType: z.enum(["TEXT", "LARGE_TEXT", "NUMERICAL", "PHONE", "MONETARY", "CHECKBOX", "MULTIPLE_OPTIONS", "SINGLE_OPTIONS", "DATE", "TEXTBOX_LIST", "FILE_UPLOAD", "SIGNATURE"]), objectKey: z.string(), parentId: z.string().optional(), placeholder: z.string().optional(), isRequired: z.boolean().optional(), options: z.array(z.string()).optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createCustomFieldV2(args), null, 2) }] }));
  s.tool("update_custom_field_v2", "Update a custom field (v2).", { customFieldId: z.string(), name: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateCustomFieldV2(args), null, 2) }] }));
  s.tool("delete_custom_field_v2", "Delete a custom field (v2).", { customFieldId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteCustomFieldV2(args), null, 2) }] }));
  s.tool("get_custom_fields_v2_by_object_key", "Get custom fields by object key (v2).", { locationId: z.string(), objectKey: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getCustomFieldsV2ByObjectKey(args), null, 2) }] }));
  s.tool("create_custom_field_folder", "Create a custom field folder.", { locationId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createCustomFieldFolder(args), null, 2) }] }));
  s.tool("update_custom_field_folder", "Update a custom field folder.", { folderId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateCustomFieldFolder(args), null, 2) }] }));
  s.tool("delete_custom_field_folder", "Delete a custom field folder.", { folderId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteCustomFieldFolder(args), null, 2) }] }));

  // ── Store / Shipping ───────────────────────────────────────────────────────
  s.tool("create_shipping_zone", "Create a shipping zone.", { locationId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createShippingZone(args), null, 2) }] }));
  s.tool("list_shipping_zones", "List shipping zones.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listShippingZones(args), null, 2) }] }));
  s.tool("get_shipping_zone", "Get a shipping zone by ID.", { locationId: z.string(), zoneId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getShippingZone(args), null, 2) }] }));
  s.tool("update_shipping_zone", "Update a shipping zone.", { locationId: z.string(), zoneId: z.string(), name: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateShippingZone(args), null, 2) }] }));
  s.tool("delete_shipping_zone", "Delete a shipping zone.", { locationId: z.string(), zoneId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteShippingZone(args), null, 2) }] }));
  s.tool("create_shipping_rate", "Create a shipping rate.", { locationId: z.string(), name: z.string(), amount: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createShippingRate(args), null, 2) }] }));
  s.tool("list_shipping_rates", "List shipping rates.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listShippingRates(args), null, 2) }] }));
  s.tool("get_shipping_rate", "Get a shipping rate by ID.", { locationId: z.string(), rateId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getShippingRate(args), null, 2) }] }));
  s.tool("update_shipping_rate", "Update a shipping rate.", { locationId: z.string(), rateId: z.string(), name: z.string().optional(), amount: z.number().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateShippingRate(args), null, 2) }] }));
  s.tool("delete_shipping_rate", "Delete a shipping rate.", { locationId: z.string(), rateId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteShippingRate(args), null, 2) }] }));
  s.tool("create_shipping_carrier", "Create a shipping carrier.", { locationId: z.string(), name: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createShippingCarrier(args), null, 2) }] }));
  s.tool("list_shipping_carriers", "List shipping carriers.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await listShippingCarriers(args), null, 2) }] }));
  s.tool("get_shipping_carrier", "Get a shipping carrier by ID.", { locationId: z.string(), carrierId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getShippingCarrier(args), null, 2) }] }));
  s.tool("update_shipping_carrier", "Update a shipping carrier.", { locationId: z.string(), carrierId: z.string(), name: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateShippingCarrier(args), null, 2) }] }));
  s.tool("delete_shipping_carrier", "Delete a shipping carrier.", { locationId: z.string(), carrierId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteShippingCarrier(args), null, 2) }] }));
  s.tool("create_store_setting", "Create store settings.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createStoreSetting(args), null, 2) }] }));
  s.tool("get_store_setting", "Get store settings.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getStoreSetting(args), null, 2) }] }));

  // ── Associations ───────────────────────────────────────────────────────────
  s.tool("get_all_associations", "Get all association types.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getAllAssociations(args), null, 2) }] }));
  s.tool("create_association", "Create a new association type.", { locationId: z.string(), key: z.string(), firstLabel: z.string(), secondLabel: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createAssociation(args), null, 2) }] }));
  s.tool("get_association_by_id", "Get an association by ID.", { associationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getAssociationById(args), null, 2) }] }));
  s.tool("get_association_by_key", "Get an association by key.", { locationId: z.string(), key: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getAssociationByKey(args), null, 2) }] }));
  s.tool("get_association_by_object_key", "Get associations by object key.", { locationId: z.string(), objectKey: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getAssociationByObjectKey(args), null, 2) }] }));
  s.tool("update_association", "Update an association.", { associationId: z.string(), firstLabel: z.string().optional(), secondLabel: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateAssociation(args), null, 2) }] }));
  s.tool("delete_association", "Delete an association type.", { associationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteAssociation(args), null, 2) }] }));
  s.tool("create_relation", "Link two records together.", { associationId: z.string(), firstRecordId: z.string(), secondRecordId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createRelation(args), null, 2) }] }));
  s.tool("get_relations_by_record", "Get all relations for a record.", { locationId: z.string(), recordId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getRelationsByRecord(args), null, 2) }] }));
  s.tool("delete_relation", "Delete a relation between two records.", { relationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteRelation(args), null, 2) }] }));

  // ── Objects ────────────────────────────────────────────────────────────────
  s.tool("get_objects_by_location", "Get custom object schemas for a location.", { locationId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getObjectsByLocation(args), null, 2) }] }));
  s.tool("create_object_schema", "Create a custom object schema.", { locationId: z.string(), key: z.string(), singular: z.string(), plural: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createObjectSchema(args), null, 2) }] }));
  s.tool("get_object_schema", "Get a custom object schema.", { locationId: z.string(), schemaId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getObjectSchema(args), null, 2) }] }));
  s.tool("update_object_schema", "Update a custom object schema.", { locationId: z.string(), schemaId: z.string(), singular: z.string().optional(), plural: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateObjectSchema(args), null, 2) }] }));
  s.tool("create_object_record", "Create a record in a custom object.", { locationId: z.string(), schemaId: z.string(), properties: z.record(z.string(), z.unknown()).optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createObjectRecord(args), null, 2) }] }));
  s.tool("get_object_record", "Get a custom object record by ID.", { locationId: z.string(), schemaId: z.string(), recordId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getObjectRecord(args), null, 2) }] }));
  s.tool("update_object_record", "Update a custom object record.", { locationId: z.string(), schemaId: z.string(), recordId: z.string(), properties: z.record(z.string(), z.unknown()).optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateObjectRecord(args), null, 2) }] }));
  s.tool("delete_object_record", "Delete a custom object record.", { locationId: z.string(), schemaId: z.string(), recordId: z.string() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await deleteObjectRecord(args), null, 2) }] }));
  s.tool("search_object_records", "Search records in a custom object.", { locationId: z.string(), schemaId: z.string(), query: z.string().optional() }, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await searchObjectRecords(args), null, 2) }] }));

  s.tool("run_sync", "Sync staff team URLs to contact custom fields. Loops through all GHL sub-accounts and writes the staff team URL to the GHL Location ID custom field on the matching contact in the primary location.", {},
    async () => {
      runSync().catch((err) => console.error("[sync] fatal:", err.message));
      return { content: [{ type: "text", text: JSON.stringify({ message: "Sync started", timestamp: new Date().toISOString() }) }] };
    }
  );

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
