const { handleWebhookPost } = require("../../whatsapp-webhook");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  req.params = { eventName: req.query.eventName };
  return handleWebhookPost(req, res);
};