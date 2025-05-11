const express = require("express")
const BulkBuyCalculation = require("../models/BulkBuyCalculation")
const PantryItem = require("../models/PantryItem")
const auth = require("../middleware/auth")
const router = express.Router()

// Calculate bulk buy savings
router.post("/calculate", auth, async (req, res) => {
  try {
    const { itemName, pricePerUnit, unit, monthlyUsage, timeframe, bulkQuantity, bulkPrice } = req.body

    if (!itemName || !pricePerUnit || !monthlyUsage) {
      return res.status(400).json({ message: "Item name, price per unit, and monthly usage are required" })
    }

    // Calculate bulk price per unit
    const bulkPricePerUnit = bulkPrice / bulkQuantity

    // Calculate savings per unit
    const savingsPerUnit = pricePerUnit - bulkPricePerUnit

    // Calculate optimal quantity based on monthly usage and shelf life
    const maxQuantity = Math.min(bulkQuantity, monthlyUsage * (timeframe || 3))
    const optimalQuantity = Math.max(bulkQuantity, Math.ceil(monthlyUsage * 3))

    // Calculate total savings
    const savingsAmount = savingsPerUnit * optimalQuantity

    // Calculate savings percentage
    const regularTotalPrice = pricePerUnit * optimalQuantity
    const savingsPercentage = (savingsAmount / regularTotalPrice) * 100

    // Try to find matching pantry item
    let itemId = null
    const matchingItems = await PantryItem.find({ name: { $regex: itemName, $options: "i" } }).limit(1)
    if (matchingItems.length > 0) {
      itemId = matchingItems[0]._id
    }

    // Create calculation record
    const calculation = new BulkBuyCalculation({
      userId: req.user._id,
      itemId,
      itemName,
      pricePerUnit: Number(pricePerUnit),
      unit: unit || "",
      monthlyUsage: Number(monthlyUsage),
      bulkQuantity: Number(bulkQuantity),
      bulkPrice: Number(bulkPrice),
      recommendedQuantity: optimalQuantity,
      savingsPercentage: savingsPercentage,
      savingsAmount: savingsAmount,
      timeframe: timeframe ? Number(timeframe) : 3,
    })

    await calculation.save()

    res.json({
      calculation: {
        id: calculation._id,
        itemName: calculation.itemName,
        pricePerUnit: calculation.pricePerUnit,
        unit: calculation.unit,
        monthlyUsage: calculation.monthlyUsage,
        bulkQuantity: calculation.bulkQuantity,
        bulkPrice: calculation.bulkPrice,
        recommendedQuantity: calculation.recommendedQuantity,
        savingsPercentage: calculation.savingsPercentage,
        savingsAmount: calculation.savingsAmount,
        timeframe: calculation.timeframe,
        message: `Buy ${calculation.recommendedQuantity} to save ${calculation.savingsPercentage.toFixed(1)}% over ${calculation.timeframe} months.`,
      },
    })
  } catch (error) {
    console.error("Error calculating bulk buy savings:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get user's bulk buy calculations
router.get("/history", auth, async (req, res) => {
  try {
    const calculations = await BulkBuyCalculation.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10)

    const formattedCalculations = calculations.map((calc) => ({
      id: calc._id,
      itemName: calc.itemName,
      pricePerUnit: calc.pricePerUnit,
      unit: calc.unit,
      monthlyUsage: calc.monthlyUsage,
      bulkQuantity: calc.bulkQuantity,
      bulkPrice: calc.bulkPrice,
      recommendedQuantity: calc.recommendedQuantity,
      savingsPercentage: calc.savingsPercentage,
      savingsAmount: calc.savingsAmount,
      timeframe: calc.timeframe,
      createdAt: calc.createdAt,
      message: `Buy ${calc.recommendedQuantity} to save ${calc.savingsPercentage.toFixed(1)}% over ${calc.timeframe} months.`,
    }))

    res.json({ calculations: formattedCalculations })
  } catch (error) {
    console.error("Error getting bulk buy history:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete a bulk buy calculation
router.delete("/:id", auth, async (req, res) => {
  try {
    const calculation = await BulkBuyCalculation.findById(req.params.id)

    if (!calculation) {
      return res.status(404).json({ message: "Calculation not found" })
    }

    // Check if the calculation belongs to the user
    if (calculation.userId.toString() !== req.user._id) {
      return res.status(401).json({ message: "Not authorized to delete this calculation" })
    }

    await calculation.remove()

    res.json({ message: "Calculation deleted successfully" })
  } catch (error) {
    console.error("Error deleting bulk buy calculation:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
