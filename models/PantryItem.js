const mongoose = require("mongoose")

const priceHistorySchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
  },
  price: {
    type: Number,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  isLowestInPeriod: {
    type: Boolean,
    default: false,
  },
})

// Add fields for price trends and contextual nudges
const pantryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ["Pantry", "Produce", "Dairy", "Meat", "Bakery", "Frozen", "Grains", "Canned", "Baking", "Other"],
    default: "Pantry",
  },
  type: {
    type: String,
    enum: ["Store Brand", "National Brand", "Organic", "Local"],
    default: "National Brand",
  },
  size: {
    type: String,
    trim: true,
  },
  unit: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
  },
  upc: {
    type: String,
    trim: true,
    index: true,
  },
  priceHistory: [priceHistorySchema],
  currentLowestPrice: {
    price: Number,
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
    storeName: String,
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  priceRange: {
    min: Number,
    max: Number,
    period: {
      type: Number,
      default: 6, // weeks
    },
  },
  priceTrend: {
    weeklyChange: Number, // percentage change from last week
    monthlyChange: Number, // percentage change from last month
    threeMonthChange: Number, // percentage change from three months ago
  },
  priceAlerts: {
    isLowestInPeriod: {
      type: Boolean,
      default: false,
    },
    isSeasonalLow: {
      type: Boolean,
      default: false,
    },
    isBuyRecommended: {
      type: Boolean,
      default: false,
    },
    buyRecommendationReason: {
      type: String,
    },
  },
  isHealthy: {
    type: Boolean,
    default: false,
  },
  isValuePick: {
    type: Boolean,
    default: false,
  },
  isBulkOption: {
    type: Boolean,
    default: false,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isSeasonalProduce: {
    type: Boolean,
    default: false,
  },
  seasonality: {
    peakMonths: [Number], // 1-12 for Jan-Dec
    currentlySeasonal: {
      type: Boolean,
      default: false,
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
pantryItemSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

// Method to add a new price point to history
pantryItemSchema.methods.addPricePoint = function (storeId, price, storeName) {
  if (!price || isNaN(price) || price <= 0) {
    console.warn(`Invalid price: ${price} for item ${this.name}`)
    return
  }

  console.log(`Adding price point for ${this.name}: $${price} at store ${storeId}`)

  this.priceHistory.push({
    storeId,
    price,
    date: new Date(),
  })

  // Update current lowest price if applicable
  if (!this.currentLowestPrice.price || price < this.currentLowestPrice.price) {
    this.currentLowestPrice = {
      price,
      storeId,
      storeName,
      lastUpdated: new Date(),
    }
    console.log(`Updated lowest price for ${this.name} to $${price}`)
  }

  // Update price range
  this.updatePriceRange()

  // Check if this is a buy recommendation
  this.checkBuyRecommendation()
}

// Method to update price range for the last 6 weeks
pantryItemSchema.methods.updatePriceRange = function () {
  const sixWeeksAgo = new Date()
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - this.priceRange.period * 7)

  const recentPrices = this.priceHistory.filter((record) => record.date >= sixWeeksAgo).map((record) => record.price)

  if (recentPrices.length > 0) {
    this.priceRange.min = Math.min(...recentPrices)
    this.priceRange.max = Math.max(...recentPrices)
    console.log(`Updated price range for ${this.name}: $${this.priceRange.min} - $${this.priceRange.max}`)
  }
}

// Method to check if current price warrants a buy recommendation
pantryItemSchema.methods.checkBuyRecommendation = function () {
  if (!this.currentLowestPrice.price || !this.priceRange.min) return

  // If current price is within 5% of the 6-week low, recommend buying
  const threshold = this.priceRange.min * 1.05

  if (this.currentLowestPrice.price <= threshold) {
    this.priceAlerts.isBuyRecommended = true
    this.priceAlerts.buyRecommendationReason = "Price is at or near 6-week low"

    // Mark this price point as the lowest in period
    const latestPricePoint = this.priceHistory[this.priceHistory.length - 1]
    if (latestPricePoint) {
      latestPricePoint.isLowestInPeriod = true
    }

    console.log(`Buy recommendation set for ${this.name} at $${this.currentLowestPrice.price}`)
  } else {
    this.priceAlerts.isBuyRecommended = false
    this.priceAlerts.buyRecommendationReason = ""
  }
}

// Add method to calculate price trends
pantryItemSchema.methods.calculatePriceTrends = function () {
  if (!this.priceHistory || this.priceHistory.length < 2) {
    return
  }

  const currentPrice = this.currentLowestPrice.price
  if (!currentPrice) return

  // Sort price history by date (newest first)
  const sortedHistory = [...this.priceHistory].sort((a, b) => b.date - a.date)

  // Get prices from different time periods
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Find closest price points to these dates
  const weeklyPrice = this.findClosestPriceToDate(sortedHistory, oneWeekAgo)
  const monthlyPrice = this.findClosestPriceToDate(sortedHistory, oneMonthAgo)
  const threeMonthPrice = this.findClosestPriceToDate(sortedHistory, threeMonthsAgo)

  // Calculate percentage changes
  this.priceTrend = {
    weeklyChange: weeklyPrice ? ((currentPrice - weeklyPrice) / weeklyPrice) * 100 : null,
    monthlyChange: monthlyPrice ? ((currentPrice - monthlyPrice) / monthlyPrice) * 100 : null,
    threeMonthChange: threeMonthPrice ? ((currentPrice - threeMonthPrice) / threeMonthPrice) * 100 : null,
  }

  // Set price alerts based on trends
  this.updatePriceAlerts()
}

// Helper method to find closest price to a date
pantryItemSchema.methods.findClosestPriceToDate = (history, targetDate) => {
  if (!history || history.length === 0) return null

  let closestRecord = null
  let closestDiff = Number.POSITIVE_INFINITY

  for (const record of history) {
    const diff = Math.abs(record.date.getTime() - targetDate.getTime())
    if (diff < closestDiff) {
      closestDiff = diff
      closestRecord = record
    }
  }

  return closestRecord ? closestRecord.price : null
}

// Method to update price alerts based on trends
pantryItemSchema.methods.updatePriceAlerts = function () {
  const alerts = {
    isLowestInPeriod: false,
    isSeasonalLow: false,
    isBuyRecommended: false,
    buyRecommendationReason: "",
  }

  // Check if current price is lowest in period
  if (
    this.currentLowestPrice.price &&
    this.priceRange.min &&
    this.currentLowestPrice.price <= this.priceRange.min * 1.02
  ) {
    // Within 2% of minimum
    alerts.isLowestInPeriod = true
    alerts.isBuyRecommended = true
    alerts.buyRecommendationReason = "Price is at or near 6-week low"
  }

  // Check if price has dropped significantly from last month
  if (this.priceTrend && this.priceTrend.monthlyChange && this.priceTrend.monthlyChange <= -10) {
    alerts.isBuyRecommended = true
    alerts.buyRecommendationReason = "Price has dropped 10% or more from last month"
  }

  // Check if item is seasonal and currently in season
  if (this.isSeasonalProduce && this.seasonality && this.seasonality.currentlySeasonal) {
    alerts.isSeasonalLow = true
    alerts.isBuyRecommended = true
    alerts.buyRecommendationReason = "Seasonal produce currently at peak freshness and value"
  }

  this.priceAlerts = alerts
}

// Method to update seasonality based on current month
pantryItemSchema.methods.updateSeasonality = function () {
  if (!this.seasonality || !this.seasonality.peakMonths || this.seasonality.peakMonths.length === 0) {
    return
  }

  const currentMonth = new Date().getMonth() + 1 // 1-12 for Jan-Dec
  this.seasonality.currentlySeasonal = this.seasonality.peakMonths.includes(currentMonth)
}

const PantryItem = mongoose.model("PantryItem", pantryItemSchema)

module.exports = PantryItem
