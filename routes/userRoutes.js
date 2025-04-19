const express = require("express")
const User = require("../models/User")
const DataFetchStatus = require("../models/DataFetchStatus")
const auth = require("../middleware/auth")
const storeService = require("../services/storeService")
const priceService = require("../services/priceService")
const apiIntegration = require("../services/apiIntegration")
const PantryItem = require("../models/PantryItem")
const router = express.Router()

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, zipCode, shoppingStyle } = req.body

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
      shoppingStyle: shoppingStyle,
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

    // Start the background process to fetch stores and products
    // This will run asynchronously and not block the response
    fetchDataInBackground(user._id, zipCode, shoppingStyle)

    // Respond immediately with user data and token
    res.status(201).json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        zipCode: user.zipCode,
        shoppingStyle: user.shoppingStyle,
      },
      token,
      dataFetchStatus: "pending", // Let the frontend know data fetching is in progress
    })
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
      },
      token,
      dataFetchStatus: fetchStatus,
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
