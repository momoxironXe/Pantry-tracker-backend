const express = require("express")
const User = require("../models/User")
const DataFetchStatus = require("../models/DataFetchStatus")
const auth = require("../middleware/auth")
const storeService = require("../services/storeService")
const priceService = require("../services/priceService")
const apiIntegration = require("../services/apiIntegration")
const PantryItem = require("../models/PantryItem")
const EmailVerification = require("../models/EmailVerification")
const SmsVerification = require("../models/SmsVerification")
const emailService = require("../services/emailService")
const smsService = require("../services/smsService")
const mongoose = require("mongoose")
const router = express.Router()

// Add email verification endpoints
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(400).json({ message: "Email and verification code are required" })
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Find verification record
    const verification = await EmailVerification.findOne({
      email: email.toLowerCase(),
      verificationCode: code,
    })

    if (!verification) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    if (verification.isExpired()) {
      return res.status(400).json({ message: "Verification code has expired" })
    }

    // Mark as verified
    verification.verified = true
    await verification.save()

    // Update user
    user.emailVerified = true
    await user.save()

    // Generate a token for the frontend to use
    const token = await user.generateAuthToken()

    // Create or update data fetch status
    let dataFetchStatus = await DataFetchStatus.findOne({ userId: user._id })

    if (!dataFetchStatus) {
      dataFetchStatus = new DataFetchStatus({
        userId: user._id,
        status: "pending",
        progress: 0,
        message: "Initializing your account...",
        startedAt: new Date(),
      })
      await dataFetchStatus.save()
    } else {
      // Reset existing status
      dataFetchStatus.status = "pending"
      dataFetchStatus.progress = 0
      dataFetchStatus.message = "Initializing your account..."
      dataFetchStatus.startedAt = new Date()
      dataFetchStatus.completedAt = undefined
      dataFetchStatus.error = undefined
      await dataFetchStatus.save()
    }

    // Start the background data fetch process in a non-blocking way
    setImmediate(() => {
      fetchDataInBackground(user._id, user.zipCode, user.shoppingStyle).catch((err) =>
        console.error(`Error in background data fetch for user ${user._id}:`, err),
      )
    })

    res.json({
      message: "Email verified successfully",
      token,
      user: {
        _id: user._id,
        email: user.email,
        emailVerified: true,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        zipCode: user.zipCode,
        shoppingStyle: user.shoppingStyle,
      },
    })
  } catch (error) {
    console.error("Error verifying email:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Check if email is verified
router.post("/check-email-verification", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ verified: user.emailVerified })
  } catch (error) {
    console.error("Error checking email verification:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Delete any existing verification records for this email
    await EmailVerification.deleteMany({ email: email.toLowerCase() })

    // Create new verification record
    const emailVerification = new EmailVerification({
      userId: user._id,
      email: email.toLowerCase(),
      verificationCode,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    })

    await emailVerification.save()

    // Send verification email
    const result = await emailService.sendVerificationEmail(email, verificationCode, user.firstName)

    if (!result.success) {
      console.error("Failed to send verification email:", result.error)
    }

    // For development, include the verification code in the response
    const responseData = { message: "Verification email sent" }
    if (process.env.NODE_ENV === "development") {
      responseData.code = verificationCode
    }

    res.json(responseData)
  } catch (error) {
    console.error("Error resending verification:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add phone verification endpoints
router.post("/verify-phone", auth, async (req, res) => {
  try {
    const { phoneNumber, code } = req.body

    if (!phoneNumber || !code) {
      return res.status(400).json({ message: "Phone number and verification code are required" })
    }

    // Find verification record
    const verification = await SmsVerification.findOne({
      userId: req.user._id,
      phoneNumber,
      verificationCode: code,
      verified: false,
    })

    if (!verification) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    if (verification.isExpired()) {
      return res.status(400).json({ message: "Verification code has expired" })
    }

    // Mark as verified
    verification.verified = true
    await verification.save()

    // Update user
    req.user.phoneNumber = phoneNumber
    req.user.phoneVerified = true
    await req.user.save()

    res.json({ message: "Phone number verified successfully" })
  } catch (error) {
    console.error("Error verifying phone:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

router.post("/send-phone-verification", auth, async (req, res) => {
  try {
    const { phoneNumber } = req.body

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" })
    }

    // Send verification SMS
    const sent = await smsService.sendVerificationSms(req.user._id, phoneNumber)

    if (!sent) {
      throw new Error("Failed to send verification SMS")
    }

    res.json({ message: "Verification SMS sent" })
  } catch (error) {
    console.error("Error sending phone verification:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, zipCode, shoppingStyle, phoneNumber } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      zipCode,
      shoppingStyle: shoppingStyle || "budget",
      phoneNumber: phoneNumber || undefined,
      emailVerified: false,
    })

    // Save user
    await user.save()

    // Generate auth token
    const token = await user.generateAuthToken()

    // Create a data fetch status record
    const dataFetchStatus = new DataFetchStatus({
      userId: user._id,
      status: "pending",
      progress: 0,
      message: "Account created. Waiting for email verification...",
    })
    await dataFetchStatus.save()

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Create verification record
    const emailVerification = new EmailVerification({
      userId: user._id,
      email: email.toLowerCase(),
      verificationCode,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    })

    await emailVerification.save()

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(email, verificationCode, firstName)

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error)
    }

    // Response object
    const responseData = {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        zipCode: user.zipCode,
        shoppingStyle: user.shoppingStyle,
        emailVerified: user.emailVerified,
      },
      token,
      dataFetchStatus: "pending", // Let the frontend know data fetching is in progress
      emailVerificationRequired: true,
      emailSent: emailResult.success,
    }

    // For development, include the verification code in the response
    if (process.env.NODE_ENV === "development") {
      responseData.verificationCode = verificationCode
    }

    // Respond immediately with user data and token
    res.status(201).json(responseData)
  } catch (error) {
    console.error("Error registering user:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Background function to fetch data
async function fetchDataInBackground(userId, zipCode, shoppingStyle) {
  try {
    console.log(`Starting background data fetch for user ${userId}...`)

    // Update status to in progress
    await DataFetchStatus.updateProgress(userId, 5, "Starting data fetch process...")

    // Step 1: Fetch nearby stores based on zip code (20%)
    await DataFetchStatus.updateProgress(userId, 10, "Fetching nearby stores...")

    console.log(`Fetching stores for zip code ${zipCode}...`)
    const stores = await storeService.getNearbyStores(zipCode)
    console.log(`Found ${stores.length} stores for zip code ${zipCode}`)

    await DataFetchStatus.updateProgress(userId, 20, "Stores data fetched successfully")

    // Step 2: Fetch product data from Walmart (40%)
    await DataFetchStatus.updateProgress(userId, 25, "Fetching product data...")

    console.log("Fetching product data from Walmart...")
    const products = await apiIntegration.fetchAllStoreProducts(zipCode)

    await DataFetchStatus.updateProgress(userId, 40, "Product data fetched successfully")

    // Step 3: Save products to database (60%)
    await DataFetchStatus.updateProgress(userId, 45, "Saving products to database...")

    // Save products to database in a batch
    if (products && products.length > 0) {
      await apiIntegration.saveProductsToDatabase(products)
      console.log(`Saved ${products.length} products to database`)
    } else {
      console.log("No products fetched from APIs, checking for existing products...")

      // Check if we have pantry items in the database
      const pantryItemCount = await PantryItem.countDocuments()
      console.log(`Found ${pantryItemCount} existing pantry items in database`)

      if (pantryItemCount === 0) {
        // Update status to failed
        await DataFetchStatus.findOneAndUpdate(
          { userId },
          {
            status: "failed",
            completedAt: new Date(),
            error: "Unable to fetch product data and no existing products in database.",
          },
        )
        console.error("Data fetch failed: No products available")
        return
      }
    }

    await DataFetchStatus.updateProgress(userId, 60, "Products saved to database")

    // Step 4: Generate historical price data (80%)
    await DataFetchStatus.updateProgress(userId, 65, "Generating historical price data...")

    await generateHistoricalPriceData()

    await DataFetchStatus.updateProgress(userId, 80, "Historical price data generated")

    // Step 5: Set up user's pantry with default items (90%)
    await DataFetchStatus.updateProgress(userId, 85, "Setting up your pantry...")

    await setupUserPantry(userId)

    await DataFetchStatus.updateProgress(userId, 90, "Pantry setup complete")

    // Get pantry items
    const pantryItems = await PantryItem.find({ category: "Pantry" }).limit(10)
    const produceItems = await PantryItem.find({ category: "Produce" }).limit(10)

    // Fetch prices for these items from the top stores
    if (stores && stores.length >= 3) {
      const topStores = stores.slice(0, 3)

      console.log(
        `Fetching prices for ${pantryItems.length} pantry items and ${produceItems.length} produce items from ${topStores.length} stores...`,
      )

      // Batch price updates
      const allPriceUpdates = []

      for (const store of topStores) {
        try {
          // Fetch prices for pantry items
          const pantryPrices = await priceService.fetchStorePrices(store._id, pantryItems)
          if (pantryPrices && Array.isArray(pantryPrices)) {
            allPriceUpdates.push(...pantryPrices)
          }

          // Fetch prices for produce items
          const producePrices = await priceService.fetchStorePrices(store._id, produceItems)
          if (producePrices && Array.isArray(producePrices)) {
            allPriceUpdates.push(...producePrices)
          }
        } catch (storeError) {
          console.error(`Error fetching prices for store ${store._id}:`, storeError)
          // Continue with other stores
        }
      }

      // Update all price history in one batch
      if (allPriceUpdates.length > 0) {
        await priceService.updatePriceHistory(allPriceUpdates)
        console.log(`Updated ${allPriceUpdates.length} price points in batch`)
      }
    }

    // Update the data fetch status to completed
    await DataFetchStatus.updateProgress(userId, 100, "Setup complete! You can now sign in.")

    console.log(`Background data fetch completed for user ${userId}`)
  } catch (error) {
    console.error(`Error in background data fetch for user ${userId}:`, error)

    // Update status to failed
    await DataFetchStatus.findOneAndUpdate(
      { userId },
      {
        status: "failed",
        completedAt: new Date(),
        error: error.message || "An unknown error occurred",
      },
    )
  }
}

// Generate historical price data for all products
async function generateHistoricalPriceData() {
  try {
    const items = await PantryItem.find({}).limit(100) // Limit to 100 items for performance

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
      const storeId = item.currentLowestPrice?.storeId || new mongoose.Types.ObjectId()

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
      item.priceHistory = [...priceHistory, ...(item.priceHistory || [])]

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
async function setupUserPantry(userId) {
  try {
    // Get some popular pantry items
    const popularItems = await PantryItem.find({}).limit(10)

    // Add items to user's pantry
    const pantryItems = popularItems.map((item) => ({
      itemId: item._id,
      quantity: Math.floor(Math.random() * 3) + 1, // 1-3 items
      monthlyUsage: 1,
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

// New endpoint to check data fetch status
router.get("/data-fetch-status", auth, async (req, res) => {
  try {
    const status = await DataFetchStatus.findOne({ userId: req.user._id })

    if (!status) {
      return res.status(404).json({ message: "Status not found" })
    }

    res.json({
      status: status.status,
      progress: status.progress,
      message: status.message,
      error: status.error,
    })
  } catch (error) {
    console.error("Error getting data fetch status:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add this new endpoint to check data fetch status by email
router.post("/data-fetch-status-by-email", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    // Find the user by email
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Find the data fetch status for this user
    const status = await DataFetchStatus.findOne({ userId: user._id })

    if (!status) {
      // If no status exists, we'll assume it's completed
      return res.json({
        status: "completed",
        progress: 100,
        message: "Setup complete!",
      })
    }

    res.json({
      status: status.status,
      progress: status.progress,
      message: status.message,
      error: status.error,
    })
  } catch (error) {
    console.error("Error getting data fetch status by email:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get data fetch status by user ID
router.get("/data-fetch-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" })
    }

    const status = await DataFetchStatus.findOne({ userId })

    if (!status) {
      return res.json({
        status: "completed",
        progress: 100,
        message: "Setup complete!",
      })
    }

    res.json({
      status: status.status,
      progress: status.progress,
      message: status.message,
      error: status.error,
    })
  } catch (error) {
    console.error("Error getting data fetch status by user ID:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Login user - simplified to only return user data and token
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user by credentials
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(400).json({ message: "Invalid login credentials" })
    }

    // Check password
    const isMatch = await user.comparePassword(password)

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid login credentials" })
    }

    // Check if email is verified
    if (!user.emailVerified) {
      // Generate new verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

      // Delete any existing verification records for this email
      await EmailVerification.deleteMany({ email: email.toLowerCase() })

      // Create new verification record
      const emailVerification = new EmailVerification({
        userId: user._id,
        email: email.toLowerCase(),
        verificationCode,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      })

      await emailVerification.save()

      // Send a new verification email
      await emailService.sendVerificationEmail(email, verificationCode, user.firstName)

      return res.status(403).json({
        message: "Email not verified. A new verification code has been sent to your email.",
        emailVerificationRequired: true,
        verificationCode: process.env.NODE_ENV === "development" ? verificationCode : undefined,
      })
    }

    // Generate auth token
    const token = await user.generateAuthToken()

    // Check if data fetch is complete
    const dataFetchStatus = await DataFetchStatus.findOne({ userId: user._id })
    const fetchStatus = dataFetchStatus ? dataFetchStatus.status : "completed"
    const fetchProgress = dataFetchStatus ? dataFetchStatus.progress : 100
    const fetchMessage = dataFetchStatus ? dataFetchStatus.message : "Setup complete!"

    // Return only user data and token
    res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        zipCode: user.zipCode,
        shoppingStyle: user.shoppingStyle,
        emailVerified: user.emailVerified,
      },
      token,
      dataFetchStatus: fetchStatus,
      dataFetchProgress: fetchProgress,
      dataFetchMessage: fetchMessage,
    })
  } catch (error) {
    console.error("Error logging in:", error)
    res.status(400).json({ message: "Invalid login credentials" })
  }
})

// Logout user
router.post("/logout", auth, async (req, res) => {
  try {
    // Remove the current token
    req.user.tokens = req.user.tokens.filter((token) => token.token !== req.token)
    await req.user.save()

    res.json({ message: "Logged out successfully" })
  } catch (error) {
    console.error("Error logging out:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get user profile
router.get("/profile", auth, async (req, res) => {
  try {
    res.json(req.user)
  } catch (error) {
    console.error("Error getting profile:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update user profile
router.patch("/profile", auth, async (req, res) => {
  try {
    const updates = req.body
    const allowedUpdates = ["firstName", "lastName", "zipCode", "shoppingType", "preferences"]
    const isValidOperation = Object.keys(updates).every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
      return res.status(400).json({ message: "Invalid updates" })
    }

    // Check if zip code is being updated
    const zipCodeChanged = updates.zipCode && updates.zipCode !== req.user.zipCode

    // Apply updates
    allowedUpdates.forEach((update) => {
      if (updates[update] !== undefined) {
        req.user[update] = updates[update]
      }
    })

    await req.user.save()

    // If zip code changed, fetch new stores and product data
    if (zipCodeChanged) {
      // Create a new data fetch status record
      const dataFetchStatus = new DataFetchStatus({
        userId: req.user._id,
        status: "pending",
      })
      await dataFetchStatus.save()

      // Start background fetch
      fetchDataInBackground(req.user._id, updates.zipCode, req.user.shoppingType)
    }

    res.json({
      user: req.user,
      dataFetchStatus: zipCodeChanged ? "pending" : "completed",
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Refresh product data
router.post("/refresh-data", auth, async (req, res) => {
  try {
    const { zipCode, shoppingType } = req.user

    // Create a new data fetch status record
    const dataFetchStatus = new DataFetchStatus({
      userId: req.user._id,
      status: "pending",
    })
    await dataFetchStatus.save()

    // Start background fetch
    fetchDataInBackground(req.user._id, zipCode, shoppingType)

    res.json({
      message: "Product data refresh started",
      dataFetchStatus: "pending",
    })
  } catch (error) {
    console.error("Error starting data refresh:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
