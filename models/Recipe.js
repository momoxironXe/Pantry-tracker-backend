const mongoose = require("mongoose")

const recipeIngredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    trim: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PantryItem",
  },
  // For ingredients that don't match exactly to a pantry item
  alternativeItems: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PantryItem",
    },
  ],
})

const recipePriceHistorySchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  // Store the individual ingredient prices at this point in time
  ingredientPrices: [
    {
      ingredientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PantryItem",
      },
      price: Number,
      store: String,
    },
  ],
})

const recipeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  servings: {
    type: Number,
    default: 4,
  },
  ingredients: [recipeIngredientSchema],
  instructions: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  tags: [
    {
      type: String,
      trim: true,
    },
  ],
  priceHistory: [recipePriceHistorySchema],
  currentPrice: {
    totalPrice: Number,
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    percentChange: {
      weekly: Number,
      monthly: Number,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Update the updatedAt field before saving
recipeSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

// Method to calculate current recipe price based on ingredient prices
recipeSchema.methods.calculateCurrentPrice = async function () {
  let totalPrice = 0
  const ingredientPrices = []

  for (const ingredient of this.ingredients) {
    if (ingredient.itemId) {
      const pantryItem = await mongoose.model("PantryItem").findById(ingredient.itemId)
      if (pantryItem && pantryItem.currentLowestPrice && pantryItem.currentLowestPrice.price) {
        const itemPrice = pantryItem.currentLowestPrice.price * ingredient.quantity
        totalPrice += itemPrice

        ingredientPrices.push({
          ingredientId: ingredient.itemId,
          price: pantryItem.currentLowestPrice.price,
          store: pantryItem.currentLowestPrice.storeName || "Unknown Store",
        })
      }
    }
  }

  // Add to price history
  this.priceHistory.push({
    date: new Date(),
    totalPrice,
    ingredientPrices,
  })

  // Calculate percent change if we have previous prices
  let weeklyChange = null
  let monthlyChange = null

  if (this.priceHistory.length > 1) {
    // Find price from a week ago
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const weeklyPrice = this.findClosestPriceToDate(oneWeekAgo)
    if (weeklyPrice && weeklyPrice > 0) {
      weeklyChange = ((totalPrice - weeklyPrice) / weeklyPrice) * 100
    }

    // Find price from a month ago
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const monthlyPrice = this.findClosestPriceToDate(oneMonthAgo)
    if (monthlyPrice && monthlyPrice > 0) {
      monthlyChange = ((totalPrice - monthlyPrice) / monthlyPrice) * 100
    }
  }

  // Update current price
  this.currentPrice = {
    totalPrice,
    lastUpdated: new Date(),
    percentChange: {
      weekly: weeklyChange,
      monthly: monthlyChange,
    },
  }

  return totalPrice
}

// Helper method to find the closest price to a given date
recipeSchema.methods.findClosestPriceToDate = function (targetDate) {
  if (!this.priceHistory || this.priceHistory.length === 0) {
    return null
  }

  let closestPrice = null
  let closestDiff = Number.POSITIVE_INFINITY

  for (const record of this.priceHistory) {
    const diff = Math.abs(record.date.getTime() - targetDate.getTime())
    if (diff < closestDiff) {
      closestDiff = diff
      closestPrice = record.totalPrice
    }
  }

  return closestPrice
}

const Recipe = mongoose.model("Recipe", recipeSchema)

module.exports = Recipe
