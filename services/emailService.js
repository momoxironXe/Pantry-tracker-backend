const nodemailer = require("nodemailer")
const EmailVerification = require("../models/EmailVerification")

// Configure email transporter based on environment
const getTransporter = () => {
  // Check if we're in development mode
  const isDev = process.env.NODE_ENV === "development"

  if (isDev && process.env.USE_TEST_EMAIL === "true") {
    // For development, use Ethereal (fake SMTP service)
    console.log("Using test email service (Ethereal)")
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: process.env.TEST_EMAIL_USER || "test@ethereal.email",
        pass: process.env.TEST_EMAIL_PASSWORD || "testpassword",
      },
    })
  }

  // For production or if test mode is disabled
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Add debug option for troubleshooting
    debug: process.env.EMAIL_DEBUG === "true",
  })
}

// Send verification email
const sendVerificationEmail = async (userId, email) => {
  try {
    console.log(`Attempting to send verification email to ${email} for user ${userId}`)

    // Create verification record
    const verification = await EmailVerification.createVerification(userId, email)
    console.log(`Created verification record with code: ${verification.verificationCode}`)

    // Get transporter
    const transporter = getTransporter()

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER || "noreply@pantrytracker.com",
      to: email,
      subject: "Verify Your Email - Pantry Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Welcome to Pantry Tracker!</h2>
          <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
          <p>Your verification code is: <strong style="font-size: 18px;">${verification.verificationCode}</strong></p>
          <p>This code will expire in 24 hours.</p>
          <p>If you didn't sign up for Pantry Tracker, please ignore this email.</p>
          <p>Best regards,<br>The Pantry Tracker Team</p>
        </div>
      `,
    }

    // For development, log the verification code
    if (process.env.NODE_ENV === "development") {
      console.log(`DEVELOPMENT MODE: Verification code for ${email} is: ${verification.verificationCode}`)
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`Email sent successfully: ${info.messageId}`)

    // For ethereal email in development, log the preview URL
    if (process.env.NODE_ENV === "development" && process.env.USE_TEST_EMAIL === "true" && info.preview) {
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`)
    }

    return { success: true, code: verification.verificationCode }
  } catch (error) {
    console.error("Error sending verification email:", error)
    return { success: false, error: error.message }
  }
}

// Send price alert email
const sendPriceAlertEmail = async (user, items) => {
  try {
    if (!user.email) {
      return false
    }

    // Generate HTML for items
    let itemsHtml = ""
    items.forEach((item) => {
      itemsHtml += `
        <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
          <h3 style="margin: 0 0 5px 0;">${item.name}</h3>
          <p style="margin: 0 0 5px 0;"><strong>Current Price:</strong> $${item.currentLowestPrice.price.toFixed(2)} at ${item.currentLowestPrice.storeName}</p>
          <p style="margin: 0; color: #4CAF50;"><strong>${item.priceAlerts.buyRecommendationReason}</strong></p>
        </div>
      `
    })

    // Send email
    const transporter = getTransporter()
    const mailOptions = {
      from: process.env.EMAIL_USER || "noreply@pantrytracker.com",
      to: user.email,
      subject: "Price Alerts - Pantry Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Price Alerts from Pantry Tracker</h2>
          <p>Hello ${user.firstName},</p>
          <p>We've found some great deals for items you're tracking:</p>
          <div style="margin: 20px 0;">
            ${itemsHtml}
          </div>
          <p>Log in to your Pantry Tracker account to see more details.</p>
          <p>Best regards,<br>The Pantry Tracker Team</p>
          <p style="font-size: 12px; color: #888;">
            You received this email because you signed up for price alerts. 
            <a href="[unsubscribe_link]" style="color: #888;">Unsubscribe</a>
          </p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error("Error sending price alert email:", error)
    return false
  }
}

// Send recipe price update email
const sendRecipePriceUpdateEmail = async (user, recipes) => {
  try {
    if (!user.email) {
      return false
    }

    // Generate HTML for recipes
    let recipesHtml = ""
    recipes.forEach((recipe) => {
      const changeClass = recipe.currentPrice.percentChange.weekly < 0 ? "green" : "red"
      const changeSymbol = recipe.currentPrice.percentChange.weekly < 0 ? "↓" : "↑"

      recipesHtml += `
        <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
          <h3 style="margin: 0 0 5px 0;">${recipe.name}</h3>
          <p style="margin: 0 0 5px 0;"><strong>Current Cost:</strong> $${recipe.currentPrice.totalPrice.toFixed(2)}</p>
          <p style="margin: 0; color: ${changeClass === "green" ? "#4CAF50" : "#F44336"};">
            <strong>Weekly Change: ${changeSymbol} ${Math.abs(recipe.currentPrice.percentChange.weekly).toFixed(1)}%</strong>
          </p>
        </div>
      `
    })

    // Send email
    const transporter = getTransporter()
    const mailOptions = {
      from: process.env.EMAIL_USER || "noreply@pantrytracker.com",
      to: user.email,
      subject: "Recipe Price Updates - Pantry Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Recipe Price Updates</h2>
          <p>Hello ${user.firstName},</p>
          <p>Here's the latest cost update for your saved recipes:</p>
          <div style="margin: 20px 0;">
            ${recipesHtml}
          </div>
          <p>Log in to your Pantry Tracker account to see more details.</p>
          <p>Best regards,<br>The Pantry Tracker Team</p>
          <p style="font-size: 12px; color: #888;">
            You received this email because you signed up for recipe price updates. 
            <a href="[unsubscribe_link]" style="color: #888;">Unsubscribe</a>
          </p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error("Error sending recipe price update email:", error)
    return false
  }
}

module.exports = {
  sendVerificationEmail,
  sendPriceAlertEmail,
  sendRecipePriceUpdateEmail,
}
