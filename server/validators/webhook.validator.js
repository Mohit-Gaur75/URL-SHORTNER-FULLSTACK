const { z } = require("zod");
const { idParams, bodyTypeError } = require("./common");
const { WEBHOOK_EVENTS } = require("../models/webhook.model");

const webhookUrl = z
  .string({ error: "Webhook URL is required" })
  .trim()
  .min(1, "Webhook URL cannot be empty")
  .max(2048, "Webhook URL is too long")
  .transform((value, ctx) => {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid URL format" });
      return z.NEVER;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      ctx.addIssue({ code: "custom", message: "Only http and https webhook URLs are allowed" });
      return z.NEVER;
    }

    return parsed.href;
  });

const createWebhookBody = z.strictObject(
  {
    url: webhookUrl,
    description: z.string().trim().max(100, "Description cannot exceed 100 characters").optional(),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "At least one event must be selected").optional(),
  },
  { error: bodyTypeError }
);

const updateWebhookBody = z
  .strictObject(
    {
      url: webhookUrl.optional(),
      description: z.string().trim().max(100, "Description cannot exceed 100 characters").optional(),
      events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "At least one event must be selected").optional(),
      status: z.enum(["active", "disabled"]).optional(),
    },
    { error: bodyTypeError }
  )
  .refine((data) => Object.keys(data).length > 0, "No fields provided to update");

module.exports = {
  createWebhookBody,
  updateWebhookBody,
  idParams,
};
