const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "fut_terca_token_123";
const SHEETS_API_URL = (process.env.SHEETS_API_URL || "").trim();
const SHEETS_WEBHOOK_SECRET = (process.env.SHEETS_WEBHOOK_SECRET || "").trim();
const WHATSAPP_ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
const WHATSAPP_PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();

app.use(express.json({ limit: "1mb" }));

function cleanPlayerName(name) {
  return String(name || "")
    .replace(/^[-:,.\s]+/, "")
    .replace(/[-:,.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
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

function extractIncomingTextMessages(payload) {
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
            fromPhone: String(message.from || ""),
            timestamp: String(message.timestamp || ""),
            text: String(message.text.body || ""),
          });
        }
      }
    }
  }

  return items;
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
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("[WhatsApp webhook] Reply skipped: WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not configured");
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

      await sendReplySafely(incoming.fromPhone, buildSuccessReply(parsed, result));
      return;
    }

    const reason = result && result.error ? result.error : "erro desconhecido";
    console.error("[WhatsApp webhook] Event rejected:", {
      scorerName: parsed.scorerName,
      assistName: parsed.assistName,
      messageId: incoming.messageId,
      reason,
    });
    await sendReplySafely(incoming.fromPhone, "Nao consegui registrar o evento: " + reason + ".");
  } catch (error) {
    console.error("[WhatsApp webhook] Failed to process event:", error);
    await sendReplySafely(incoming.fromPhone, "Nao consegui registrar o evento agora. Tenta novamente em instantes.");
  }
}

async function processIncomingMessages(messages) {
  for (const incoming of messages) {
    await processIncomingMessage(incoming);
  }
}

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  const payload = req.body || {};
  const messages = extractIncomingTextMessages(payload);
  res.sendStatus(200);
  void processIncomingMessages(messages);
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    sheetsConfigured: Boolean(SHEETS_API_URL),
    replyConfigured: Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
  });
});

app.listen(PORT, () => {
  console.log("[WhatsApp webhook] Running on http://127.0.0.1:" + PORT);
  console.log("[WhatsApp webhook] Verify token: " + VERIFY_TOKEN);
  console.log("[WhatsApp webhook] Sheets URL configured: " + Boolean(SHEETS_API_URL));
  console.log("[WhatsApp webhook] Reply configured: " + Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID));
});
