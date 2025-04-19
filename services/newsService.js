const axios = require("axios")
const NewsItem = require("../models/NewsItem")

// Function to fetch grocery and food industry news
const fetchGroceryNews = async () => {
  try {
    // In a production environment, you would use a real news API like NewsAPI.org
    // For now, we'll create some mock news data

    const mockNews = [
      {
        title: "Hurricane Alert Affecting Florida Tomato Crops",
        content:
          "Recent hurricane activity in Florida is expected to impact tomato supplies nationwide, with potential price increases of 15-20% over the next month.",
        category: "Weather",
        impactLevel: "High",
        affectedItems: ["Tomatoes"],
        source: "National Weather Service",
        publishedAt: new Date(),
      },
      {
        title: "Trucking Delays Impact Bulk Rice at Costco",
        content:
          "Ongoing transportation issues have led to supply chain disruptions for bulk rice products at warehouse clubs. Expect limited availability for the next 2-3 weeks.",
        category: "Supply Chain",
        impactLevel: "Medium",
        affectedItems: ["Rice"],
        source: "Supply Chain Quarterly",
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      },
      {
        title: "New Tariff on Lentils Could Raise Prices",
        content:
          "Recently implemented import tariffs on lentils are expected to increase retail prices by approximately 8% starting next month.",
        category: "Economic",
        impactLevel: "Medium",
        affectedItems: ["Lentils", "Dried Beans"],
        source: "Economic Times",
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        title: "Seasonal Shift: Apple Prices Expected to Drop",
        content:
          "With the fall harvest season approaching, apple prices are projected to decrease by 10-15% in the coming weeks as new crop varieties hit store shelves.",
        category: "Seasonal",
        impactLevel: "Low",
        affectedItems: ["Apples"],
        source: "Produce Market Guide",
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        title: "Egg Production Recovering After Avian Flu Outbreak",
        content:
          "Egg supplies are stabilizing following last quarter's avian flu concerns, with prices expected to normalize by month's end.",
        category: "Health",
        impactLevel: "Medium",
        affectedItems: ["Eggs"],
        source: "Agricultural Daily",
        publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      },
    ]

    // Save these news items to the database if they don't already exist
    for (const news of mockNews) {
      const existingNews = await NewsItem.findOne({ title: news.title })
      if (!existingNews) {
        await NewsItem.create(news)
      }
    }

    // Return the latest news items
    return await NewsItem.find().sort({ publishedAt: -1 }).limit(10)
  } catch (error) {
    console.error("Error fetching grocery news:", error)
    throw error
  }
}

// Function to get news relevant to a user's shopping preferences
const getRelevantNews = async (shoppingType, zipCode) => {
  try {
    console.log(`Getting relevant news for shopping type: ${shoppingType}, ZIP: ${zipCode}`)

    // Default shopping type if not provided
    const userShoppingType = shoppingType || "bulk"

    // Ensure we have fresh news
    await fetchGroceryNews()

    // Get all news from the last 7 days
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const newsItems = await NewsItem.find({
      publishedAt: { $gte: oneWeekAgo },
    }).sort({ publishedAt: -1 })

    // Filter and prioritize news based on shopping type
    if (userShoppingType === "health") {
      // Prioritize health-related news
      newsItems.sort((a, b) => {
        const aIsHealth = a.category === "Health" || a.category === "Organic"
        const bIsHealth = b.category === "Health" || b.category === "Organic"

        if (aIsHealth && !bIsHealth) return -1
        if (!aIsHealth && bIsHealth) return 1
        return 0
      })
    } else if (userShoppingType === "bulk") {
      // Prioritize supply chain and bulk product news
      newsItems.sort((a, b) => {
        const aIsRelevant =
          a.category === "Supply Chain" ||
          a.affectedItems.some(
            (item) =>
              item.toLowerCase().includes("bulk") ||
              item.toLowerCase().includes("rice") ||
              item.toLowerCase().includes("beans"),
          )
        const bIsRelevant =
          b.category === "Supply Chain" ||
          a.affectedItems.some(
            (item) =>
              item.toLowerCase().includes("bulk") ||
              item.toLowerCase().includes("rice") ||
              item.toLowerCase().includes("beans"),
          )

        if (aIsRelevant && !bIsRelevant) return -1
        if (!aIsRelevant && bIsRelevant) return 1
        return 0
      })
    } else if (userShoppingType === "value") {
      // Prioritize economic and price-related news
      newsItems.sort((a, b) => {
        const aIsRelevant = a.category === "Economic" || a.content.toLowerCase().includes("price")
        const bIsRelevant = b.category === "Economic" || b.content.toLowerCase().includes("price")

        if (aIsRelevant && !bIsRelevant) return -1
        if (!aIsRelevant && bIsRelevant) return 1
        return 0
      })
    }

    // Format the news items for display
    return newsItems.slice(0, 5).map((item) => ({
      id: item._id,
      title: item.title,
      summary: item.content.length > 100 ? `${item.content.substring(0, 97)}...` : item.content,
      category: item.category,
      impactLevel: item.impactLevel,
      publishedAt: item.publishedAt,
    }))
  } catch (error) {
    console.error("Error getting relevant news:", error)
    return []
  }
}

module.exports = {
  fetchGroceryNews,
  getRelevantNews,
}
