const mongoose = require("mongoose")

const newsItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ["Weather", "Supply Chain", "Economic", "Seasonal", "Health", "Organic"],
    required: true,
  },
  impactLevel: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },
  affectedItems: {
    type: [String],
    default: [],
  },
  source: {
    type: String,
    trim: true,
  },
  publishedAt: {
    type: Date,
    default: Date.now,
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
newsItemSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

const NewsItem = mongoose.model("NewsItem", newsItemSchema)

module.exports = NewsItem
