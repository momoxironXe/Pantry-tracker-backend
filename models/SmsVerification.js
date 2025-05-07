const mongoose = require("mongoose")

const smsVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  phoneNumber: {
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
smsVerificationSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt
}

// Static method to generate a random verification code
smsVerificationSchema.statics.generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString() // 6-digit code
}

// Static method to create a new verification
smsVerificationSchema.statics.createVerification = async function (userId, phoneNumber) {
  // Delete any existing verification for this user/phone
  await this.deleteMany({ userId, phoneNumber })

  // Create new verification
  const code = this.generateCode()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 1) // Expires in 1 hour

  const verification = new this({
    userId,
    phoneNumber,
    verificationCode: code,
    expiresAt,
  })

  await verification.save()
  return verification
}

const SmsVerification = mongoose.model("SmsVerification", smsVerificationSchema)

module.exports = SmsVerification
