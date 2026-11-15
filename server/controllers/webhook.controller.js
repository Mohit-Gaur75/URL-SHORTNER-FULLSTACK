const webhookService = require("../services/webhook.service");
const { logAudit } = require("../services/audit.service");

exports.createWebhook = async (req, res) => {
  const { url, description, events } = req.validated.body;
  const webhook = await webhookService.createWebhook({
    userId: req.user._id,
    url,
    description,
    events,
  });

  await logAudit(req.user._id, "WEBHOOK_CREATED", {
    webhookId: webhook._id,
    url: webhook.url,
    events: webhook.events,
  });

  res.status(201).json({
    id: webhook._id.toString(),
    url: webhook.url,
    description: webhook.description,
    events: webhook.events,
    status: webhook.status,
    secret: webhook.secret, // returned once upon creation
    createdAt: webhook.createdAt,
  });
};

exports.listWebhooks = async (req, res) => {
  const webhooks = await webhookService.listWebhooks(req.user._id);
  res.json({ webhooks });
};

exports.getWebhook = async (req, res) => {
  const webhook = await webhookService.getWebhookById(req.user._id, req.params.id);
  res.json({
    id: webhook._id.toString(),
    url: webhook.url,
    description: webhook.description,
    events: webhook.events,
    status: webhook.status,
    secret: `hook_sec_••••${webhook.secret.slice(-4)}`,
    failureCount: webhook.failureCount,
    lastDeliveredAt: webhook.lastDeliveredAt,
    lastStatusCode: webhook.lastStatusCode,
    lastError: webhook.lastError,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  });
};

exports.updateWebhook = async (req, res) => {
  const webhook = await webhookService.updateWebhook(req.user._id, req.params.id, req.validated.body);

  await logAudit(req.user._id, "WEBHOOK_UPDATED", {
    webhookId: webhook._id,
    changes: req.validated.body,
  });

  res.json({
    id: webhook._id.toString(),
    url: webhook.url,
    description: webhook.description,
    events: webhook.events,
    status: webhook.status,
    secret: `hook_sec_••••${webhook.secret.slice(-4)}`,
    failureCount: webhook.failureCount,
    lastDeliveredAt: webhook.lastDeliveredAt,
    lastStatusCode: webhook.lastStatusCode,
    lastError: webhook.lastError,
    updatedAt: webhook.updatedAt,
  });
};

exports.deleteWebhook = async (req, res) => {
  await webhookService.deleteWebhook(req.user._id, req.params.id);

  await logAudit(req.user._id, "WEBHOOK_DELETED", {
    webhookId: req.params.id,
  });

  res.status(204).send();
};

exports.testWebhook = async (req, res) => {
  const result = await webhookService.testWebhook(req.user._id, req.params.id);
  res.json(result);
};
