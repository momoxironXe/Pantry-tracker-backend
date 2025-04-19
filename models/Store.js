const mongoose = require("mongoose")

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      default: "USA",
    },
    formattedAddress: String,
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  placeId: {
    type: String,
    unique: true,
  },
  chainName: {
    type: String,
    trim: true,
  },
  storeType: {
    type: String,
    enum: ["Supermarket", "Warehouse Club", "Discount Store", "Specialty Store", "Other"],
    default: "Supermarket",
  },
  phone: String,
  website: String,
  hours: {
    monday: String,
    tuesday: String,
    wednesday: String,
    thursday: String,
    friday: String,
    saturday: String,
    sunday: String,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
  },
  priceLevel: {
    type: Number,
    min: 1,
    max: 4,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  apiSupport: {
    hasDirectApi: {
      type: Boolean,
      default: false,
    },
    apiType: {
      type: String,
      enum: ["None", "Walmart", "Target", "Kroger", "Other"],
      default: "None",
    },
    apiCredentials: {
      apiKey: String,
      apiSecret: String,
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

// Create a geospatial index for location-based queries
storeSchema.index({ location: "2dsphere" })

// Update the updatedAt field before saving
storeSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

const Store = mongoose.model("Store", storeSchema)

module.exports = Store
