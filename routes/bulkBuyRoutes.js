const express = require("express")
const BulkBuyCalculation = require("../models/BulkBuyCalculation")
const PantryItem = require("../models/PantryItem")
const auth = require("../middleware/auth")
const router = express.Router()

// Calculate bulk buy savings
router.post("/calculate", auth, async (req, res) => {
  try {
    const { itemName, pricePerUnit, unit, monthlyUsage, timeframe } = req.body

    if (!itemName || !pricePerUnit || !monthlyUsage) {
      return res.status(400).json({ message: "Item name, price per unit, and monthly usage are required" })
    }

    // Calculate savings
    const calculationResult = BulkBuyCalculation.calculateSavings(
      Number(pricePerUnit),
      Number(monthlyUsage),
      timeframe ? Number(timeframe) : 3,
    )

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
      recommendedQuantity: calculationResult.recommendedQuantity,
      savingsPercentage: calculationResult.savingsPercentage,
      savingsAmount: calculationResult.savingsAmount,
      timeframe: calculationResult.timeframe,
    })

    await calculation.save()

    res.json({
      calculation: {
        id: calculation._id,
        itemName: calculation.itemName,
        pricePerUnit: calculation.pricePerUnit,
        unit: calculation.unit,
        monthlyUsage: calculation.monthlyUsage,
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

module.exports = router
