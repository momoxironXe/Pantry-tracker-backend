const express = require("express")
const Store = require("../models/Store")
const auth = require("../middleware/auth")
const storeService = require("../services/storeService")
const router = express.Router()

// Get stores by zip code
router.get("/by-zip/:zipCode", async (req, res) => {
  try {
    const { zipCode } = req.params

    const stores = await storeService.getStoresByZipCode(zipCode)

    res.json(stores)
  } catch (error) {
    console.error("Error getting stores by zip code:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get stores for authenticated user
router.get("/user-stores", auth, async (req, res) => {
  try {
    const { zipCode, shoppingType } = req.user

    const stores = await storeService.getStoresByUserPreference(zipCode, shoppingType)

    res.json(stores)
  } catch (error) {
    console.error("Error getting user stores:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get a single store by ID
router.get("/:id", async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)

    if (!store) {
      return res.status(404).json({ message: "Store not found" })
    }

    res.json(store)
  } catch (error) {
    console.error("Error getting store:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add store to user's preferred stores
router.post("/preferred/:storeId", auth, async (req, res) => {
  try {
    const { storeId } = req.params

    // Check if store exists
    const store = await Store.findById(storeId)
    if (!store) {
      return res.status(404).json({ message: "Store not found" })
    }

    // Check if store is already in preferred stores
    const isAlreadyPreferred = req.user.preferences.preferredStores.some((id) => id.toString() === storeId)

    if (!isAlreadyPreferred) {
      req.user.preferences.preferredStores.push(storeId)
      await req.user.save()
    }

    res.json(req.user.preferences.preferredStores)
  } catch (error) {
    console.error("Error adding preferred store:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Remove store from user's preferred stores
router.delete("/preferred/:storeId", auth, async (req, res) => {
  try {
    const { storeId } = req.params

    // Remove store from preferred stores
    req.user.preferences.preferredStores = req.user.preferences.preferredStores.filter(
      (id) => id.toString() !== storeId,
    )

    await req.user.save()

    res.json(req.user.preferences.preferredStores)
  } catch (error) {
    console.error("Error removing preferred store:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create a new store (admin only)
router.post("/", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const store = new Store(req.body)
    await store.save()

    res.status(201).json(store)
  } catch (error) {
    console.error("Error creating store:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update a store (admin only)
router.patch("/:id", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const updates = req.body
    const allowedUpdates = [
      "name",
      "address",
      "chainName",
      "storeType",
      "phone",
      "website",
      "hours",
      "isActive",
      "apiSupport",
    ]

    const isValidOperation = Object.keys(updates).every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
      return res.status(400).json({ message: "Invalid updates" })
    }

    const store = await Store.findById(req.params.id)

    if (!store) {
      return res.status(404).json({ message: "Store not found" })
    }

    // Apply updates
    allowedUpdates.forEach((update) => {
      if (updates[update] !== undefined) {
        store[update] = updates[update]
      }
    })

    await store.save()

    res.json(store)
  } catch (error) {
    console.error("Error updating store:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
