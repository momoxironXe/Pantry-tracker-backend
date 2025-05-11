const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const DataFetchStatus = require("../models/DataFetchStatus")
const auth = require("../middleware/auth")
const storeService = require("../services/storeService")
const priceService = require("../services/priceService")
const apiIntegration = require("../services/apiIntegration")
const PantryItem = require("../models/PantryItem")
const EmailVerification = require("../models/EmailVerification") // Import EmailVerification model
const SmsVerification = require("../models/SmsVerification") // Import SmsVerification model
const emailService = require("../services/emailService")
const smsService = require("../services/smsService")
const router = express.Router()

// User registration
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, zipCode, shoppingStyle, phoneNumber } = req.body

    // Check if user already exists
    let user = await User.findOne({ email })
    if (user) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    // Create new user
    user = new User({
      firstName,
      lastName,
      email,
      password,
      zipCode,
      shoppingStyle: shoppingStyle || "value",
      phoneNumber: phoneNumber || undefined,
      preferences: {
        notificationPreferences: {
          email: {
            priceAlerts: true,
            weeklyDigest: true,
            specialDeals: true,
          },
          sms: {
            priceAlerts: !!phoneNumber,
            specialDeals: !!phoneNumber,
          },
        },
        alertCategories: ["All"],
      },
    })

    // Hash password
    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(password, salt)

    // Save user
    await user.save()

    // Create verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    console.log("Generated verification code:", verificationCode)
    const emailVerification = new EmailVerification({
      userId: user._id,
      email,
      verificationCode,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    })

    await emailVerification.save()

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationCode, user.firstName)

    // Create token
    const payload = {
      user: {
        id: user._id,
      },
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" })

    // Start the data loading process in the background
    startDataLoadingProcess(user._id, zipCode)

    // Return token and user data
    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        zipCode: user.zipCode,
        shoppingStyle: user.shoppingStyle,
        emailVerified: user.emailVerified,
      },
      verificationCode: process.env.NODE_ENV === "development" ? verificationCode : undefined,
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Start data loading process in the background
const startDataLoadingProcess = async (userId, zipCode) => {
  try {
    // Create a global object to track loading progress for this user
    if (!global.dataLoadingStatus) {
      global.dataLoadingStatus = {}
    }

    global.dataLoadingStatus[userId] = {
      progress: 0,
      message: "Initializing your account...",
      completed: false,
      error: null,
    }

    // Step 1: Fetch products from Walmart (20%)
    global.dataLoadingStatus[userId].message = "Fetching product data..."
    global.dataLoadingStatus[userId].progress = 10

    const products = await apiIntegration.fetchWalmartProducts()

    global.dataLoadingStatus[userId].progress = 20

    // Step 2: Save products to database (40%)
    global.dataLoadingStatus[userId].message = "Saving product data..."
    global.dataLoadingStatus[userId].progress = 30

    await apiIntegration.saveProductsToDatabase(products)

    global.dataLoadingStatus[userId].progress = 40

    // Step 3: Generate historical price data (70%)
    global.dataLoadingStatus[userId].message = "Generating price history..."
    global.dataLoadingStatus[userId].progress = 50

    await generateHistoricalPriceData()

    global.dataLoadingStatus[userId].progress = 70

    // Step 4: Set up user's pantry with default items (90%)
    global.dataLoadingStatus[userId].message = "Setting up your pantry..."
    global.dataLoadingStatus[userId].progress = 80

    await setupUserPantry(userId)

    global.dataLoadingStatus[userId].progress = 90

    // Step 5: Complete setup (100%)
    global.dataLoadingStatus[userId].message = "Setup complete!"
    global.dataLoadingStatus[userId].progress = 100
    global.dataLoadingStatus[userId].completed = true

    console.log(`Data loading completed for user ${userId}`)

    // Clean up after some time
    setTimeout(() => {
      if (global.dataLoadingStatus && global.dataLoadingStatus[userId]) {
        delete global.dataLoadingStatus[userId]
      }
    }, 3600000) // Remove after 1 hour
  } catch (error) {
    console.error(`Error in data loading process for user ${userId}:`, error)
    if (global.dataLoadingStatus && global.dataLoadingStatus[userId]) {
      global.dataLoadingStatus[userId].error = error.message
      global.dataLoadingStatus[userId].completed = true // Mark as completed even on error
    }
  }
}

// Generate historical price data for all products
const generateHistoricalPriceData = async () => {
  try {
    const PantryItem = require("../models/PantryItem")
    const items = await PantryItem.find({})

    console.log(`Generating historical price data for ${items.length} items...`)

    for (const item of items) {
      // Skip if item already has sufficient price history
      if (item.priceHistory && item.priceHistory.length >= 12) {
        continue
      }

      // Get current price as baseline
      const currentPrice = item.currentLowestPrice?.price || 5.99

      // Generate 12 weeks of historical data
      const priceHistory = []
      const now = new Date()

      // Get store ID
      const storeId = item.currentLowestPrice?.storeId

      for (let i = 0; i < 12; i++) {
        // Create a date for each week going back
        const date = new Date(now)
        date.setDate(date.getDate() - i * 7)

        // Generate a price with some random variation
        // More recent prices are closer to current price
        // Older prices have more variation
        const variationFactor = 0.02 + i * 0.005 // Increases with age
        const randomVariation = (Math.random() * 2 - 1) * variationFactor // Between -variation and +variation

        // Add some trends - prices tend to increase over time (so older prices are lower)
        const trendFactor = 0.005 * i

        // Calculate historical price
        let historicalPrice = currentPrice * (1 + randomVariation - trendFactor)

        // Ensure price is positive and has 2 decimal places
        historicalPrice = Math.max(0.01, Number(historicalPrice.toFixed(2)))

        // Add to price history
        priceHistory.push({
          storeId,
          price: historicalPrice,
          date,
        })
      }

      // Add the price history to the item
      item.priceHistory = [...priceHistory, ...item.priceHistory]

      // Update price range
      const prices = item.priceHistory.map((p) => p.price)
      item.priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        period: 12,
      }

      await item.save()
    }

    console.log("Historical price data generation completed")
  } catch (error) {
    console.error("Error generating historical price data:", error)
    throw error
  }
}

// Set up user's pantry with default items
const setupUserPantry = async (userId) => {
  try {
    const User = require("../models/User")
    const PantryItem = require("../models/PantryItem")

    // Get some popular pantry items
    const popularItems = await PantryItem.find({}).sort({ "currentLowestPrice.lastUpdated": -1 }).limit(10)

    // Add items to user's pantry
    const pantryItems = popularItems.map((item) => ({
      itemId: item._id,
      quantity: Math.floor(Math.random() * 3) + 1, // 1-3 items
      unit: item.unit || "item",
      addedAt: new Date(),
    }))

    // Update user
    await User.findByIdAndUpdate(userId, {
      $set: { pantryItems },
    })

    console.log(`Added ${pantryItems.length} default items to user ${userId}'s pantry`)
  } catch (error) {
    console.error("Error setting up user pantry:", error)
    throw error
  }
}

// Endpoint to check data loading status
router.get("/data-loading-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params

    if (!global.dataLoadingStatus || !global.dataLoadingStatus[userId]) {
      return res.status(200).json({
        progress: 100,
        message: "Setup complete!",
        completed: true,
      })
    }

    res.status(200).json({
      progress: global.dataLoadingStatus[userId].progress,
      message: global.dataLoadingStatus[userId].message,
      completed: global.dataLoadingStatus[userId].completed,
      error: global.dataLoadingStatus[userId].error,
    })
  } catch (error) {
    console.error("Error checking data loading status:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Verify email
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body

    // Find verification record
    const verification = await EmailVerification.findOne({ email, code })

    if (!verification) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    // Check if code is expired
    if (verification.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Verification code has expired" })
    }

    // Update user
    const user = await User.findByIdAndUpdate(verification.userId, { emailVerified: true }, { new: true }).select(
      "-password",
    )

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Delete verification record
    await EmailVerification.deleteOne({ _id: verification._id })

    // Create token
    const payload = {
      user: {
        id: user._id,
      },
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.json({
      message: "Email verified successfully",
      token,
      user,
    })
  } catch (error) {
    console.error("Verification error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Resend verification code
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body

    // Find user
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Delete existing verification records
    await EmailVerification.deleteMany({ userId: user._id })

    // Create new verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const emailVerification = new EmailVerification({
      userId: user._id,
      email,
      code,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    })

    await emailVerification.save()

    // Send verification email
    await emailService.sendVerificationEmail(email, code, user.firstName)

    res.json({
      message: "Verification code resent successfully",
      code: process.env.NODE_ENV === "development" ? code : undefined,
    })
  } catch (error) {
    console.error("Resend verification error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// User login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email })
    console.log("User found:", user)

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      console.log("Password mismatch")
      return res.status(400).json({ message: "Invalid credentials" })
    }

    // Check if email is verified
    // if (!user.emailVerified) {
    //   return res.status(400).json({ message: "Please verify your email before logging in" })
    // }

    // Create token
    const payload = {
      user: {
        id: user._id,
      },
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.json({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        zipCode: user.zipCode,
        shoppingStyle: user.shoppingStyle,
        emailVerified: user.emailVerified,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get user profile
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(user)
  } catch (error) {
    console.error("Profile error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update user profile
router.put("/profile", auth, async (req, res) => {
  try {
    const { firstName, lastName, zipCode, shoppingStyle, phoneNumber, preferences } = req.body

    // Build update object
    const updateFields = {}
    if (firstName) updateFields.firstName = firstName
    if (lastName) updateFields.lastName = lastName
    if (firstName && lastName) updateFields.fullName = `${firstName} ${lastName}`
    if (zipCode) updateFields.zipCode = zipCode
    if (shoppingStyle) updateFields.shoppingStyle = shoppingStyle
    if (phoneNumber !== undefined) updateFields.phoneNumber = phoneNumber
    if (preferences) updateFields.preferences = preferences

    // Update user
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updateFields }, { new: true }).select("-password")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(user)
  } catch (error) {
    console.error("Profile update error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Change password
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Find user
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password)

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(newPassword, salt)

    await user.save()

    res.json({ message: "Password updated successfully" })
  } catch (error) {
    console.error("Password change error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Send phone verification code
router.post("/send-phone-verification", auth, async (req, res) => {
  try {
    const { phoneNumber } = req.body

    // Find user
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Delete existing verification records
    await SmsVerification.deleteMany({ userId: user._id })

    // Create new verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const smsVerification = new SmsVerification({
      userId: user._id,
      phoneNumber,
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    })

    await smsVerification.save()

    // Send verification SMS
    await smsService.sendVerificationSms(phoneNumber, code)

    res.json({
      message: "Verification code sent successfully",
      code: process.env.NODE_ENV === "development" ? code : undefined,
    })
  } catch (error) {
    console.error("Send phone verification error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Verify phone number
router.post("/verify-phone", auth, async (req, res) => {
  try {
    const { phoneNumber, code } = req.body

    // Find verification record
    const verification = await SmsVerification.findOne({ phoneNumber, code })

    if (!verification) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    // Check if code is expired
    if (verification.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Verification code has expired" })
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      verification.userId,
      { phoneNumber, phoneVerified: true },
      { new: true },
    ).select("-password")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Delete verification record
    await SmsVerification.deleteOne({ _id: verification._id })

    res.json({
      message: "Phone number verified successfully",
      user,
    })
  } catch (error) {
    console.error("Phone verification error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
