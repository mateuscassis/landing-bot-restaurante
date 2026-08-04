const express = require("express");

const app = express();
const webhookRouter = express.Router();
const PORT = Number(process.env.PORT || 3000);
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "fut_terca_token_123";
const SHEETS_API_URL = (process.env.SHEETS_API_URL || "").trim();
const SHEETS_WEBHOOK_SECRET = (process.env.SHEETS_WEBHOOK_SECRET || "").trim();
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || "").trim().replace(/\/+$/, "");
const EVOLUTION_API_KEY = (process.env.EVOLUTION_API_KEY || "").trim();
const EVOLUTION_INSTANCE_NAME = (process.env.EVOLUTION_INSTANCE_NAME || "").trim();
const WHATSAPP_ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
const WHATSAPP_PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();

function cleanPlayerName(name) {
  return String(name || "")
    .replace(/^[-:,.\s]+/, "")
    .replace(/[-:,.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhoneTarget(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (raw.includes("@g.us")) {
    return raw;
  }

  return raw.replace(/@s\.whatsapp\.net$/i, "").replace(/\D+/g, "");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNestedString(source, path) {
  let current = source;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = current[key];
  }

  return typeof current === "string" ? current : "";
}

function extractTextFromEvolutionMessage(message) {
  if (!isPlainObject(message)) {
    return "";
  }

  const directCandidates = [
    readNestedString(message, ["conversation"]),
    readNestedString(message, ["extendedTextMessage", "text"]),
    readNestedString(message, ["imageMessage", "caption"]),
    readNestedString(message, ["videoMessage", "caption"]),
    readNestedString(message, ["documentMessage", "caption"]),
    readNestedString(message, ["buttonsResponseMessage", "selectedDisplayText"]),
    readNestedString(message, ["listResponseMessage", "title"]),
    readNestedString(message, ["listResponseMessage", "singleSelectReply", "selectedRowId"]),
  ];

  for (const candidate of directCandidates) {
    if (candidate) {
      return candidate;
    }
  }

  const nestedCandidates = [
    message.ephemeralMessage && message.ephemeralMessage.message,
    message.viewOnceMessage && message.viewOnceMessage.message,
    message.viewOnceMessageV2 && message.viewOnceMessageV2.message,
    message.documentWithCaptionMessage && message.documentWithCaptionMessage.message,
  ];

  for (const nestedMessage of nestedCandidates) {
    const text = extractTextFromEvolutionMessage(nestedMessage);
    if (text) {
      return text;
    }
  }

  return "";
}

function parseGoalEvent(text) {
  const message = String(text || "").trim();
  if (!message) {
    return null;
  }

  const withAssist = message.match(/^(?:gol|g)\s+(.+?)\s+(?:assist|assistencia|assistência|a)\s+(.+)$/i);
  if (withAssist) {
    const scorerName = cleanPlayerName(withAssist[1]);
    const assistName = cleanPlayerName(withAssist[2]);
    if (!scorerName) {
      return null;
    }
    return { scorerName, assistName };
  }

  const onlyGoal = message.match(/^(?:gol|g)\s+(.+)$/i);
  if (onlyGoal) {
    const scorerName = cleanPlayerName(onlyGoal[1]);
    if (!scorerName) {
      return null;
    }
    return { scorerName, assistName: "" };
  }

  return null;
}

function extractMetaIncomingTextMessages(payload) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const items = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change && change.value ? change.value : {};
      const messages = Array.isArray(value.messages) ? value.messages : [];

      for (const message of messages) {
        if (message && message.type === "text" && message.text && message.text.body) {
          items.push({
            messageId: String(message.id || ""),
            fromPhone: normalizePhoneTarget(message.from),
            replyTarget: normalizePhoneTarget(message.from),
            timestamp: String(message.timestamp || ""),
            text: String(message.text.body || ""),
            provider: "meta",
          });
        }
      }
    }
  }

  return items;
}

function shouldProcessEvolutionPayload(payload, eventHint) {
  const eventName = String(payload.event || eventHint || "").trim().toLowerCase();

  if (!eventName) {
    return isPlainObject(payload.data) && isPlainObject(payload.data.message);
  }

  return eventName === "messages.upsert" || eventName === "messages_upsert" || eventName === "messages-upsert";
}

function extractEvolutionIncomingTextMessages(payload, eventHint) {
  if (!shouldProcessEvolutionPayload(payload, eventHint)) {
    return [];
  }

  const rawItems = Array.isArray(payload.data)
    ? payload.data
    : isPlainObject(payload.data)
      ? [payload.data]
      : [];

  const items = [];

  for (const item of rawItems) {
    const key = isPlainObject(item.key) ? item.key : {};
    if (key.fromMe === true) {
      continue;
    }

    const text = extractTextFromEvolutionMessage(item.message);
    if (!text) {
      continue;
    }

    const remoteJid = String(key.remoteJid || item.remoteJid || item.chatId || item.from || "").trim();
    const participant = String(key.participant || item.participant || item.sender || "").trim();
    const replyTarget = normalizePhoneTarget(remoteJid || participant);

    items.push({
      messageId: String(key.id || item.id || ""),
      fromPhone: normalizePhoneTarget(participant || remoteJid),
      replyTarget,
      timestamp: String(item.messageTimestamp || item.messageTimestampLow || item.timestamp || ""),
      text: String(text),
      provider: "evolution",
    });
  }

  return items;
}

function extractIncomingTextMessages(payload, eventHint) {
  if (Array.isArray(payload.entry)) {
    return extractMetaIncomingTextMessages(payload);
  }

  return extractEvolutionIncomingTextMessages(payload, eventHint);
}

async function sendEventToSheets(event) {
  if (!SHEETS_API_URL) {
    throw new Error("SHEETS_API_URL is not configured");
  }

  const payload = {
    action: "register_event",
    scorerName: event.scorerName,
    assistName: event.assistName,
    messageId: event.messageId,
    source: "whatsapp",
    fromPhone: event.fromPhone,
    timestamp: event.timestamp,
    text: event.text,
  };

  if (SHEETS_WEBHOOK_SECRET) {
    payload.secret = SHEETS_WEBHOOK_SECRET;
  }

  const response = await fetch(SHEETS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Sheets API returned HTTP " + response.status);
  }

  return await response.json();
}

async function sendWhatsAppText(toPhone, body) {
  if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) {
    const endpoint = EVOLUTION_API_URL + "/message/sendText/" + encodeURIComponent(EVOLUTION_INSTANCE_NAME);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: toPhone,
        textMessage: { text: body },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error("Evolution reply failed (" + response.status + "): " + errorBody);
    }

    return;
  }

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("[WhatsApp webhook] Reply skipped: no reply provider configured");
    return;
  }

  const endpoint = "https://graph.facebook.com/v23.0/" + WHATSAPP_PHONE_NUMBER_ID + "/messages";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + WHATSAPP_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error("WhatsApp reply failed (" + response.status + "): " + errorBody);
  }
}

function buildSuccessReply(parsed, result) {
  if (result.duplicate) {
    return "Esse evento ja tinha sido registrado anteriormente.";
  }

  if (parsed.assistName) {
    if (result.assistApplied) {
      return "Gol de " + result.scorerName + " e assistencia de " + parsed.assistName + " registrados com sucesso.";
    }
    return "Gol de " + result.scorerName + " registrado. Assistencia nao registrada (jogador nao encontrado: " + parsed.assistName + ").";
  }

  return "Gol de " + result.scorerName + " registrado com sucesso.";
}

async function sendReplySafely(toPhone, body) {
  if (!toPhone) {
    console.warn("[WhatsApp webhook] Reply skipped: empty destination");
    return;
  }

  try {
    await sendWhatsAppText(toPhone, body);
  } catch (error) {
    console.error("[WhatsApp webhook] Failed to send reply:", error);
  }
}

async function processIncomingMessage(incoming) {
  const parsed = parseGoalEvent(incoming.text);
  if (!parsed) {
    return;
  }

  try {
    const result = await sendEventToSheets({
      ...incoming,
      scorerName: parsed.scorerName,
      assistName: parsed.assistName,
    });

    if (result && result.ok === true) {
      console.log("[WhatsApp webhook] Event applied:", {
        scorerName: parsed.scorerName,
        assistName: parsed.assistName,
        messageId: incoming.messageId,
        duplicate: Boolean(result.duplicate),
      });

      await sendReplySafely(incoming.replyTarget || incoming.fromPhone, buildSuccessReply(parsed, result));
      return;
    }

    const reason = result && result.error ? result.error : "erro desconhecido";
    console.error("[WhatsApp webhook] Event rejected:", {
      scorerName: parsed.scorerName,
      assistName: parsed.assistName,
      messageId: incoming.messageId,
      reason,
    });
    await sendReplySafely(incoming.replyTarget || incoming.fromPhone, "Nao consegui registrar o evento: " + reason + ".");
  } catch (error) {
    console.error("[WhatsApp webhook] Failed to process event:", error);
    await sendReplySafely(incoming.replyTarget || incoming.fromPhone, "Nao consegui registrar o evento agora. Tenta novamente em instantes.");
  }
}

async function processIncomingMessages(messages) {
  for (const incoming of messages) {
    await processIncomingMessage(incoming);
  }
}

function handleWebhookVerify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

async function handleWebhookPost(req, res) {
  const payload = req.body || {};
  const messages = extractIncomingTextMessages(payload, req.params.eventName);

  await processIncomingMessages(messages);
  return res.sendStatus(200);
}

function handleHealth(_req, res) {
  const evolutionReplyConfigured = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME);
  const metaReplyConfigured = Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);

  res.status(200).json({
    ok: true,
    sheetsConfigured: Boolean(SHEETS_API_URL),
    replyConfigured: evolutionReplyConfigured || metaReplyConfigured,
    replyProvider: evolutionReplyConfigured ? "evolution" : metaReplyConfigured ? "meta" : "none",
  });
}

webhookRouter.get("/", handleWebhookVerify);
webhookRouter.post("/", handleWebhookPost);
webhookRouter.post("/:eventName", handleWebhookPost);

app.use(express.json({ limit: "1mb" }));
app.use("/webhook", webhookRouter);
app.get("/health", handleHealth);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("[WhatsApp webhook] Running on http://127.0.0.1:" + PORT);
    console.log("[WhatsApp webhook] Verify token: " + VERIFY_TOKEN);
    console.log("[WhatsApp webhook] Sheets URL configured: " + Boolean(SHEETS_API_URL));
    console.log("[WhatsApp webhook] Evolution reply configured: " + Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME));
    console.log("[WhatsApp webhook] Meta reply configured: " + Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID));
  });
}

module.exports = {
  app,
  webhookRouter,
  handleWebhookVerify,
  handleWebhookPost,
  handleHealth,
};
