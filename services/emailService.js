const nodemailer = require("nodemailer")

// Create a transporter
let transporter

// Initialize the transporter
const initTransporter = async () => {
  // Check if we should use test email (Ethereal)
  if (process.env.USE_TEST_EMAIL === "true") {
    // Create a test account at Ethereal
    const testAccount = await nodemailer.createTestAccount()

    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: process.env.TEST_EMAIL_USER || testAccount.user,
        pass: process.env.TEST_EMAIL_PASS || testAccount.pass,
      },
    })

    console.log("Using test email account:", testAccount.user)
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
}

// Send verification email
const sendVerificationEmail = async (email, code, firstName) => {
  try {
    // Initialize transporter if not already done
    if (!transporter) {
      await initTransporter()
    }

    // Create email content with HTML
    const mailOptions = {
      from: `"Grocery Price Tracker" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      text: `Hello ${firstName},\n\nThank you for signing up! Your verification code is: ${code}\n\nThis code will expire in 24 hours.\n\nBest regards,\nThe Grocery Price Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4CAF50;">Grocery Price Tracker</h1>
          </div>
          <div style="margin-bottom: 30px;">
            <p>Hello ${firstName},</p>
            <p>Thank you for signing up! Please use the verification code below to complete your registration:</p>
            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
              ${code}
            </div>
            <p>This code will expire in 24 hours.</p>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>If you didn't request this verification code, please ignore this email.</p>
            <p>Best regards,<br>The Grocery Price Tracker Team</p>
          </div>
        </div>
      `,
    }

    // Send the email
    const info = await transporter.sendMail(mailOptions)

    // Log the result if in debug mode
    if (process.env.EMAIL_DEBUG === "true") {
      console.log("Email sent:", info)

      // If using Ethereal, log the URL to view the email
      if (process.env.USE_TEST_EMAIL === "true") {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info))
      }
    }

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending verification email:", error)
    return { success: false, error: error.message }
  }
}

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  try {
    // Initialize transporter if not already done
    if (!transporter) {
      await initTransporter()
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`

    // Create email content with HTML
    const mailOptions = {
      from: `"Grocery Price Tracker" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password",
      text: `Hello ${firstName},\n\nYou requested a password reset. Click the following link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe Grocery Price Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4CAF50;">Grocery Price Tracker</h1>
          </div>
          <div style="margin-bottom: 30px;">
            <p>Hello ${firstName},</p>
            <p>You requested a password reset. Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>Best regards,<br>The Grocery Price Tracker Team</p>
          </div>
        </div>
      `,
    }

    // Send the email
    const info = await transporter.sendMail(mailOptions)

    // Log the result if in debug mode
    if (process.env.EMAIL_DEBUG === "true") {
      console.log("Password reset email sent:", info)

      // If using Ethereal, log the URL to view the email
      if (process.env.USE_TEST_EMAIL === "true") {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info))
      }
    }

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending password reset email:", error)
    return { success: false, error: error.message }
  }
}

// Send price alert email
const sendPriceAlertEmail = async (email, alerts, firstName) => {
  try {
    // Initialize transporter if not already done
    if (!transporter) {
      await initTransporter()
    }

    // Create HTML for alerts
    let alertsHtml = ""

    alerts.forEach((alert) => {
      const priceChange = alert.previousPrice - alert.currentPrice
      const percentChange = ((priceChange / alert.previousPrice) * 100).toFixed(1)
      const isDecrease = priceChange > 0

      alertsHtml += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${alert.itemName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">$${alert.currentPrice.toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">$${alert.previousPrice.toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; color: ${isDecrease ? "#4CAF50" : "#f44336"};">
            ${isDecrease ? "↓" : "↑"} ${Math.abs(percentChange)}%
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${alert.storeName}</td>
        </tr>
      `
    })

    // Create email content with HTML
    const mailOptions = {
      from: `"Grocery Price Tracker" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Price Alert: Changes in Your Tracked Items",
      text: `Hello ${firstName},\n\nWe've detected price changes in items you're tracking.\n\n${alerts
        .map((alert) => {
          const priceChange = alert.previousPrice - alert.currentPrice
          const percentChange = ((priceChange / alert.previousPrice) * 100).toFixed(1)
          const direction = priceChange > 0 ? "decreased" : "increased"
          return `${alert.itemName}: ${direction} by ${Math.abs(percentChange)}% (now $${alert.currentPrice.toFixed(2)}, was $${alert.previousPrice.toFixed(2)}) at ${alert.storeName}`
        })
        .join("\n")}\n\nBest regards,\nThe Grocery Price Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4CAF50;">Grocery Price Tracker</h1>
          </div>
          <div style="margin-bottom: 30px;">
            <p>Hello ${firstName},</p>
            <p>We've detected price changes in items you're tracking:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Item</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Current Price</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Previous Price</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Change</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Store</th>
                </tr>
              </thead>
              <tbody>
                ${alertsHtml}
              </tbody>
            </table>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
            </div>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>You're receiving this email because you've set up price alerts in your Grocery Price Tracker account.</p>
            <p>To manage your notification preferences, visit your <a href="${process.env.FRONTEND_URL}/settings" style="color: #4CAF50;">account settings</a>.</p>
            <p>Best regards,<br>The Grocery Price Tracker Team</p>
          </div>
        </div>
      `,
    }

    // Send the email
    const info = await transporter.sendMail(mailOptions)

    // Log the result if in debug mode
    if (process.env.EMAIL_DEBUG === "true") {
      console.log("Price alert email sent:", info)

      // If using Ethereal, log the URL to view the email
      if (process.env.USE_TEST_EMAIL === "true") {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info))
      }
    }

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending price alert email:", error)
    return { success: false, error: error.message }
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPriceAlertEmail,
}
