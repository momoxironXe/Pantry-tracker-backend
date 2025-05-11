// Script to generate historical price data for all existing items
require("dotenv").config()
const mongoose = require("mongoose")
const PantryItem = require("../models/PantryItem")
const Store = require("../models/Store")
const priceService = require("../services/priceService")

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Could not connect to MongoDB", err)
    process.exit(1)
  })

async function generateHistoricalData() {
  try {
    console.log("Starting historical data generation...")

    // Get all pantry items
    const items = await PantryItem.find({})
    console.log(`Found ${items.length} items to generate historical data for`)

    if (items.length === 0) {
      console.log("No items found. Exiting.")
      process.exit(0)
    }

    // Generate historical data for all items
    await priceService.generateHistoricalPriceData()

    console.log("Historical data generation complete!")
    process.exit(0)
  } catch (error) {
    console.error("Error generating historical data:", error)
    process.exit(1)
  }
}

// Run the function
generateHistoricalData()
