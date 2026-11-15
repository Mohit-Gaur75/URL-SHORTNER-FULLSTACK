const router = require("express").Router();
const controller = require("../controllers/webhook.controller");
const { createWebhookBody, updateWebhookBody, idParams } = require("../validators/webhook.validator");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const noStore = require("../middleware/noStore");
const { manageLinks } = require("../middleware/rateLimit");

router.use(noStore);
router.use(authenticate);

router.get("/", manageLinks, controller.listWebhooks);
router.post("/", manageLinks, validate({ body: createWebhookBody }), controller.createWebhook);
router.get("/:id", manageLinks, validate({ params: idParams }), controller.getWebhook);
router.patch("/:id", manageLinks, validate({ params: idParams, body: updateWebhookBody }), controller.updateWebhook);
router.delete("/:id", manageLinks, validate({ params: idParams }), controller.deleteWebhook);
router.post("/:id/test", manageLinks, validate({ params: idParams }), controller.testWebhook);

module.exports = router;
