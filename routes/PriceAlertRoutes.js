const express = require("express")
const auth = require("../middleware/auth")
const PriceAlert = require("../models/PriceAlert")
const PantryItem = require("../models/PantryItem")
const router = express.Router()

// Get all price alerts for a user
router.get("/", auth, async (req, res) => {
  try {
    const alerts = await PriceAlert.find({ userId: req.user._id })
      .populate({
        path: "itemId",
        select: "name imageUrl currentLowestPrice",
      })
      .populate({
        path: "storeId",
        select: "name chainName",
      })
      .sort({ createdAt: -1 })

    // Format the alerts for the frontend
    const formattedAlerts = alerts.map((alert) => ({
      id: alert._id,
      itemId: alert.itemId._id,
      itemName: alert.itemId.name,
      imageUrl: alert.itemId.imageUrl,
      targetPrice: alert.targetPrice,
      currentPrice: alert.itemId.currentLowestPrice?.price || alert.currentPrice,
      store: alert.storeId ? alert.storeId.name : "Any Store",
      isActive: alert.isActive,
      createdAt: alert.createdAt,
    }))

    res.json({ alerts: formattedAlerts })
  } catch (error) {
    console.error("Error getting price alerts:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create a new price alert
router.post("/", auth, async (req, res) => {
  try {
    const { itemId, targetPrice, storeId } = req.body

    if (!itemId || !targetPrice) {
      return res.status(400).json({ message: "Item ID and target price are required" })
    }

    // Check if the item exists
    const item = await PantryItem.findById(itemId)
    if (!item) {
      return res.status(404).json({ message: "Item not found" })
    }

    // Check if an alert already exists for this item and user
    const existingAlert = await PriceAlert.findOne({
      userId: req.user._id,
      itemId,
      isActive: true,
    })

    if (existingAlert) {
      // Update the existing alert
      existingAlert.targetPrice = targetPrice
      existingAlert.currentPrice = item.currentLowestPrice?.price || 0
      if (storeId) existingAlert.storeId = storeId
      existingAlert.notificationSent = false
      existingAlert.updatedAt = new Date()

      await existingAlert.save()

      return res.json({
        message: "Price alert updated",
        alert: {
          id: existingAlert._id,
          itemId: existingAlert.itemId,
          itemName: item.name,
          targetPrice: existingAlert.targetPrice,
          currentPrice: existingAlert.currentPrice,
          isActive: existingAlert.isActive,
        },
      })
    }

    // Create a new alert
    const newAlert = new PriceAlert({
      userId: req.user._id,
      itemId,
      targetPrice,
      currentPrice: item.currentLowestPrice?.price || 0,
      storeId: storeId || null,
    })

    await newAlert.save()

    res.status(201).json({
      message: "Price alert created",
      alert: {
        id: newAlert._id,
        itemId: newAlert.itemId,
        itemName: item.name,
        targetPrice: newAlert.targetPrice,
        currentPrice: newAlert.currentPrice,
        isActive: newAlert.isActive,
      },
    })
  } catch (error) {
    console.error("Error creating price alert:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update a price alert
router.patch("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    const { targetPrice, isActive } = req.body

    const alert = await PriceAlert.findOne({
      _id: id,
      userId: req.user._id,
    })

    if (!alert) {
      return res.status(404).json({ message: "Price alert not found" })
    }

    if (targetPrice !== undefined) alert.targetPrice = targetPrice
    if (isActive !== undefined) alert.isActive = isActive

    await alert.save()

    res.json({
      message: "Price alert updated",
      alert: {
        id: alert._id,
        itemId: alert.itemId,
        targetPrice: alert.targetPrice,
        isActive: alert.isActive,
      },
    })
  } catch (error) {
    console.error("Error updating price alert:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete a price alert
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params

    const alert = await PriceAlert.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    })

    if (!alert) {
      return res.status(404).json({ message: "Price alert not found" })
    }

    res.json({ message: "Price alert deleted successfully" })
  } catch (error) {
    console.error("Error deleting price alert:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
