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
    enum: ["Pantry", "Produce", "Dairy", "Meat", "Bakery", "Frozen", "Other"],
    default: "Pantry",
  },
  type: {
    type: String,
    enum: ["Store Brand", "National Brand", "Organic"],
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
  isBuyRecommended: {
    type: Boolean,
    default: false,
  },
  buyRecommendationReason: {
    type: String,
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
pantryItemSchema.methods.addPricePoint = function (storeId, price) {
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
    this.isBuyRecommended = true
    this.buyRecommendationReason = "Price is at or near 6-week low"

    // Mark this price point as the lowest in period
    const latestPricePoint = this.priceHistory[this.priceHistory.length - 1]
    if (latestPricePoint) {
      latestPricePoint.isLowestInPeriod = true
    }

    console.log(`Buy recommendation set for ${this.name} at $${this.currentLowestPrice.price}`)
  } else {
    this.isBuyRecommended = false
    this.buyRecommendationReason = ""
  }
}

const PantryItem = mongoose.model("PantryItem", pantryItemSchema)

module.exports = PantryItem
