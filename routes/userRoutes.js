const express = require("express")
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
const router = express.Router()

// Add email verification endpoints
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(400).json({ message: "Email and verification code are required" })
    }

    // Find user by email
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Find verification record
    const verification = await EmailVerification.findOne({
      userId: user._id,
      email,
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
    const user = await User.findOne({ email })
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
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Send new verification email
    const result = await emailService.sendVerificationEmail(user._id, email)

    if (!result.success) {
      throw new Error(result.error || "Failed to send verification email")
    }

    // For development, include the verification code in the response
    const responseData = { message: "Verification email sent" }
    if (process.env.NODE_ENV === "development") {
      responseData.code = result.code
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
    const smsService = require("../services/smsService")
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
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
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
    })
    await dataFetchStatus.save()

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(user._id, email)

    // if (!emailResult.success) {
    //   console.error("Failed to send verification email:", emailResult.error)
    // }

    // Start the background process to fetch stores and products
    // This will run asynchronously and not block the response
    fetchDataInBackground(user._id, zipCode, shoppingStyle)

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
    if (process.env.NODE_ENV === "development" && emailResult.code) {
      responseData.verificationCode = emailResult.code
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

    // Fetch nearby stores based on zip code
    console.log(`Fetching stores for zip code ${zipCode}...`)
    const stores = await storeService.getNearbyStores(zipCode)
    console.log(`Found ${stores.length} stores for zip code ${zipCode}`)

    // Fetch product data from Walmart
    console.log("Fetching product data from Walmart...")
    const products = await apiIntegration.fetchAllStoreProducts(zipCode)

    // Save products to database in a batch
    if (products.length > 0) {
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

    // Get pantry items
    const pantryItems = await PantryItem.find({ category: "Pantry" }).limit(10)
    const produceItems = await PantryItem.find({ category: "Produce" }).limit(10)

    // Fetch prices for these items from the top stores
    if (stores.length >= 3) {
      const topStores = stores.slice(0, 3)

      console.log(
        `Fetching prices for ${pantryItems.length} pantry items and ${produceItems.length} produce items from ${topStores.length} stores...`,
      )

      // Batch price updates
      const allPriceUpdates = []

      for (const store of topStores) {
        // Fetch prices for pantry items
        const pantryPrices = await priceService.fetchStorePrices(store._id, pantryItems)
        allPriceUpdates.push(...pantryPrices)

        // Fetch prices for produce items
        const producePrices = await priceService.fetchStorePrices(store._id, produceItems)
        allPriceUpdates.push(...producePrices)
      }

      // Update all price history in one batch
      if (allPriceUpdates.length > 0) {
        await priceService.updatePriceHistory(allPriceUpdates)
        console.log(`Updated ${allPriceUpdates.length} price points in batch`)
      }
    }

    // Update the data fetch status to completed
    await DataFetchStatus.findOneAndUpdate({ userId }, { status: "completed", completedAt: new Date() })

    console.log(`Background data fetch completed for user ${userId}`)
  } catch (error) {
    console.error(`Error in background data fetch for user ${userId}:`, error)

    // Update status to failed
    await DataFetchStatus.findOneAndUpdate(
      { userId },
      {
        status: "failed",
        completedAt: new Date(),
        error: error.message,
      },
    )
  }
}

// New endpoint to check data fetch status
router.get("/data-fetch-status", auth, async (req, res) => {
  try {
    const status = await DataFetchStatus.findOne({ userId: req.user._id })

    if (!status) {
      return res.status(404).json({ message: "Status not found" })
    }

    res.json({ status: status.status })
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
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Find the data fetch status for this user
    const status = await DataFetchStatus.findOne({ userId: user._id })

    if (!status) {
      // If no status exists, we'll assume it's completed
      return res.json({ status: "completed" })
    }

    res.json({ status: status.status })
  } catch (error) {
    console.error("Error getting data fetch status by email:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Login user - simplified to only return user data and token
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user by credentials
    const user = await User.findByCredentials(email, password)

    // Check if email is verified
    // if (!user.emailVerified) {
    //   // Send a new verification email
    //   await emailService.sendVerificationEmail(user._id, email)

    //   return res.status(403).json({
    //     message: "Email not verified. A new verification code has been sent to your email.",
    //     emailVerificationRequired: true,
    //   })
    // }

    // Generate auth token
    const token = await user.generateAuthToken()

    // Check if data fetch is complete
    const dataFetchStatus = await DataFetchStatus.findOne({ userId: user._id })
    const fetchStatus = dataFetchStatus ? dataFetchStatus.status : "unknown"

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
        // emailVerified: user.emailVerified,
      },
      token,
      dataFetchStatus: fetcStatus,
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
