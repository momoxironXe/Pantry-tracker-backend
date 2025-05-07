const mongoose = require("mongoose")

const emailVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  verificationCode: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Method to check if verification code is expired
emailVerificationSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt
}

// Static method to generate a random verification code
emailVerificationSchema.statics.generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString() // 6-digit code
}

// Static method to create a new verification
emailVerificationSchema.statics.createVerification = async function (userId, email) {
  // Delete any existing verification for this user/email
  await this.deleteMany({ userId, email })

  // Create new verification
  const code = this.generateCode()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24) // Expires in 24 hours

  const verification = new this({
    userId,
    email,
    verificationCode: code,
    expiresAt,
  })

  await verification.save()
  return verification
}

const EmailVerification = mongoose.model("EmailVerification", emailVerificationSchema)

module.exports = EmailVerification
