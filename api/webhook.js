const { handleWebhookVerify, handleWebhookPost } = require("../whatsapp-webhook");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return handleWebhookVerify(req, res);
  }

  if (req.method === "POST") {
    req.params = {};
    return handleWebhookPost(req, res);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
};