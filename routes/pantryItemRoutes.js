const express = require("express")
const PantryItem = require("../models/PantryItem")
const auth = require("../middleware/auth")
const priceService = require("../services/priceService")
const router = express.Router()
const User = require("../models/User")

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

// Add endpoint to get user's pantry items
router.get("/my-pantry", auth, async (req, res) => {
  try {
    // Get user's pantry items with populated item details
    const user = await User.findById(req.user._id).populate({
      path: "pantryItems.itemId",
      model: "PantryItem",
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Format the pantry items
    const pantryItems = user.pantryItems
      .map((item) => {
        const product = item.itemId

        if (!product) {
          return null
        }

        return {
          id: product._id,
          name: product.name,
          description: product.description,
          category: product.category,
          type: product.type,
          size: product.size,
          unit: product.unit,
          imageUrl: product.imageUrl,
          quantity: item.quantity,
          monthlyUsage: item.monthlyUsage || 1,
          addedAt: item.addedAt,
          lowestPrice: {
            price: product.currentLowestPrice?.price || 0,
            store: product.currentLowestPrice?.storeName || "Unknown Store",
          },
          priceTrend: product.priceTrend || {},
          priceAlerts: product.priceAlerts || {},
        }
      })
      .filter(Boolean)

    res.json({ pantryItems })
  } catch (error) {
    console.error("Error getting user's pantry:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add endpoint to get user's pantry items with price trends
router.get("/my-pantry/trends", auth, async (req, res) => {
  try {
    const pantryTrends = await priceService.getUserPantryWithTrends(req.user._id)

    res.json({ pantryTrends })
  } catch (error) {
    console.error("Error getting user's pantry trends:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add endpoint to add item to user's pantry
router.post("/my-pantry", auth, async (req, res) => {
  try {
    const { itemId, name, category, type, size, unit, quantity, monthlyUsage } = req.body

    let item

    // If itemId is provided, use existing item
    if (itemId) {
      item = await PantryItem.findById(itemId)

      if (!item) {
        return res.status(404).json({ message: "Item not found" })
      }
    } else if (name) {
      // If name is provided, create a new item
      item = new PantryItem({
        name,
        category: category || "Pantry",
        type: type || "Store Brand",
        size: size || "Standard",
        unit: unit || "each",
        description: `${name} - ${size || "Standard Size"}`,
        imageUrl: `/placeholder.svg?height=200&width=200&query=grocery+${name.replace(/\s+/g, "+")}`,
        currentLowestPrice: {
          price: (Math.random() * 10 + 1).toFixed(2),
          storeName: "Various Stores",
        },
        isHealthy: req.user.shoppingStyle === "health",
        isValuePick: req.user.shoppingStyle === "value",
        isBulkOption: req.user.shoppingStyle === "bulk",
      })

      await item.save()
    } else {
      return res.status(400).json({ message: "Either itemId or name is required" })
    }

    // Check if item is already in user's pantry
    const existingItem = req.user.pantryItems.find(
      (pantryItem) => pantryItem.itemId && pantryItem.itemId.toString() === item._id.toString(),
    )

    if (existingItem) {
      // Update existing item
      existingItem.quantity = quantity || existingItem.quantity
      existingItem.monthlyUsage = monthlyUsage || existingItem.monthlyUsage || 1
    } else {
      // Add new item to pantry
      req.user.pantryItems.push({
        itemId: item._id,
        quantity: quantity || 1,
        monthlyUsage: monthlyUsage || 1,
        addedAt: new Date(),
      })
    }

    await req.user.save()

    res.json({
      message: "Item added to your pantry",
      pantryItems: req.user.pantryItems,
      item: {
        id: item._id,
        name: item.name,
        category: item.category,
        type: item.type,
        size: item.size,
        unit: item.unit,
        quantity: quantity || 1,
        monthlyUsage: monthlyUsage || 1,
      },
    })
  } catch (error) {
    console.error("Error adding to pantry:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add endpoint to update pantry item
router.patch("/my-pantry/:itemId", auth, async (req, res) => {
  try {
    const { itemId } = req.params
    const { quantity, monthlyUsage } = req.body

    // Find the item in user's pantry
    const pantryItem = req.user.pantryItems.find((item) => item.itemId.toString() === itemId)

    if (!pantryItem) {
      return res.status(404).json({ message: "Item not found in your pantry" })
    }

    // Update fields
    if (quantity !== undefined) pantryItem.quantity = quantity
    if (monthlyUsage !== undefined) pantryItem.monthlyUsage = monthlyUsage

    await req.user.save()

    res.json({
      message: "Pantry item updated",
      pantryItem,
    })
  } catch (error) {
    console.error("Error updating pantry item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add endpoint to remove item from user's pantry
router.delete("/my-pantry/:itemId", auth, async (req, res) => {
  try {
    const { itemId } = req.params

    // Remove the item from pantry
    req.user.pantryItems = req.user.pantryItems.filter((item) => item.itemId.toString() !== itemId)

    await req.user.save()

    res.json({
      message: "Item removed from your pantry",
      pantryItems: req.user.pantryItems,
    })
  } catch (error) {
    console.error("Error removing from pantry:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add endpoint to get price trends for an item
router.get("/price-trends/:id", auth, async (req, res) => {
  try {
    const { id } = req.params

    const trends = await priceService.getPriceTrends([id])

    if (!trends || trends.length === 0) {
      return res.status(404).json({ message: "Price trends not found for this item" })
    }

    res.json({ trends: trends[0] })
  } catch (error) {
    console.error("Error getting price trends:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get a single pantry item by ID - MOVED AFTER SPECIFIC ROUTES
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
