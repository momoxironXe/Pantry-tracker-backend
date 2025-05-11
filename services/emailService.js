const nodemailer = require("nodemailer")
const mongoose = require("mongoose")

// Configure email transporter based on environment
const getTransporter = () => {
  // For development or testing, use a test account
  if (process.env.NODE_ENV === "development" && process.env.USE_TEST_EMAIL === "true") {
    console.log("Using test email account for development")
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: process.env.TEST_EMAIL_USER,
        pass: process.env.TEST_EMAIL_PASS,
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

// Add better error handling and logging to the sendVerificationEmail function
const sendVerificationEmail = async (to, code) => {
  try {
    // Create a test account if using test email
    let testAccount
    let transporter

    if (process.env.USE_TEST_EMAIL === "true") {
      console.log("Using test email account")
      testAccount = await nodemailer.createTestAccount()

      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: process.env.TEST_EMAIL_USER || testAccount.user,
          pass: process.env.TEST_EMAIL_PASS || testAccount.pass,
        },
      })
    } else {
      // Use real email service
      transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      })
    }

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"Grocery Price Tracker" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: "Verify Your Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4CAF50; text-align: center;">Verify Your Email</h2>
          <p>Thank you for signing up for Grocery Price Tracker! Please use the verification code below to complete your registration:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 30 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <div style="margin-top: 30px; text-align: center; color: #666;">
            <p>© ${new Date().getFullYear()} Grocery Price Tracker</p>
          </div>
        </div>
      `,
    })

    if (process.env.EMAIL_DEBUG === "true" || process.env.USE_TEST_EMAIL === "true") {
      console.log("Message sent: %s", info.messageId)

      // Preview URL only available when sending through Ethereal/test email
      if (process.env.USE_TEST_EMAIL === "true") {
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
      }
    }

    return { success: true, info }
  } catch (error) {
    console.error("Error sending verification email:", error)
    return { success: false, error: error.message }
  }
}

// Send price alert email
const sendPriceAlertEmail = async (user, items) => {
  try {
    if (!user.email) {
      return { success: false, error: "User email not provided" }
    }

    // Generate HTML for items
    let itemsHtml = ""
    items.forEach((item) => {
      itemsHtml += `
        <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
          <h3 style="margin: 0 0 5px 0;">${item.name}</h3>
          <p style="margin: 0 0 5px 0;"><strong>Current Price:</strong> $${item.currentLowestPrice.price.toFixed(2)} at ${
            item.currentLowestPrice.storeName
          }</p>
          <p style="margin: 0; color: #4CAF50;"><strong>${
            item.priceAlerts?.buyRecommendationReason || "Price has changed"
          }</strong></p>
        </div>
      `
    })

    // Send email
    const transporter = getTransporter()
    const mailOptions = {
      from: process.env.EMAIL_USER || "pantrytracker@example.com",
      to: user.email,
      subject: "Price Alerts - Pantry Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Price Alerts from Pantry Tracker</h2>
          <p>Hello ${user.firstName || user.fullName || "there"},</p>
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

    const info = await transporter.sendMail(mailOptions)
    console.log(`Price alert email sent successfully: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending price alert email:", error)
    return { success: false, error: error.message }
  }
}

// Send recipe price update email
const sendRecipePriceUpdateEmail = async (user, recipes) => {
  try {
    if (!user.email) {
      return { success: false, error: "User email not provided" }
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
      from: process.env.EMAIL_USER || "pantrytracker@example.com",
      to: user.email,
      subject: "Recipe Price Updates - Pantry Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Recipe Price Updates</h2>
          <p>Hello ${user.firstName || user.fullName || "there"},</p>
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

    const info = await transporter.sendMail(mailOptions)
    console.log(`Recipe price update email sent successfully: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending recipe price update email:", error)
    return { success: false, error: error.message }
  }
}

module.exports = {
  sendVerificationEmail,
  sendPriceAlertEmail,
  sendRecipePriceUpdateEmail,
}
