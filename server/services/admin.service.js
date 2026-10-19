const User = require("../models/user.model");
const Url = require("../models/url.model");

// Cheap collection-size estimates (read from metadata, no scan).
async function getOverview() {
  const [users, links] = await Promise.all([User.estimatedDocumentCount(), Url.estimatedDocumentCount()]);
  return { users, links };
}

module.exports = { getOverview };
