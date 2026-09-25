const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    // Account eligibility: only ACTIVE accounts may claim rewards.
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return { id: this._id.toString(), name: this.name, email: this.email, status: this.status, createdAt: this.createdAt };
};

module.exports = mongoose.model('User', userSchema);
