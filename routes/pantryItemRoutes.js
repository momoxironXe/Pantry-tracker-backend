const express = require("express")
const PantryItem = require("../models/PantryItem")
const auth = require("../middleware/auth")
const priceService = require("../services/priceService")
const router = express.Router()

// Get all pantry items
router.get("/", async (req, res) => {
  try {
    const { category, type, isHealthy, isValuePick, isBulkOption } = req.query

    // Build query
    const query = {}

    if (category) query.category = category
    if (type) query.type = type
    if (isHealthy === "true") query.isHealthy = true
    if (isValuePick === "true") query.isValuePick = true
    if (isBulkOption === "true") query.isBulkOption = true

    const items = await PantryItem.find(query)

    res.json(items)
  } catch (error) {
    console.error("Error getting pantry items:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get top pantry staples
router.get("/top-pantry", auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const { zipCode, shoppingType } = req.user

    const items = await priceService.getTopPantryItems(zipCode, shoppingType, "Pantry", Number.parseInt(limit))

    res.json(items)
  } catch (error) {
    console.error("Error getting top pantry items:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get top produce items
router.get("/top-produce", auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const { zipCode, shoppingType } = req.user

    const items = await priceService.getTopPantryItems(zipCode, shoppingType, "Produce", Number.parseInt(limit))

    res.json(items)
  } catch (error) {
    console.error("Error getting top produce items:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get buy alerts
router.get("/buy-alerts", auth, async (req, res) => {
  try {
    const { limit = 4 } = req.query
    const { zipCode, shoppingType } = req.user

    const alerts = await priceService.getBuyAlerts(zipCode, shoppingType, Number.parseInt(limit))

    res.json(alerts)
  } catch (error) {
    console.error("Error getting buy alerts:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get a single pantry item by ID
router.get("/:id", async (req, res) => {
  try {
    const item = await PantryItem.findById(req.params.id)

    if (!item) {
      return res.status(404).json({ message: "Pantry item not found" })
    }

    res.json(item)
  } catch (error) {
    console.error("Error getting pantry item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create a new pantry item (admin only)
router.post("/", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const item = new PantryItem(req.body)
    await item.save()

    res.status(201).json(item)
  } catch (error) {
    console.error("Error creating pantry item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update a pantry item (admin only)
router.patch("/:id", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const updates = req.body
    const allowedUpdates = [
      "name",
      "description",
      "category",
      "type",
      "size",
      "unit",
      "imageUrl",
      "isHealthy",
      "isValuePick",
      "isBulkOption",
      "isFeatured",
    ]

    const isValidOperation = Object.keys(updates).every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
      return res.status(400).json({ message: "Invalid updates" })
    }

    const item = await PantryItem.findById(req.params.id)

    if (!item) {
      return res.status(404).json({ message: "Pantry item not found" })
    }

    // Apply updates
    allowedUpdates.forEach((update) => {
      if (updates[update] !== undefined) {
        item[update] = updates[update]
      }
    })

    await item.save()

    res.json(item)
  } catch (error) {
    console.error("Error updating pantry item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete a pantry item (admin only)
router.delete("/:id", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const item = await PantryItem.findByIdAndDelete(req.params.id)

    if (!item) {
      return res.status(404).json({ message: "Pantry item not found" })
    }

    res.json({ message: "Pantry item deleted successfully" })
  } catch (error) {
    console.error("Error deleting pantry item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
