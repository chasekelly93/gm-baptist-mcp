require("dotenv").config();

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express = require("express");
const { z } = require("zod");
const { getSubAccounts, getContacts, createContact, getConversations, sendMessage, getMessages, getBillingCharges } = require("./tools");

const server = new McpServer({
  name: "gohighlevel-mcp",
  version: "1.0.0",
});

// ── get_sub_accounts ──────────────────────────────────────────────────────────
server.tool(
  "get_sub_accounts",
  "List all sub-accounts (locations) under the agency. Requires GHL_API_KEY.",
  {
    limit: z.number().int().min(1).max(100).default(10).describe("Number of results to return (max 100)"),
    skip: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
  },
  async ({ limit, skip }) => {
    const result = await getSubAccounts({ limit, skip });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── get_contacts ──────────────────────────────────────────────────────────────
server.tool(
  "get_contacts",
  "Get contacts for a sub-account location. Requires GHL_LOCATION_API_KEY.",
  {
    locationId: z.string().describe("The GHL location (sub-account) ID"),
    limit: z.number().int().min(1).max(100).default(20).describe("Number of contacts to return"),
    skip: z.number().int().min(0).default(0).describe("Number of contacts to skip for pagination"),
    query: z.string().optional().describe("Search query to filter contacts by name, email, or phone"),
  },
  async ({ locationId, limit, skip, query }) => {
    const result = await getContacts({ locationId, limit, skip, query });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── create_contact ────────────────────────────────────────────────────────────
server.tool(
  "create_contact",
  "Create a new contact in a GHL sub-account location. Requires GHL_LOCATION_API_KEY.",
  {
    locationId: z.string().describe("The GHL location (sub-account) ID"),
    firstName: z.string().optional().describe("Contact's first name"),
    lastName: z.string().optional().describe("Contact's last name"),
    email: z.string().email().optional().describe("Contact's email address"),
    phone: z.string().optional().describe("Contact's phone number in E.164 format (e.g. +12025551234)"),
    tags: z.array(z.string()).optional().describe("List of tags to apply to the contact"),
    source: z.string().optional().describe("Source of the contact (e.g. 'Website', 'Manual')"),
  },
  async ({ locationId, firstName, lastName, email, phone, tags, source }) => {
    const result = await createContact({ locationId, firstName, lastName, email, phone, tags, source });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── get_conversations ─────────────────────────────────────────────────────────
server.tool(
  "get_conversations",
  "Get conversations for a GHL location. Optionally filter by contact. Requires GHL_LOCATION_API_KEY.",
  {
    locationId: z.string().describe("The GHL location (sub-account) ID"),
    limit: z.number().int().min(1).max(100).default(20).describe("Number of conversations to return"),
    skip: z.number().int().min(0).default(0).describe("Number of conversations to skip for pagination"),
    contactId: z.string().optional().describe("Filter conversations by a specific contact ID"),
    status: z.enum(["all", "read", "unread", "open"]).optional().describe("Filter by conversation status: 'unread' returns only unread conversations"),
  },
  async ({ locationId, limit, skip, contactId, status }) => {
    const result = await getConversations({ locationId, limit, skip, contactId, status });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── send_message ──────────────────────────────────────────────────────────────
server.tool(
  "send_message",
  "Send an SMS or Email message to a contact via GHL. Requires GHL_LOCATION_API_KEY.",
  {
    type: z.enum(["SMS", "Email"]).describe("Message type: SMS or Email"),
    locationId: z.string().describe("The GHL location (sub-account) ID"),
    contactId: z.string().optional().describe("The contact ID to send to (used to find/create conversation)"),
    conversationId: z.string().optional().describe("An existing conversation ID to send into"),
    message: z.string().describe("The message body text"),
    subject: z.string().optional().describe("Email subject line (required when type is Email)"),
    emailFrom: z.string().optional().describe("Sender email address (for Email type)"),
    emailFromName: z.string().optional().describe("Sender display name (for Email type)"),
  },
  async ({ type, locationId, contactId, conversationId, message, subject, emailFrom, emailFromName }) => {
    const result = await sendMessage({ type, locationId, contactId, conversationId, message, subject, emailFrom, emailFromName });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── get_messages ──────────────────────────────────────────────────────────────
server.tool(
  "get_messages",
  "Get messages for a specific conversation. Requires GHL_LOCATION_API_KEY.",
  {
    conversationId: z.string().describe("The conversation ID to retrieve messages for"),
    limit: z.number().int().min(1).max(100).default(20).describe("Number of messages to return"),
    lastMessageId: z.string().optional().describe("Cursor for pagination — ID of last message from previous page"),
  },
  async ({ conversationId, limit, lastMessageId }) => {
    const result = await getMessages({ conversationId, limit, lastMessageId });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── get_billing_charges ───────────────────────────────────────────────────────
server.tool(
  "get_billing_charges",
  "Probe GHL agency billing endpoints to find SMS/wallet charge data. Returns raw results from multiple candidate endpoints to identify which ones are accessible with this API key.",
  {
    startDate: z.string().optional().describe("Start date filter (ISO 8601, e.g. 2026-01-01)"),
    endDate: z.string().optional().describe("End date filter (ISO 8601, e.g. 2026-03-31)"),
    locationId: z.string().optional().describe("Filter by a specific sub-account location ID"),
    limit: z.number().int().min(1).max(100).default(100).describe("Number of results to return"),
    skip: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
  },
  async ({ startDate, endDate, locationId, limit, skip }) => {
    const result = await getBillingCharges({ startDate, endDate, locationId, limit, skip });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Start HTTP server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const MCP_SECRET = process.env.MCP_SECRET;

const app = express();
app.use(express.json());

// Optional bearer token auth
app.use((req, res, next) => {
  if (!MCP_SECRET) return next();
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${MCP_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "gm-baptist-mcp" });
});

// MCP endpoint
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => transport.close());

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`GM Baptist MCP server listening on port ${PORT}`);
});
