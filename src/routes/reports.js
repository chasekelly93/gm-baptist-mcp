const express = require("express");
const { randomUUID } = require("node:crypto");
const axios = require("axios");
const router = express.Router();
const {
  getConversations, getContact, getMessages, getContactsByTag,
} = require("../tools");

// ── Job store (in-memory) ──
const jobs = new Map();

// Clean up jobs older than 30 minutes
function cleanOldJobs() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}

// ── Engagement data (unread conversations + contact + messages) ──
router.get("/engagement-data", async (_req, res) => {
  try {
    const locationId = process.env.PRIMARY_LOCATION_ID;
    if (!locationId) return res.status(500).json({ error: "PRIMARY_LOCATION_ID not set" });

    const convosResult = await getConversations({ locationId, status: "unread", limit: 50 });
    const convos = convosResult.conversations || [];

    const enriched = await Promise.all(convos.map(async (convo) => {
      let contact = null;
      let messages = [];
      try {
        if (convo.contactId) contact = await getContact({ contactId: convo.contactId });
      } catch (e) { contact = { error: e.message }; }
      try {
        messages = await getMessages({ conversationId: convo.id, limit: 5 });
      } catch (e) { messages = { error: e.message }; }
      return {
        conversationId: convo.id,
        contactId: convo.contactId,
        lastMessageDate: convo.lastMessageDate || convo.dateUpdated,
        contact: contact ? {
          id: contact.id || contact.contactId,
          firstName: contact.firstName || contact.contact?.firstName,
          lastName: contact.lastName || contact.contact?.lastName,
          email: contact.email || contact.contact?.email,
          phone: contact.phone || contact.contact?.phone,
          tags: contact.tags || contact.contact?.tags || [],
        } : null,
        messages: Array.isArray(messages.messages || messages) ? (messages.messages || messages).map((m) => ({
          direction: m.direction,
          body: m.body,
          dateAdded: m.dateAdded,
          type: m.type || m.messageType,
        })) : messages,
      };
    }));

    res.json({
      locationId,
      pulledAt: new Date().toISOString(),
      totalUnread: enriched.length,
      conversations: enriched,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Client health: kick off job ──
// Pass ?callback=https://hook.make.com/xxx to receive results via webhook when done
// Only one job runs at a time — duplicate requests return the existing job
router.get("/client-health", async (req, res) => {
  cleanOldJobs();

  // Check if a job is already running
  for (const [existingId, existingJob] of jobs) {
    if (existingJob.type === "client-health" && existingJob.status === "running") {
      return res.json({ status: "already_running", jobId: existingId, progress: existingJob.progress, poll: `/api/client-health/${existingId}` });
    }
  }

  const locationId = process.env.PRIMARY_LOCATION_ID;
  if (!locationId) return res.status(500).json({ error: "PRIMARY_LOCATION_ID not set" });

  const jobId = randomUUID();
  const callback = req.query.callback || null;
  const job = { type: "client-health", status: "running", startedAt: new Date().toISOString(), progress: "0/0", callback, result: null };
  jobs.set(jobId, job);

  res.json({ status: "started", jobId, poll: `/api/client-health/${jobId}`, callback: callback || "none (add ?callback=URL to receive results)" });

  // Run in background
  runClientHealth(locationId, job).then(async () => {
    if (job.callback) {
      try {
        await axios.post(job.callback, job.result, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
        console.log(`[client-health] callback sent to ${job.callback}`);
      } catch (e) {
        console.error(`[client-health] callback failed: ${e.message}`);
      }
    }
  }).catch((e) => {
    job.status = "error";
    job.error = e.message;
  });
});

// ── Client health: poll for result ──
router.get("/client-health/:jobId", async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.status === "complete") {
    return res.json({ status: "complete", ...job.result });
  }
  if (job.status === "error") {
    return res.json({ status: "error", error: job.error });
  }

  res.json({ status: "running", progress: job.progress, startedAt: job.startedAt });
});

// ── Client health worker ──
async function runClientHealth(locationId, job) {
  const [platinumResult, subscriberResult] = await Promise.all([
    getContactsByTag({ locationId, tags: ["platinum"], limit: 100 }).catch((e) => ({ contacts: [], error: `platinum: ${e.message}` })),
    getContactsByTag({ locationId, tags: ["software subscription"], limit: 100 }).catch((e) => ({ contacts: [], error: `subscription: ${e.message}` })),
  ]);

  const contactMap = new Map();
  [...(platinumResult.contacts || []), ...(subscriberResult.contacts || [])].forEach((c) => {
    if (c.id && !contactMap.has(c.id)) contactMap.set(c.id, c);
  });
  const contacts = Array.from(contactMap.values());

  const BATCH_SIZE = 20;
  const BATCH_DELAY_MS = 15000;
  const enriched = [];

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    job.progress = `${Math.min(i + BATCH_SIZE, contacts.length)}/${contacts.length}`;

    const batchResults = await Promise.all(batch.map(async (contact) => {
      let conversations = [];
      let recentMessages = [];
      try {
        const convosResult = await getConversations({ locationId, contactId: contact.id, limit: 5 });
        conversations = (convosResult.conversations || []).map((c) => ({
          id: c.id,
          lastMessageDate: c.lastMessageDate || c.dateUpdated,
          unreadCount: c.unreadCount,
        }));
        if (conversations.length > 0) {
          const msgResult = await getMessages({ conversationId: conversations[0].id, limit: 10 });
          recentMessages = (msgResult.messages || msgResult || []).map((m) => ({
            direction: m.direction,
            body: m.body,
            dateAdded: m.dateAdded,
            type: m.type || m.messageType,
          }));
        }
      } catch (e) {
        conversations = [{ error: e.message }];
      }

      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        tags: contact.tags || [],
        createdAt: contact.createdAt || contact.dateAdded,
        conversations,
        recentMessages,
      };
    }));

    enriched.push(...batchResults);

    if (i + BATCH_SIZE < contacts.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  job.status = "complete";
  job.result = {
    locationId,
    pulledAt: new Date().toISOString(),
    totalClients: enriched.length,
    clients: enriched,
  };
}

// ── Debug: tag search diagnostics ──
router.get("/debug-tags", async (_req, res) => {
  try {
    const locationId = process.env.PRIMARY_LOCATION_ID;
    const client = require("../ghl-client").locationClient(locationId);
    const response = await client.get("/contacts/", { params: { locationId, limit: 100 } });
    const contacts = response.data.contacts || [];
    const total = response.data.total || response.data.count;
    const meta = response.data.meta || response.data.pagination;
    const allTags = new Set();
    let platinumCount = 0;
    let subCount = 0;
    contacts.forEach((c) => {
      (c.tags || []).forEach((t) => {
        allTags.add(t);
        if (t.toLowerCase() === "platinum") platinumCount++;
        if (t.toLowerCase() === "software subscription") subCount++;
      });
    });
    res.json({
      totalFromApi: total,
      contactsOnPage: contacts.length,
      paginationMeta: meta,
      allUniqueTags: Array.from(allTags).sort(),
      platinumOnThisPage: platinumCount,
      softwareSubscriptionOnThisPage: subCount,
      sampleContact: contacts[0] ? { id: contacts[0].id, tags: contacts[0].tags, firstName: contacts[0].firstName } : null,
      lastContact: contacts.length ? { id: contacts[contacts.length - 1].id, tags: contacts[contacts.length - 1].tags, firstName: contacts[contacts.length - 1].firstName } : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
