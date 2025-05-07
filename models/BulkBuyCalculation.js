const mongoose = require("mongoose")

const bulkBuyCalculationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PantryItem",
  },
  itemName: {
    type: String,
    required: true,
  },
  pricePerUnit: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
  monthlyUsage: {
    type: Number,
    required: true,
  },
  recommendedQuantity: {
    type: Number,
    required: true,
  },
  savingsPercentage: {
    type: Number,
    required: true,
  },
  savingsAmount: {
    type: Number,
    required: true,
  },
  timeframe: {
    type: Number, // Number of months
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Static method to calculate bulk buy savings
bulkBuyCalculationSchema.statics.calculateSavings = (pricePerUnit, monthlyUsage, timeframe = 3) => {
  // Default to 3 months if not specified
  const totalUnits = monthlyUsage * timeframe

  // Calculate regular price (buying monthly)
  const regularPrice = pricePerUnit * monthlyUsage * timeframe

  // Calculate bulk price with assumed discount
  // Assume bulk discounts: 5% for 2 months, 10% for 3 months, 15% for 6 months
  let bulkDiscount = 0
  if (timeframe >= 6) {
    bulkDiscount = 0.15
  } else if (timeframe >= 3) {
    bulkDiscount = 0.1
  } else if (timeframe >= 2) {
    bulkDiscount = 0.05
  }

  const bulkPrice = regularPrice * (1 - bulkDiscount)

  // Calculate savings
  const savingsAmount = regularPrice - bulkPrice
  const savingsPercentage = (savingsAmount / regularPrice) * 100

  return {
    recommendedQuantity: totalUnits,
    savingsPercentage,
    savingsAmount,
    timeframe,
  }
}

const BulkBuyCalculation = mongoose.model("BulkBuyCalculation", bulkBuyCalculationSchema)

module.exports = BulkBuyCalculation
