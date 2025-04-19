const axios = require("axios")
const PantryItem = require("../models/PantryItem")
const Store = require("../models/Store")

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
const getTopPantryItems = async (zipCode, shoppingType, category = "Pantry", limit = 10, options = {}) => {
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
const getBuyAlerts = async (zipCode, shoppingType, limit = 4) => {
  try {
    console.log(`Getting buy alerts for ZIP: ${zipCode}, shopping type: ${shoppingType}`)

    if (!zipCode) {
      console.error("No zipCode provided to getBuyAlerts")
      return []
    }

    // Get all pantry items that are recommended for buying
    const pantryItems = await getTopPantryItems(zipCode, shoppingType, "Pantry", 20)
    const produceItems = await getTopPantryItems(zipCode, shoppingType, "Produce", 20)

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

module.exports = {
  fetchStorePrices,
  updatePriceHistory,
  getTopPantryItems,
  getBuyAlerts,
}
