require("dotenv").config();

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express = require("express");
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const { getSubAccounts, getContacts, createContact, getConversations, sendMessage, getMessages, getBillingCharges } = require("./tools");

// ── Start HTTP server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// session ID → { transport }
const sessions = new Map();

function createServer() {
  const s = new McpServer({ name: "gm-baptist-mcp", version: "1.0.0" });

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

  return s;
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "gm-baptist-mcp" });
});

// MCP GET — SSE stream for existing session
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: "Invalid or missing session ID" });
  }
  await sessions.get(sessionId).handleRequest(req, res);
});

// MCP POST — initialize or continue session
app.post("/mcp", async (req, res) => {
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

  res.on("close", () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
    transport.close();
    mcpServer.close();
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
