const cron = require("node-cron")
const mongoose = require("mongoose")
const PantryItem = require("../models/PantryItem")
const Recipe = require("../models/Recipe")
const User = require("../models/User")
const PriceAlert = require("../models/PriceAlert")
const priceService = require("../services/priceService")
const emailService = require("../services/emailService")
const smsService = require("../services/smsService")

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB for cron jobs"))
  .catch((err) => console.error("Could not connect to MongoDB for cron jobs", err))

// Update price trends daily
cron.schedule("0 1 * * *", async () => {
  console.log("Running daily price trend updates...")
  try {
    await priceService.updatePriceTrends()
    console.log("Price trend updates completed")
  } catch (error) {
    console.error("Error in price trend update cron job:", error)
  }
})

// Update recipe prices daily
cron.schedule("0 2 * * *", async () => {
  console.log("Running daily recipe price updates...")
  try {
    const recipes = await Recipe.find({})
    console.log(`Updating prices for ${recipes.length} recipes`)

    let updatedCount = 0

    for (const recipe of recipes) {
      await recipe.calculateCurrentPrice()
      await recipe.save()
      updatedCount++
    }

    console.log(`Updated prices for ${updatedCount} recipes`)
  } catch (error) {
    console.error("Error in recipe price update cron job:", error)
  }
})

// Send price alerts weekly
cron.schedule("0 9 * * 1", async () => {
  // Every Monday at 9 AM
  console.log("Sending weekly price alerts...")
  try {
    // Get all items with price alerts
    const alertItems = await priceService.getItemsWithPriceAlerts()

    if (alertItems.length === 0) {
      console.log("No items with price alerts found")
      return
    }

    console.log(`Found ${alertItems.length} items with price alerts`)

    // Get all users with notification preferences
    const users = await User.find({
      "preferences.notificationPreferences.email.priceAlerts": true,
      emailVerified: true,
    })

    console.log(`Found ${users.length} users to notify`)

    // Send alerts to each user
    for (const user of users) {
      // Filter alerts based on user preferences
      let userAlerts = alertItems

      // If user has specific alert categories, filter by those
      if (
        user.preferences.alertCategories &&
        user.preferences.alertCategories.length > 0 &&
        !user.preferences.alertCategories.includes("All")
      ) {
        userAlerts = alertItems.filter((item) => user.preferences.alertCategories.includes(item.category))
      }

      // Also include items in user's pantry
      const userPantryItemIds = user.pantryItems.map((item) => item.itemId.toString())
      const pantryAlerts = alertItems.filter((item) => userPantryItemIds.includes(item._id.toString()))

      // Combine and remove duplicates
      const combinedAlerts = [...new Set([...userAlerts, ...pantryAlerts])]

      if (combinedAlerts.length === 0) {
        continue
      }

      // Send email alert
      await emailService.sendPriceAlertEmail(user, combinedAlerts)

      // Send SMS alert if enabled
      if (user.preferences.notificationPreferences.sms.priceAlerts && user.phoneVerified && user.phoneNumber) {
        await smsService.sendPriceAlertSms(user, combinedAlerts.slice(0, 3)) // Limit to 3 items for SMS
      }
    }

    console.log("Price alerts sent successfully")
  } catch (error) {
    console.error("Error in price alert cron job:", error)
  }
})

// Update seasonality of produce items monthly
cron.schedule("0 0 1 * *", async () => {
  // First day of each month
  console.log("Updating produce seasonality...")
  try {
    const produceItems = await PantryItem.find({ category: "Produce" })

    let updatedCount = 0

    for (const item of produceItems) {
      item.updateSeasonality()
      await item.save()
      updatedCount++
    }

    console.log(`Updated seasonality for ${updatedCount} produce items`)
  } catch (error) {
    console.error("Error in seasonality update cron job:", error)
  }
})

// Update the cron job to fetch current prices weekly and update the database
// Add a new cron job to fetch current prices from Walmart weekly
cron.schedule("0 3 * * 1", async () => {
  // Every Monday at 3 AM
  console.log("Running weekly price update from Walmart...")
  try {
    const apiIntegration = require("../services/apiIntegration")

    // Get all pantry items to update
    const pantryItems = await PantryItem.find({}).limit(500) // Limit to avoid overloading

    if (pantryItems.length === 0) {
      console.log("No pantry items found to update prices")
      return
    }

    console.log(`Found ${pantryItems.length} pantry items to update prices`)

    // Group items by category for better search results
    const itemsByCategory = {}

    pantryItems.forEach((item) => {
      if (!itemsByCategory[item.category]) {
        itemsByCategory[item.category] = []
      }
      itemsByCategory[item.category].push(item)
    })

    let updatedCount = 0

    // Process each category
    for (const [category, items] of Object.entries(itemsByCategory)) {
      // Process in smaller batches
      const batchSize = 20
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)

        // Create search queries based on item names
        for (const item of batch) {
          try {
            // Search for this specific item
            const searchQuery = item.name.split(" ").slice(0, 3).join(" ") // Use first 3 words for better results
            const products = await apiIntegration.searchWalmartProducts(searchQuery)

            if (products && products.length > 0) {
              // Find the best match
              const bestMatch = products[0] // Simplification - in reality would use better matching logic

              // Update the item with the new price
              const storeService = require("../services/storeService")
              const stores = await storeService.getStoresByName("Walmart")

              if (stores && stores.length > 0) {
                const pricePoint = {
                  storeId: stores[0]._id,
                  price: bestMatch.price,
                  date: new Date(),
                }

                // Add to price history
                item.priceHistory.push(pricePoint)

                // Update current lowest price if applicable
                if (!item.currentLowestPrice.price || bestMatch.price < item.currentLowestPrice.price) {
                  item.currentLowestPrice = {
                    price: bestMatch.price,
                    storeId: stores[0]._id,
                    lastUpdated: new Date(),
                  }
                }

                // Update price range
                const prices = item.priceHistory.map((p) => p.price)
                item.priceRange = {
                  min: Math.min(...prices),
                  max: Math.max(...prices),
                  period: 6,
                }

                await item.save()
                updatedCount++
              }
            }
          } catch (itemError) {
            console.error(`Error updating price for item ${item.name}:`, itemError)
          }

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        console.log(`Processed ${i + batch.length} of ${items.length} items in category ${category}`)
      }
    }

    console.log(`Successfully updated prices for ${updatedCount} items from Walmart`)

    // Update price trends after fetching new prices
    await priceService.updatePriceTrends()
  } catch (error) {
    console.error("Error in weekly Walmart price update cron job:", error)
  }
})

console.log("Cron jobs scheduled")
