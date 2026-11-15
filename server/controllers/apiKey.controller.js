const apiKeyService = require("../services/apiKey.service");
const { logAudit } = require("../services/audit.service");

exports.createApiKey = async (req, res) => {
  const { name, expiresAt } = req.validated.body;
  const result = await apiKeyService.generateApiKey(req.user._id, { name, expiresAt });
  logAudit({ user: req.user, action: "API_KEY_CREATED", details: { name, keyPrefix: result.keyPrefix }, req });
  res.status(201).json(result);
};

exports.listApiKeys = async (req, res) => {
  const items = await apiKeyService.listApiKeys(req.user._id);
  res.json({ items });
};

exports.revokeApiKey = async (req, res) => {
  const { id } = req.validated.params;
  await apiKeyService.revokeApiKey(req.user._id, id);
  logAudit({ user: req.user, action: "API_KEY_REVOKED", details: { keyId: id }, req });
  res.status(204).end();
};
