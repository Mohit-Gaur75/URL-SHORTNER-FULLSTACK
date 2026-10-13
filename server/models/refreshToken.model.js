const mongoose = require("mongoose");

// One row per refresh token we have handed out. The token itself is NEVER
// stored, only its SHA-256 hash.
//
// `family` ties together every token descended from one login. Each refresh
// replaces the token with a new one in the same family. If an OLD token is ever
// presented again, someone copied it, and we revoke the whole family.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true }, // the lookup key
    family: { type: mongoose.Schema.Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null }, // set when used up, or on logout
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// tokenHash_1 (unique, from the field above): every refresh and logout looks the token up by hash.
refreshTokenSchema.index({ user: 1 }); //   "log out everywhere" revokes all of one user's tokens
refreshTokenSchema.index({ family: 1 }); // theft detected: revoke the family
// TTL index: MongoDB itself deletes a row shortly after expiresAt passes.
// Revoked rows are kept until then ON PURPOSE: reuse detection needs to
// recognize an old token for as long as it could still be valid.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
