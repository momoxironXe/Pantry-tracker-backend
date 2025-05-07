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

console.log("Cron jobs scheduled")
