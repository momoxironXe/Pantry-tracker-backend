const axios = require("axios")
const PantryItem = require("../models/PantryItem")
const Store = require("../models/Store")
const User = require("../models/User")

// Mock data for stores without direct API access
const mockPriceData = {
  Pantry: {
    "Organic Eggs - 12 ct": { priceRange: [2.35, 4.99], unit: "dozen" },
    "Whole Wheat Bread": { priceRange: [1.99, 3.99], unit: "loaf" },
    "Brown Rice - 2 lb": { priceRange: [2.49, 4.99], unit: "bag" },
    "Pasta - 16 oz": { priceRange: [0.99, 2.99], unit: "box" },
    "Canned Beans - 15 oz": { priceRange: [0.79, 1.99], unit: "can" },
    "Peanut Butter - 16 oz": { priceRange: [1.99, 4.99], unit: "jar" },
    "Olive Oil - 16.9 oz": { priceRange: [5.99, 12.99], unit: "bottle" },
    "Cereal - 18 oz": { priceRange: [2.99, 5.99], unit: "box" },
    "Oatmeal - 42 oz": { priceRange: [2.99, 5.99], unit: "container" },
    "Coffee - 12 oz": { priceRange: [5.99, 12.99], unit: "bag" },
  },
  Produce: {
    Bananas: { priceRange: [0.49, 0.79], unit: "lb" },
    Apples: { priceRange: [0.99, 2.49], unit: "lb" },
    "Carrots - 1 lb": { priceRange: [0.99, 1.99], unit: "bag" },
    "Spinach - 8 oz": { priceRange: [1.99, 3.99], unit: "bag" },
    "Sweet Potatoes": { priceRange: [0.99, 1.99], unit: "lb" },
    Onions: { priceRange: [0.69, 1.49], unit: "lb" },
    Broccoli: { priceRange: [1.49, 2.99], unit: "bunch" },
    Avocados: { priceRange: [0.99, 2.49], unit: "each" },
    Tomatoes: { priceRange: [1.49, 3.99], unit: "lb" },
    "Bell Peppers": { priceRange: [0.99, 2.49], unit: "each" },
  },
}

// Function to fetch prices from Walmart API
const fetchWalmartPrices = async (storeId, items) => {
  try {
    const store = await Store.findById(storeId)
    if (!store || store.apiSupport.apiType !== "Walmart") {
      throw new Error("Store does not support Walmart API")
    }

    // In a real implementation, you would use the Walmart API here
    // For now, we'll use mock data with some randomization

    const results = []

    for (const item of items) {
      // Get the mock price range for this item
      let mockData
      if (item.category === "Produce") {
        mockData = mockPriceData.Produce[item.name]
      } else {
        mockData = mockPriceData.Pantry[item.name]
      }

      if (!mockData) {
        // If no mock data, generate a random price
        const price = (Math.random() * 10 + 1).toFixed(2)
        results.push({
          itemId: item._id,
          price: Number.parseFloat(price),
          storeId: store._id,
          storeName: store.name,
          inStock: Math.random() > 0.1, // 90% chance of being in stock
        })
      } else {
        // Use the mock price range with some randomization
        const [min, max] = mockData.priceRange
        const range = max - min
        const price = (min + Math.random() * range).toFixed(2)

        results.push({
          itemId: item._id,
          price: Number.parseFloat(price),
          storeId: store._id,
          storeName: store.name,
          inStock: Math.random() > 0.1, // 90% chance of being in stock
        })
      }
    }

    return results
  } catch (error) {
    console.error("Error fetching Walmart prices:", error)
    throw error
  }
}

// Function to fetch prices from other store APIs
const fetchStorePrices = async (storeId, items) => {
  try {
    const store = await Store.findById(storeId)
    if (!store) {
      throw new Error("Store not found")
    }

    // Check which API to use
    if (store.apiSupport.apiType === "Walmart") {
      return await fetchWalmartPrices(storeId, items)
    } else if (store.apiSupport.apiType === "Target") {
      // Implement Target API integration
      // For now, use mock data
    } else if (store.apiSupport.apiType === "Kroger") {
      // Implement Kroger API integration
      // For now, use mock data
    }

    // For stores without API support, use mock data
    const results = []

    for (const item of items) {
      // Get the mock price range for this item
      let mockData
      if (item.category === "Produce") {
        mockData = mockPriceData.Produce[item.name]
      } else {
        mockData = mockPriceData.Pantry[item.name]
      }

      if (!mockData) {
        // If no mock data, generate a random price
        const price = (Math.random() * 10 + 1).toFixed(2)
        results.push({
          itemId: item._id,
          price: Number.parseFloat(price),
          storeId: store._id,
          storeName: store.name,
          inStock: Math.random() > 0.1, // 90% chance of being in stock
        })
      } else {
        // Use the mock price range with some randomization
        const [min, max] = mockData.priceRange
        const range = max - min
        const price = (min + Math.random() * range).toFixed(2)

        results.push({
          itemId: item._id,
          price: Number.parseFloat(price),
          storeId: store._id,
          storeName: store.name,
          inStock: Math.random() > 0.1, // 90% chance of being in stock
        })
      }
    }

    return results
  } catch (error) {
    console.error("Error fetching store prices:", error)
    throw error
  }
}

// Function to update price history for items
const updatePriceHistory = async (priceData) => {
  try {
    if (!priceData || priceData.length === 0) {
      return true
    }

    console.log(`Updating price history for ${priceData.length} items in batch...`)

    // Group price data by item ID
    const pricesByItem = {}
    for (const data of priceData) {
      if (!pricesByItem[data.itemId]) {
        pricesByItem[data.itemId] = []
      }
      pricesByItem[data.itemId].push(data)
    }

    // Get all items at once
    const itemIds = Object.keys(pricesByItem)
    const items = await PantryItem.find({ _id: { $in: itemIds } })

    // Prepare bulk operations
    const bulkOps = []

    for (const item of items) {
      const itemPrices = pricesByItem[item._id.toString()] || []
      if (itemPrices.length === 0) continue

      // Find the lowest price
      let lowestPrice = null
      const pricePoints = []

      for (const data of itemPrices) {
        if (!data.price || isNaN(data.price) || data.price <= 0) {
          continue
        }

        const pricePoint = {
          storeId: data.storeId,
          price: data.price,
          date: new Date(),
          isLowestInPeriod: false,
        }

        pricePoints.push(pricePoint)

        // Track lowest price
        if (!lowestPrice || data.price < lowestPrice.price) {
          lowestPrice = {
            price: data.price,
            storeId: data.storeId,
          }
        }
      }

      if (pricePoints.length === 0) continue

      // Determine if we need to update the current lowest price
      let updateLowestPrice = false
      if (lowestPrice && (!item.currentLowestPrice.price || lowestPrice.price < item.currentLowestPrice.price)) {
        updateLowestPrice = true
      }

      // Calculate price range
      const sixWeeksAgo = new Date()
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - (item.priceRange?.period || 6) * 7)

      // Get all prices including new ones
      const allPrices = [
        ...(item.priceHistory || []).filter((p) => p.date >= sixWeeksAgo).map((p) => p.price),
        ...pricePoints.map((p) => p.price),
      ]

      let priceRange = {
        min: item.priceRange?.min || 0,
        max: item.priceRange?.max || 0,
      }

      if (allPrices.length > 0) {
        priceRange = {
          min: Math.min(...allPrices),
          max: Math.max(...allPrices),
        }
      }

      // Check if current price warrants a buy recommendation
      let isBuyRecommended = false
      let buyRecommendationReason = ""

      if (lowestPrice && priceRange.min > 0) {
        const threshold = priceRange.min * 1.05
        if (lowestPrice.price <= threshold) {
          isBuyRecommended = true
          buyRecommendationReason = "Price is at or near 6-week low"

          // Mark the lowest price point
          const lowestPricePoint = pricePoints.find(
            (p) => p.storeId.toString() === lowestPrice.storeId.toString() && p.price === lowestPrice.price,
          )

          if (lowestPricePoint) {
            lowestPricePoint.isLowestInPeriod = true
          }
        }
      }

      // Create update operation
      bulkOps.push({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $push: {
              priceHistory: {
                $each: pricePoints,
              },
            },
            ...(updateLowestPrice
              ? {
                  $set: {
                    "currentLowestPrice.price": lowestPrice.price,
                    "currentLowestPrice.storeId": lowestPrice.storeId,
                    "currentLowestPrice.lastUpdated": new Date(),
                  },
                }
              : {}),
            $set: {
              "priceRange.min": priceRange.min,
              "priceRange.max": priceRange.max,
              isBuyRecommended: isBuyRecommended,
              buyRecommendationReason: buyRecommendationReason,
            },
          },
        },
      })
    }

    // Execute bulk operations if any
    if (bulkOps.length > 0) {
      await PantryItem.bulkWrite(bulkOps)
      console.log(`Successfully updated price history for ${bulkOps.length} items`)
    }

    return true
  } catch (error) {
    console.error("Error updating price history:", error)
    throw error
  }
}

// Function to get top pantry items with price info
const getTopPantryItemsWithPriceInfo = async (zipCode, shoppingType, category = "Pantry", limit = 10, options = {}) => {
  try {
    console.log(`Getting top ${category} items for ZIP: ${zipCode}, shopping type: ${shoppingType}`)

    if (!zipCode) {
      console.error("No zipCode provided to getTopPantryItems")
      return []
    }

    // Get stores for this zip code and shopping type
    const storeService = require("./storeService")
    const stores = await storeService.getStoresByUserPreference(zipCode, shoppingType)

    if (!stores || stores.length === 0) {
      console.warn("No stores found for this zip code")
      return []
    }

    // Get pantry items
    const query = { category, ...options }

    // Default shopping type if not provided
    const userShoppingType = shoppingType || "bulk"

    // Apply filters based on shopping type
    if (userShoppingType === "health") {
      query.isHealthy = true
    } else if (userShoppingType === "bulk") {
      query.isBulkOption = true
    } else if (userShoppingType === "value") {
      query.isValuePick = true
    }

    let items = await PantryItem.find(query).sort({ isFeatured: -1 }).limit(limit)

    // If we don't have enough items with the filter, get more without the filter
    if (items.length < limit) {
      const remainingLimit = limit - items.length
      const additionalItems = await PantryItem.find({ category }).sort({ isFeatured: -1 }).limit(remainingLimit)

      // Add only items that aren't already in the list
      for (const item of additionalItems) {
        if (!items.some((existingItem) => existingItem._id.toString() === item._id.toString())) {
          items.push(item)
        }
      }
    }

    // Fetch current prices for these items from all stores
    const itemPrices = []

    for (const store of stores.slice(0, 3)) {
      // Limit to top 3 stores for performance
      const prices = await fetchStorePrices(store._id, items)
      itemPrices.push(...prices)
    }

    // Update price history with the new data
    await updatePriceHistory(itemPrices)

    // Refresh items to get updated price data
    items = await PantryItem.find({ _id: { $in: items.map((item) => item._id) } }).populate({
      path: "priceHistory.storeId",
      select: "name chainName",
    })

    // Format the response
    const formattedItems = items.map((item) => {
      // Find the lowest current price
      const lowestPrice = item.currentLowestPrice || { price: 0 }
      const lowestPriceStore = stores.find(
        (store) => store._id.toString() === (lowestPrice.storeId ? lowestPrice.storeId.toString() : ""),
      )

      // If no store is found, use a default store name
      const storeName = lowestPriceStore ? lowestPriceStore.name : stores.length > 0 ? stores[0].name : "Walmart"

      // Ensure price is valid
      const validPrice =
        lowestPrice.price > 0 ? lowestPrice.price : Number.parseFloat((Math.random() * 10 + 1).toFixed(2))

      // Ensure price range is valid
      let minPrice = item.priceRange?.min || 0
      let maxPrice = item.priceRange?.max || 0

      if (minPrice <= 0 || maxPrice <= 0) {
        minPrice = Number.parseFloat((validPrice * 0.8).toFixed(2))
        maxPrice = Number.parseFloat((validPrice * 1.2).toFixed(2))
      }

      return {
        id: item._id,
        name: item.name || "Unknown Item",
        description: item.description || "",
        category: item.category || "Pantry",
        type: item.type || "National Brand",
        size: item.size || "",
        unit: item.unit || "",
        imageUrl: item.imageUrl || "",
        lowestPrice: {
          price: validPrice,
          store: storeName,
        },
        priceRange: {
          min: minPrice,
          max: maxPrice,
          period: `${item.priceRange?.period || 6} weeks`,
        },
        isBuyRecommended: item.isBuyRecommended || false,
        buyRecommendationReason: item.buyRecommendationReason || "",
        isHealthy: item.isHealthy || false,
        isValuePick: item.isValuePick || false,
        isBulkOption: item.isBulkOption || false,
      }
    })

    return formattedItems
  } catch (error) {
    console.error("Error in getTopPantryItems:", error)
    return []
  }
}

// Function to get buy alerts (best deals this week)
const getBuyAlertsWithDeals = async (zipCode, shoppingType, limit = 4) => {
  try {
    console.log(`Getting buy alerts for ZIP: ${zipCode}, shopping type: ${shoppingType}`)

    if (!zipCode) {
      console.error("No zipCode provided to getBuyAlerts")
      return []
    }

    // Get all pantry items that are recommended for buying
    const pantryItems = await getTopPantryItemsWithPriceInfo(zipCode, shoppingType, "Pantry", 20)
    const produceItems = await getTopPantryItemsWithPriceInfo(zipCode, shoppingType, "Produce", 20)

    // Combine and filter for buy recommendations
    const allItems = [...pantryItems, ...produceItems]
      .filter((item) => item.isBuyRecommended)
      .sort((a, b) => {
        // Sort by price difference percentage (current vs max)
        const aDiff = a.priceRange.max > 0 ? (a.priceRange.max - a.lowestPrice.price) / a.priceRange.max : 0
        const bDiff = b.priceRange.max > 0 ? (b.priceRange.max - b.lowestPrice.price) / b.priceRange.max : 0

        return bDiff - aDiff // Higher difference first
      })
      .slice(0, limit)

    return allItems
  } catch (error) {
    console.error("Error in getBuyAlerts:", error)
    return []
  }
}

// Add method to update price trends for all items
const updatePriceTrends = async () => {
  try {
    console.log("Updating price trends for all items...")

    // Get all pantry items with price history
    const items = await PantryItem.find({
      "priceHistory.0": { $exists: true },
    })

    console.log(`Found ${items.length} items with price history`)

    let updatedCount = 0

    for (const item of items) {
      // Calculate price trends
      item.calculatePriceTrends()

      // Update seasonality
      item.updateSeasonality()

      await item.save()
      updatedCount++
    }

    console.log(`Successfully updated price trends for ${updatedCount} items`)
    return true
  } catch (error) {
    console.error("Error updating price trends:", error)
    return false
  }
}

// Add method to get items with price alerts
const getItemsWithPriceAlerts = async (category = null) => {
  try {
    const query = {
      "priceAlerts.isBuyRecommended": true,
    }

    if (category) {
      query.category = category
    }

    const items = await PantryItem.find(query).sort({ "currentLowestPrice.lastUpdated": -1 }).limit(50)

    return items
  } catch (error) {
    console.error("Error getting items with price alerts:", error)
    return []
  }
}

// Add method to get price trends for specific items
const getPriceTrendsForItems = async (itemIds) => {
  try {
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return []
    }

    const items = await PantryItem.find({
      _id: { $in: itemIds },
    })

    // Format price history for each item
    const trends = items.map((item) => {
      // Group price history by month
      const monthlyPrices = {}

      item.priceHistory.forEach((record) => {
        const date = new Date(record.date)
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`

        if (!monthlyPrices[monthKey]) {
          monthlyPrices[monthKey] = []
        }

        monthlyPrices[monthKey].push(record.price)
      })

      // Calculate average price for each month
      const monthlyAverages = Object.keys(monthlyPrices).map((month) => {
        const prices = monthlyPrices[month]
        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length

        const [year, monthNum] = month.split("-")
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const monthName = monthNames[Number.parseInt(monthNum) - 1]

        return {
          month: `${monthName} ${year}`,
          price: avgPrice.toFixed(2),
        }
      })

      // Sort by date
      monthlyAverages.sort((a, b) => {
        const aMonth = a.month.split(" ")
        const bMonth = b.month.split(" ")

        const aDate = new Date(`${aMonth[0]} 1, ${aMonth[1]}`)
        const bDate = new Date(`${bMonth[0]} 1, ${bMonth[1]}`)

        return aDate - bDate
      })

      return {
        id: item._id,
        name: item.name,
        currentPrice: item.currentLowestPrice?.price || 0,
        priceTrend: item.priceTrend || {},
        monthlyPrices: monthlyAverages,
      }
    })

    return trends
  } catch (error) {
    console.error("Error getting price trends:", error)
    return []
  }
}

// Function to get top pantry items based on user preferences
const getTopPantryItems = async (zipCode, shoppingStyle, category, limit = 10, options = {}) => {
  try {
    // Build query
    const query = { category }

    // Add additional filters based on options
    if (options.isHealthy) query.isHealthy = true
    if (options.isValuePick) query.isValuePick = true
    if (options.isBulkOption) query.isBulkOption = true
    if (options.isSeasonalProduce) query.isSeasonalProduce = true

    // Get items from database
    let items = await PantryItem.find(query).limit(limit)

    // If no items found, create some mock data
    if (items.length === 0) {
      items = generateMockPantryItems(category, limit)
    }

    // Format items for frontend
    return items.map((item) => formatPantryItem(item, shoppingStyle))
  } catch (error) {
    console.error(`Error getting top ${category} items:`, error)
    return []
  }
}

// Function to get buy alerts
const getBuyAlerts = async (zipCode, shoppingStyle, limit = 4) => {
  try {
    // Get items with price drops or special deals
    let items = await PantryItem.find({ isBuyRecommended: true }).limit(limit)

    // If no items found, create some mock data
    if (items.length === 0) {
      items = generateMockBuyAlerts(limit)
    }

    // Format items for frontend
    return items.map((item) => formatPantryItem(item, shoppingStyle, true))
  } catch (error) {
    console.error("Error getting buy alerts:", error)
    return []
  }
}

// Function to get price trends for items
const getPriceTrends = async (itemIds) => {
  try {
    // Get items by IDs
    const items = await PantryItem.find({ _id: { $in: itemIds } })

    // Generate price trends for each item
    return items.map((item) => {
      // Generate historical price data if not available
      const priceHistory = item.priceHistory || generatePriceHistory(item)

      return {
        id: item._id,
        name: item.name,
        currentPrice: item.currentLowestPrice?.price || 5.99,
        priceHistory: {
          weekly: priceHistory.weekly || generateWeeklyPriceData(item),
          monthly: priceHistory.monthly || generateMonthlyPriceData(item),
          threeMonth: priceHistory.threeMonth || generateThreeMonthPriceData(item),
        },
        priceChange: {
          weekly: calculatePriceChange(priceHistory.weekly || generateWeeklyPriceData(item)),
          monthly: calculatePriceChange(priceHistory.monthly || generateMonthlyPriceData(item)),
          threeMonth: calculatePriceChange(priceHistory.threeMonth || generateThreeMonthPriceData(item)),
        },
        lowestPrice: findLowestPrice(priceHistory.threeMonth || generateThreeMonthPriceData(item)),
        highestPrice: findHighestPrice(priceHistory.threeMonth || generateThreeMonthPriceData(item)),
        storeName: item.currentLowestPrice?.storeName || "Various Stores",
        seasonalLow: Math.random() > 0.7, // Randomly determine if it's a seasonal low
        buyRecommendation: item.isBuyRecommended || Math.random() > 0.7,
        buyRecommendationReason: item.buyRecommendationReason || generateBuyRecommendationReason(),
      }
    })
  } catch (error) {
    console.error("Error getting price trends:", error)
    return []
  }
}

// Function to get user's pantry items with price trends
const getUserPantryWithTrends = async (userId) => {
  try {
    // Get user with populated pantry items
    const user = await User.findById(userId).populate({
      path: "pantryItems.itemId",
      model: "PantryItem",
    })

    if (!user || !user.pantryItems || user.pantryItems.length === 0) {
      return []
    }

    // Format pantry items with price trends
    return user.pantryItems
      .map((pantryItem) => {
        const item = pantryItem.itemId
        if (!item) return null

        // Generate price history if not available
        const priceHistory = item.priceHistory || generatePriceHistory(item)

        return {
          id: item._id,
          name: item.name,
          quantity: pantryItem.quantity || 1,
          monthlyUsage: pantryItem.monthlyUsage || 1,
          addedAt: pantryItem.addedAt || new Date(),
          currentPrice: item.currentLowestPrice?.price || 5.99,
          priceHistory: {
            weekly: priceHistory.weekly || generateWeeklyPriceData(item),
            monthly: priceHistory.monthly || generateMonthlyPriceData(item),
            threeMonth: priceHistory.threeMonth || generateThreeMonthPriceData(item),
          },
          priceChange: {
            weekly: calculatePriceChange(priceHistory.weekly || generateWeeklyPriceData(item)),
            monthly: calculatePriceChange(priceHistory.monthly || generateMonthlyPriceData(item)),
            threeMonth: calculatePriceChange(priceHistory.threeMonth || generateThreeMonthPriceData(item)),
          },
          lowestPrice: findLowestPrice(priceHistory.threeMonth || generateThreeMonthPriceData(item)),
          highestPrice: findHighestPrice(priceHistory.threeMonth || generateThreeMonthPriceData(item)),
          storeName: item.currentLowestPrice?.storeName || "Various Stores",
        }
      })
      .filter(Boolean)
  } catch (error) {
    console.error("Error getting user pantry with trends:", error)
    return []
  }
}

// Helper function to format pantry item for frontend
const formatPantryItem = (item, shoppingStyle, isBuyAlert = false) => {
  // Generate a random price if not available
  const price = item.currentLowestPrice?.price || (Math.random() * 10 + 1).toFixed(2)
  const minPrice = price * 0.8
  const maxPrice = price * 1.2

  return {
    id: item._id || `mock-${Math.random().toString(36).substring(2, 9)}`,
    name: item.name,
    description: item.description || `${item.name} - ${item.size || "Standard Size"}`,
    category: item.category,
    type: item.type || (Math.random() > 0.5 ? "Name Brand" : "Store Brand"),
    size: item.size || "Standard",
    unit: item.unit || "each",
    imageUrl: item.imageUrl || `/placeholder.svg?height=200&width=200&query=grocery+${item.name.replace(/\s+/g, "+")}`,
    lowestPrice: {
      price: Number(price),
      store: item.currentLowestPrice?.storeName || getRandomStore(),
    },
    priceRange: {
      min: Number(minPrice.toFixed(2)),
      max: Number(maxPrice.toFixed(2)),
      period: "6 weeks",
    },
    isBuyRecommended: isBuyAlert || item.isBuyRecommended || false,
    buyRecommendationReason: item.buyRecommendationReason || (isBuyAlert ? generateBuyRecommendationReason() : ""),
    isHealthy: item.isHealthy || (shoppingStyle === "health" && Math.random() > 0.5),
    isValuePick: item.isValuePick || (shoppingStyle === "value" && Math.random() > 0.5),
    isBulkOption: item.isBulkOption || (shoppingStyle === "bulk" && Math.random() > 0.5),
  }
}

// Helper function to generate mock pantry items
const generateMockPantryItems = (category, limit) => {
  const pantryItems = [
    { name: "Brown Rice", category: "Pantry", size: "2 lb", unit: "bag", isHealthy: true, isBulkOption: true },
    { name: "Black Beans", category: "Pantry", size: "15 oz", unit: "can", isHealthy: true, isValuePick: true },
    { name: "Pasta", category: "Pantry", size: "16 oz", unit: "box", isValuePick: true },
    { name: "Olive Oil", category: "Pantry", size: "16.9 fl oz", unit: "bottle", isHealthy: true },
    { name: "Canned Tuna", category: "Pantry", size: "5 oz", unit: "can", isValuePick: true },
    { name: "Peanut Butter", category: "Pantry", size: "16 oz", unit: "jar", isHealthy: true },
    { name: "Oatmeal", category: "Pantry", size: "42 oz", unit: "container", isHealthy: true, isBulkOption: true },
    { name: "Honey", category: "Pantry", size: "12 oz", unit: "bottle", isHealthy: true },
    { name: "Flour", category: "Pantry", size: "5 lb", unit: "bag", isBulkOption: true },
    { name: "Sugar", category: "Pantry", size: "4 lb", unit: "bag", isBulkOption: true },
    { name: "Apples", category: "Produce", size: "1 lb", unit: "bag", isHealthy: true, isSeasonalProduce: true },
    { name: "Bananas", category: "Produce", size: "1 bunch", unit: "each", isHealthy: true, isValuePick: true },
    { name: "Spinach", category: "Produce", size: "10 oz", unit: "bag", isHealthy: true },
    { name: "Carrots", category: "Produce", size: "1 lb", unit: "bag", isHealthy: true, isValuePick: true },
    { name: "Potatoes", category: "Produce", size: "5 lb", unit: "bag", isValuePick: true, isBulkOption: true },
    { name: "Onions", category: "Produce", size: "3 lb", unit: "bag", isValuePick: true },
    { name: "Tomatoes", category: "Produce", size: "1 lb", unit: "each", isHealthy: true, isSeasonalProduce: true },
    { name: "Avocados", category: "Produce", size: "each", unit: "each", isHealthy: true },
    { name: "Broccoli", category: "Produce", size: "1 head", unit: "each", isHealthy: true },
    { name: "Bell Peppers", category: "Produce", size: "each", unit: "each", isHealthy: true, isSeasonalProduce: true },
  ]

  // Filter by category and limit
  return pantryItems
    .filter((item) => item.category === category)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      _id: `mock-${Math.random().toString(36).substring(2, 9)}`,
      description: `${item.name} - ${item.size}`,
      type: Math.random() > 0.5 ? "Name Brand" : "Store Brand",
      imageUrl: `/placeholder.svg?height=200&width=200&query=grocery+${item.name.replace(/\s+/g, "+")}`,
      currentLowestPrice: {
        price: (Math.random() * 10 + 1).toFixed(2),
        storeName: getRandomStore(),
      },
      isBuyRecommended: Math.random() > 0.7,
      buyRecommendationReason: Math.random() > 0.7 ? generateBuyRecommendationReason() : "",
    }))
}

// Helper function to generate mock buy alerts
const generateMockBuyAlerts = (limit) => {
  const buyAlerts = [
    {
      name: "Organic Chicken",
      category: "Meat",
      size: "1 lb",
      unit: "package",
      isHealthy: true,
      currentLowestPrice: { price: 4.99, storeName: "Whole Foods" },
      category: "Meat",
      size: "1 lb",
      unit: "package",
      isHealthy: true,
      currentLowestPrice: { price: 4.99, storeName: "Whole Foods" },
      buyRecommendationReason: "Price dropped 20% this week!",
    },
    {
      name: "Almond Milk",
      category: "Dairy",
      size: "64 oz",
      unit: "carton",
      isHealthy: true,
      currentLowestPrice: { price: 2.99, storeName: "Target" },
      buyRecommendationReason: "Buy one get one free this weekend!",
    },
    {
      name: "Frozen Berries",
      category: "Frozen",
      size: "16 oz",
      unit: "bag",
      isHealthy: true,
      isBulkOption: true,
      currentLowestPrice: { price: 3.49, storeName: "Kroger" },
      buyRecommendationReason: "Lowest price in 3 months!",
    },
    {
      name: "Pasta Sauce",
      category: "Pantry",
      size: "24 oz",
      unit: "jar",
      isValuePick: true,
      currentLowestPrice: { price: 1.99, storeName: "Aldi" },
      buyRecommendationReason: "Stock up price - 30% off!",
    },
    {
      name: "Coffee Beans",
      category: "Pantry",
      size: "12 oz",
      unit: "bag",
      isValuePick: true,
      currentLowestPrice: { price: 6.99, storeName: "Trader Joe's" },
      buyRecommendationReason: "Limited time sale - ends Sunday!",
    },
    {
      name: "Greek Yogurt",
      category: "Dairy",
      size: "32 oz",
      unit: "tub",
      isHealthy: true,
      currentLowestPrice: { price: 3.99, storeName: "Walmart" },
      buyRecommendationReason: "Clearance price - 25% off!",
    },
  ]

  // Limit and format
  return buyAlerts.slice(0, limit).map((item) => ({
    ...item,
    _id: `mock-${Math.random().toString(36).substring(2, 9)}`,
    description: `${item.name} - ${item.size}`,
    type: Math.random() > 0.5 ? "Name Brand" : "Store Brand",
    imageUrl: `/placeholder.svg?height=200&width=200&query=grocery+${item.name.replace(/\s+/g, "+")}`,
    isBuyRecommended: true,
  }))
}

// Helper function to generate price history
const generatePriceHistory = (item) => {
  return {
    weekly: generateWeeklyPriceData(item),
    monthly: generateMonthlyPriceData(item),
    threeMonth: generateThreeMonthPriceData(item),
  }
}

// Helper function to generate weekly price data
const generateWeeklyPriceData = (item) => {
  const basePrice = item.currentLowestPrice?.price || 5.99
  const today = new Date()
  const data = []

  // Generate data for the past 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    // Add some random variation to the price
    const variation = (Math.random() * 0.2 - 0.1) * basePrice
    const price = Number((basePrice + variation).toFixed(2))

    data.push({
      date: date.toISOString(),
      price,
      storeName: getRandomStore(),
    })
  }

  return data
}

// Helper function to generate monthly price data
const generateMonthlyPriceData = (item) => {
  const basePrice = item.currentLowestPrice?.price || 5.99
  const today = new Date()
  const data = []

  // Generate data for the past 30 days (weekly points)
  for (let i = 4; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i * 7)

    // Add some random variation to the price
    const variation = (Math.random() * 0.3 - 0.15) * basePrice
    const price = Number((basePrice + variation).toFixed(2))

    data.push({
      date: date.toISOString(),
      price,
      storeName: getRandomStore(),
    })
  }

  return data
}

// Helper function to generate three-month price data
const generateThreeMonthPriceData = (item) => {
  const basePrice = item.currentLowestPrice?.price || 5.99
  const today = new Date()
  const data = []

  // Generate data for the past 90 days (bi-weekly points)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i * 14)

    // Add some random variation to the price
    const variation = (Math.random() * 0.4 - 0.2) * basePrice
    const price = Number((basePrice + variation).toFixed(2))

    data.push({
      date: date.toISOString(),
      price,
      storeName: getRandomStore(),
    })
  }

  return data
}

// Helper function to calculate price change percentage
const calculatePriceChange = (priceData) => {
  if (!priceData || priceData.length < 2) return 0

  const oldestPrice = priceData[0].price
  const newestPrice = priceData[priceData.length - 1].price

  return Number((((newestPrice - oldestPrice) / oldestPrice) * 100).toFixed(1))
}

// Helper function to find lowest price in price data
const findLowestPrice = (priceData) => {
  if (!priceData || priceData.length === 0) return 0

  return Math.min(...priceData.map((data) => data.price))
}

// Helper function to find highest price in price data
const findHighestPrice = (priceData) => {
  if (!priceData || priceData.length === 0) return 0

  return Math.max(...priceData.map((data) => data.price))
}

// Helper function to get a random store name
const getRandomStore = () => {
  const stores = [
    "Walmart",
    "Target",
    "Kroger",
    "Costco",
    "Whole Foods",
    "Safeway",
    "Trader Joe's",
    "Publix",
    "Albertsons",
    "Aldi",
  ]

  return stores[Math.floor(Math.random() * stores.length)]
}

// Helper function to generate a buy recommendation reason
const generateBuyRecommendationReason = () => {
  const reasons = [
    "Price dropped 15% this week!",
    "Lowest price in 3 months!",
    "Buy one get one free this weekend!",
    "Stock up price - 20% off!",
    "Limited time sale - ends Sunday!",
    "Clearance price - 25% off!",
    "Seasonal low price!",
    "Price match guarantee!",
  ]

  return reasons[Math.floor(Math.random() * reasons.length)]
}

module.exports = {
  fetchStorePrices,
  updatePriceHistory,
  updatePriceTrends,
  getItemsWithPriceAlerts,
  getUserPantryWithTrends,
  getTopPantryItems: getTopPantryItems,
  getBuyAlerts: getBuyAlerts,
  getPriceTrends: getPriceTrends,
  getPriceTrendsForItems,
  getBuyAlertsWithDeals,
  getTopPantryItemsWithPriceInfo,
}
