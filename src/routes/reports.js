const express = require("express");
const { randomUUID } = require("node:crypto");
const axios = require("axios");
const router = express.Router();
const { locationClient } = require("../ghl-client");
const { getConversations, getContact, getMessages } = require("../tools");

// ── Job store (in-memory) ──
const jobs = new Map();

function cleanOldJobs() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}

// ── Search contacts by tag using GHL /contacts/search (server-side filtering) ──
async function searchByTag(locationId, tag, limit = 100) {
  const client = locationClient(locationId);
  const allContacts = [];
  let page = 1;
  const maxPages = 20;

  while (page <= maxPages) {
    const params = { locationId, limit, query: tag };
    if (page > 1) params.page = page;
    const response = await client.get("/contacts/", { params });
    const contacts = (response.data.contacts || []).filter((c) =>
      c.tags && c.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    );
    allContacts.push(...contacts);
    const meta = response.data.meta || {};
    if ((response.data.contacts || []).length < limit || !meta.nextPageUrl) break;
    page++;
  }

  return allContacts;
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

// ── Enrich a list of contacts with conversations + messages ──
async function enrichContacts(locationId, contacts, job) {
  const BATCH_SIZE = 20;
  const BATCH_DELAY_MS = 5000;
  const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);
  const enriched = [];

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    if (job) {
      job.currentBatch = batchNum;
      job.totalBatches = totalBatches;
      job.progress = `${Math.min(i + BATCH_SIZE, contacts.length)}/${contacts.length}`;
    }
    console.log(`[client-health] batch ${batchNum}/${totalBatches} (${Math.min(i + BATCH_SIZE, contacts.length)}/${contacts.length})`);

    const batchResults = await Promise.all(batch.map(async (contact) => {
      let conversations = [];
      let messageSummary = { total: 0, inbound: 0, outbound: 0, lastDate: null };
      try {
        const convosResult = await getConversations({ locationId, contactId: contact.id, limit: 5 });
        conversations = (convosResult.conversations || []).map((c) => ({
          lastMessageDate: c.lastMessageDate || c.dateUpdated,
          unreadCount: c.unreadCount,
        }));
        if (conversations.length > 0) {
          const msgResult = await getMessages({ conversationId: (convosResult.conversations || [])[0].id, limit: 10 });
          const msgs = msgResult.messages || msgResult || [];
          msgs.forEach((m) => {
            const type = m.type || m.messageType || "";
            if (type === "TYPE_ACTIVITY_OPPORTUNITY" || type === "TYPE_EMAIL") return;
            messageSummary.total++;
            if (m.direction === "inbound") messageSummary.inbound++;
            if (m.direction === "outbound") messageSummary.outbound++;
            const d = m.dateAdded;
            if (d && (!messageSummary.lastDate || d > messageSummary.lastDate)) messageSummary.lastDate = d;
          });
        }
      } catch (e) {
        conversations = [{ error: e.message }];
      }

      return {
        name: `${(contact.firstName || "").trim()} ${(contact.lastName || "").trim()}`.trim(),
        email: contact.email || "",
        phone: contact.phone || "",
        tags: (contact.tags || []).join("; "),
        conversationCount: conversations.length,
        unreadCount: conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
        lastConversationDate: conversations[0]?.lastMessageDate || null,
        messageSummary,
      };
    }));

    enriched.push(...batchResults);

    if (i + BATCH_SIZE < contacts.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return enriched;
}

// ── Client health: kick off job ──
router.get("/client-health", async (req, res) => {
  cleanOldJobs();

  for (const [existingId, existingJob] of jobs) {
    if (existingJob.type === "client-health" && existingJob.status === "running") {
      return res.json({
        status: "already_running",
        jobId: existingId,
        phase: existingJob.phase || "initializing",
        progress: existingJob.progress,
        batch: `${existingJob.currentBatch || 0}/${existingJob.totalBatches || "?"}`,
        totalContacts: existingJob.totalContacts || 0,
        elapsed: `${Math.round((Date.now() - new Date(existingJob.startedAt).getTime()) / 1000)}s`,
        poll: `/api/client-health/${existingId}`,
      });
    }
  }

  const locationId = process.env.PRIMARY_LOCATION_ID;
  if (!locationId) return res.status(500).json({ error: "PRIMARY_LOCATION_ID not set" });

  const jobId = randomUUID();
  const callback = req.query.callback || null;
  const job = { type: "client-health", status: "running", startedAt: new Date().toISOString(), progress: "0/0", callback, jobId, result: null };
  jobs.set(jobId, job);

  res.json({ status: "started", jobId, poll: `/api/client-health/${jobId}`, callback: callback || "none (add ?callback=URL to receive results)" });

  runClientHealth(locationId, job).then(async () => {
    if (job.callback) {
      try {
        await axios.post(job.callback, {
          status: "complete",
          jobId,
          totalClients: job.result.totalClients,
          fetchUrl: `/api/client-health/${jobId}`,
        }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
        console.log(`[client-health] callback sent to ${job.callback}`);
      } catch (e) {
        console.error(`[client-health] callback failed: ${e.message}`);
      }
    }
  }).catch((e) => {
    job.status = "error";
    job.error = e.message;
    console.error(`[client-health] fatal: ${e.message}`);
  });
});

// ── Client health: test with 5 contacts (synchronous) ──
router.get("/client-health/test", async (_req, res) => {
  try {
    const locationId = process.env.PRIMARY_LOCATION_ID;
    if (!locationId) return res.status(500).json({ error: "PRIMARY_LOCATION_ID not set" });

    console.log("[client-health/test] starting...");
    const [platinum, subscription] = await Promise.all([
      searchByTag(locationId, "platinum").catch((e) => { console.error("[test] platinum error:", e.message); return []; }),
      searchByTag(locationId, "software subscription").catch((e) => { console.error("[test] subscription error:", e.message); return []; }),
    ]);
    console.log(`[client-health/test] platinum: ${platinum.length}, subscription: ${subscription.length}`);

    const contactMap = new Map();
    [...platinum, ...subscription].forEach((c) => {
      if (c.id && !contactMap.has(c.id)) contactMap.set(c.id, c);
    });
    const contacts = Array.from(contactMap.values()).slice(0, 5);

    const enriched = await enrichContacts(locationId, contacts, null);

    res.json({
      test: true,
      locationId,
      pulledAt: new Date().toISOString(),
      totalClients: enriched.length,
      platinumFound: platinum.length,
      subscriptionFound: subscription.length,
      clients: enriched,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
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

  res.json({
    status: "running",
    phase: job.phase || "initializing",
    progress: job.progress,
    batch: `${job.currentBatch || 0}/${job.totalBatches || "?"}`,
    totalContacts: job.totalContacts || 0,
    startedAt: job.startedAt,
    elapsed: `${Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)}s`,
  });
});

// ── Client health: get CSV directly ──
router.get("/client-health/:jobId/csv", async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "complete") return res.json({ status: job.status, progress: job.progress });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="client-health-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(job.result.csv);
});

// ── Client health worker ──
async function runClientHealth(locationId, job) {
  console.log("[client-health] started — searching for tagged contacts...");
  job.phase = "fetching contacts";

  const [platinum, subscription] = await Promise.all([
    searchByTag(locationId, "platinum").catch((e) => {
      console.error(`[client-health] platinum error: ${e.message}`);
      return [];
    }),
    searchByTag(locationId, "software subscription").catch((e) => {
      console.error(`[client-health] subscription error: ${e.message}`);
      return [];
    }),
  ]);

  console.log(`[client-health] platinum: ${platinum.length}, subscription: ${subscription.length}`);

  const contactMap = new Map();
  [...platinum, ...subscription].forEach((c) => {
    if (c.id && !contactMap.has(c.id)) contactMap.set(c.id, c);
  });
  const contacts = Array.from(contactMap.values());

  console.log(`[client-health] ${contacts.length} unique contacts to enrich`);
  job.phase = "enriching";
  job.totalContacts = contacts.length;

  const enriched = await enrichContacts(locationId, contacts, job);

  console.log(`[client-health] complete — ${enriched.length} clients enriched`);

  // Score each client
  const scored = enriched.map((c) => scoreClient(c)).sort((a, b) => a.score - b.score);

  // Generate CSV
  const csvHeader = "Name,Email,Phone,Tags,Score,Status,Responsiveness,Activity,Direction,Unread,Last Message,Action";
  const csvRows = scored.map((c) => {
    const fields = [c.name, c.email, c.phone, c.tags, c.score, c.status, c.responsiveness, c.activity, c.direction, c.unread, c.lastMessage, c.action];
    return fields.map((f) => {
      const s = String(f || "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",");
  });

  const needsAttention = scored.filter((c) => c.score <= 40);
  const monitor = scored.filter((c) => c.score > 40 && c.score <= 70);
  const healthy = scored.filter((c) => c.score > 70);
  const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0;

  const summaryRow = `SUMMARY,${new Date().toISOString().slice(0, 10)},Total: ${scored.length},Avg: ${avgScore},Needs Attention: ${needsAttention.length},Monitor: ${monitor.length},Healthy: ${healthy.length},,,,,`;
  const followUp = needsAttention.slice(0, 10).map((c) => c.name).join("; ");
  const followUpRow = `FOLLOW-UP,${followUp},,,,,,,,,,`;

  const csv = [csvHeader, ...csvRows, "", summaryRow, followUpRow].join("\n");

  job.status = "complete";
  job.result = {
    locationId,
    pulledAt: new Date().toISOString(),
    totalClients: scored.length,
    summary: { avgScore, needsAttention: needsAttention.length, monitor: monitor.length, healthy: healthy.length },
    csv,
    clients: scored,
  };
}

// ── Scoring logic ──
function scoreClient(client) {
  const now = Date.now();

  // Responsiveness (40 pts) — based on most recent SMS date
  let responsiveness = 0;
  const lastDateStr = client.messageSummary?.lastDate;
  const lastConvoDate = client.lastConversationDate;
  const lastTs = lastDateStr ? new Date(lastDateStr).getTime() : (lastConvoDate || 0);
  const daysSince = lastTs ? Math.floor((now - lastTs) / (1000 * 60 * 60 * 24)) : 999;
  if (daysSince <= 7) responsiveness = 40;
  else if (daysSince <= 14) responsiveness = 30;
  else if (daysSince <= 30) responsiveness = 20;
  else if (daysSince <= 60) responsiveness = 10;

  // Activity (30 pts) — based on conversation count
  let activity = 0;
  const convoCount = client.conversationCount || 0;
  if (convoCount >= 3) activity = 30;
  else if (convoCount === 2) activity = 25;
  else if (convoCount === 1) activity = 20;

  // Direction (20 pts) — based on inbound vs outbound SMS
  let direction = 0;
  const { total = 0, inbound = 0, outbound = 0 } = client.messageSummary || {};
  if (total > 0) {
    const ratio = inbound / total;
    if (ratio >= 0.5) direction = 20;
    else if (ratio >= 0.3) direction = 15;
    else direction = 5;
  }

  // Unread (10 pts)
  const unread = (client.unreadCount || 0) === 0 ? 10 : 0;

  const score = responsiveness + activity + direction + unread;
  let status, action;
  if (score <= 40) {
    status = "Needs Attention";
    if (daysSince > 60) action = `Re-engage - no contact in ${daysSince} days`;
    else if (daysSince > 30) action = "Follow up via SMS";
    else action = "Review and reach out";
  } else if (score <= 70) {
    status = "Monitor";
    action = unread === 0 && direction < 15 ? "Encourage more engagement" : "Monitor - stable";
  } else {
    status = "Healthy";
    action = "On track";
  }

  const lastMessage = lastTs && lastTs > 0 ? new Date(lastTs).toISOString().slice(0, 10) : "N/A";

  return {
    name: client.name,
    email: client.email,
    phone: client.phone,
    tags: client.tags,
    score,
    status,
    responsiveness,
    activity,
    direction,
    unread,
    lastMessage,
    action,
  };
}

// ── Debug: tag search diagnostics ──
router.get("/debug-tags", async (_req, res) => {
  try {
    const locationId = process.env.PRIMARY_LOCATION_ID;
    const client = locationClient(locationId);
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
