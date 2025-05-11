const mongoose = require("mongoose")

const BulkBuyCalculationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PantryItem",
      default: null,
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
      default: "",
    },
    monthlyUsage: {
      type: Number,
      required: true,
    },
    bulkQuantity: {
      type: Number,
      required: true,
    },
    bulkPrice: {
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
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
  },
)

// Static method to calculate savings
BulkBuyCalculationSchema.statics.calculateSavings = (pricePerUnit, monthlyUsage, timeframe = 3) => {
  // Calculate recommended quantity (at least 3 months supply)
  const recommendedQuantity = Math.ceil(monthlyUsage * 3)

  // Assume bulk discount of 15-25% for calculation
  const discountPercentage = Math.random() * 10 + 15 // 15-25%
  const bulkPricePerUnit = pricePerUnit * (1 - discountPercentage / 100)

  // Calculate savings
  const savingsPerUnit = pricePerUnit - bulkPricePerUnit
  const savingsAmount = savingsPerUnit * recommendedQuantity
  const savingsPercentage = (savingsAmount / (pricePerUnit * recommendedQuantity)) * 100

  return {
    recommendedQuantity,
    savingsPercentage,
    savingsAmount,
    timeframe,
  }
}

module.exports = mongoose.model("BulkBuyCalculation", BulkBuyCalculationSchema)
