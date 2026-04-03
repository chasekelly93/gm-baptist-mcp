require("dotenv").config();

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express = require("express");
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const {
  getSubAccounts, getContacts, createContact, getConversations, sendMessage, getMessages, getBillingCharges,
  getContact, updateContact, deleteContact, addContactTags, removeContactTags, searchContacts,
  getContactNotes, addContactNote, markConversationRead, getConversation,
  getPipelines, getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
  getCalendars, getAppointments,
} = require("./tools");

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
    { contactId: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), tags: z.array(z.string()).optional(), companyName: z.string().optional(), address1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), website: z.string().optional(), source: z.string().optional(), dnd: z.boolean().optional() },
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

  return s;
}

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
