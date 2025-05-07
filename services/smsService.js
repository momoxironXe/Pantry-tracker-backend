const twilio = require("twilio")
const SmsVerification = require("../models/SmsVerification")

// Configure Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// Send verification SMS
const sendVerificationSms = async (userId, phoneNumber) => {
  try {
    // Create verification record
    const verification = await SmsVerification.createVerification(userId, phoneNumber)

    // Send SMS
    await twilioClient.messages.create({
      body: `Your Pantry Tracker verification code is: ${verification.verificationCode}. This code will expire in 1 hour.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    })

    return true
  } catch (error) {
    console.error("Error sending verification SMS:", error)
    return false
  }
}

// Send price alert SMS
const sendPriceAlertSms = async (user, items) => {
  try {
    if (!user.phoneNumber || !user.phoneVerified) {
      return false
    }

    // Generate message text (keep it concise for SMS)
    let message = `Pantry Tracker Alerts: `

    // Add up to 3 items to keep SMS short
    const itemsToInclude = items.slice(0, 3)
    itemsToInclude.forEach((item, index) => {
      message += `${item.name}: $${item.currentLowestPrice.price.toFixed(2)} at ${item.currentLowestPrice.storeName}`
      if (index < itemsToInclude.length - 1) {
        message += "; "
      }
    })

    if (items.length > 3) {
      message += ` and ${items.length - 3} more items. Check app for details.`
    }

    message += ` Reply STOP to unsubscribe.`

    // Send SMS
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.phoneNumber,
    })

    return true
  } catch (error) {
    console.error("Error sending price alert SMS:", error)
    return false
  }
}

module.exports = {
  sendVerificationSms,
  sendPriceAlertSms,
}
