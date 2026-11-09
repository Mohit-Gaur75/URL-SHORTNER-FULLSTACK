const Url = require("../models/url.model");
const clickBuffer = require("../services/clickBuffer.service");

async function flushClicks() {
  const batch = await clickBuffer.loadBatch();
  if (batch.length === 0) return { flushed: 0 };

  await Url.bulkWrite(
    batch.map(({ code, count, lastClickedAt }) => ({
      updateOne: {
        filter: { shortCode: code },
        update: {
          $inc: { clicks: count },
          $max: { lastClickedAt: lastClickedAt || new Date() },
        },
      },
    })),
    { ordered: false, timestamps: false }
  );

  await clickBuffer.clearBatch();
  return { flushed: batch.length };
}

module.exports = { flushClicks };
