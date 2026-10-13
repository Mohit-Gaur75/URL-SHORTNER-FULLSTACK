const mongoose = require("mongoose");
const { hashPassword } = require("../utils/password");

const ROLES = ["USER", "ADMIN"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true, 
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, 
    },
   
    role: { type: String, enum: ROLES, default: "USER" },
    
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Hash the password before saving, only when it was set or changed
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await hashPassword(this.password);
});

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
