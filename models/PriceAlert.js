const mongoose = require("mongoose")

const priceAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PantryItem",
    required: true,
  },
  targetPrice: {
    type: Number,
    required: true,
  },
  currentPrice: {
    type: Number,
    required: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  notificationSent: {
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
priceAlertSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

const PriceAlert = mongoose.model("PriceAlert", priceAlertSchema)

module.exports = PriceAlert
