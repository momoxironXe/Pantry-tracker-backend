const axios = require("axios")
const NewsItem = require("../models/NewsItem")

// Load environment variables (optional – only if you use dotenv)
require("dotenv").config()

const NEWS_API_KEY = process.env.NEWS_API_KEY
// Adjusted query URL - still NewsAPI – our query itself will focus on pantry-related content
const NEWS_API_URL = "https://newsapi.org/v2/everything"

// Function to fetch pantry related news articles
const fetchGroceryNews = async () => {
  try {
    if (!NEWS_API_KEY) {
      throw new Error("NEWS_API_KEY is not defined in environment variables")
    }
    
    // Define query parameters to focus on food/grocery/agriculture/pantry related news
    const params = {
      q: 'pantry AND (food OR grocery)',
      language: "en",
      sortBy: "publishedAt",
      pageSize: 10,
      apiKey: NEWS_API_KEY,
    }
    
    const response = await axios.get(NEWS_API_URL, { params })
    const articles = response.data.articles || []

    console.log("==================================")
    console.log("articles fetched from NewsAPI:")
    console.log(articles)
    
    // Define a list of pantry products to look for in the article content
    const pantryProducts = [
      "rice", "beans", "pasta", "bread", "cereal", 
      "flour", "sugar", "oil", "salt", "milk", "eggs", "cheese"
    ]
    
    // Map NewsAPI fields to your model's fields and detect pantry products
    const newsData = articles.map(article => {
      const content = article.description || article.content || ""
      const lowerContent = content.toLowerCase()
  
      // Determine category based on keywords in the content
      let category = "Supply Chain" // default category
      if (lowerContent.includes("health") || lowerContent.includes("organic")) {
          category = "Health"
      } else if (lowerContent.includes("weather") || lowerContent.includes("storm") || lowerContent.includes("rain")) {
          category = "Weather"
      } else if (lowerContent.includes("price") || lowerContent.includes("economic")) {
          category = "Economic"
      } else if (lowerContent.includes("season") || lowerContent.includes("summer") || lowerContent.includes("winter")) {
          category = "Seasonal"
      }
  
      // Determine impact level based on content length as a simple example
      let impactLevel = "Medium"
      if (content.length > 500) {
          impactLevel = "High"
      } else if (content.length < 100) {
          impactLevel = "Low"
      }
  
      // Fill affectedItems only with pantry products found in the content
      const affectedItems = pantryProducts.filter(product => lowerContent.includes(product))
  
      return {
          title: article.title,
          content: content,
          url: article.url || "",
          category: category,
          impactLevel: impactLevel,
          affectedItems: affectedItems, // now populated with pantry related product names, if any
          source: article.source.name,
          publishedAt: new Date(article.publishedAt),
      }
    })
    
    // Save these news items to the database if they don't already exist
    for (const news of newsData) {
      const existingNews = await NewsItem.findOne({ title: news.title })
      if (!existingNews) {
        await NewsItem.create(news)
      }
    }
    
    // Return the latest news items from the database
    return await NewsItem.find().sort({ publishedAt: -1 }).limit(10)
  } catch (error) {
    console.error("Error fetching pantry news:", error)
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

    let newsItems = await NewsItem.find({
      publishedAt: { $gte: oneWeekAgo },
    }).sort({ publishedAt: -1 })


    // Filter and prioritize news based on shopping type
    if (userShoppingType === "health") {
      newsItems.sort((a, b) => {
        const aIsHealth = a.category === "Health" || a.category === "Organic"
        const bIsHealth = b.category === "Health" || b.category === "Organic"
        if (aIsHealth && !bIsHealth) return -1
        if (!aIsHealth && bIsHealth) return 1
        return 0
      })
    } else if (userShoppingType === "bulk") {
      newsItems.sort((a, b) => {
        const aIsRelevant =
          a.category === "Supply Chain" ||
          a.affectedItems.some(item =>
            item.toLowerCase().includes("bulk") ||
            item.toLowerCase().includes("rice") ||
            item.toLowerCase().includes("beans")
          )
        const bIsRelevant =
          b.category === "Supply Chain" ||
          b.affectedItems.some(item =>
            item.toLowerCase().includes("bulk") ||
            item.toLowerCase().includes("rice") ||
            item.toLowerCase().includes("beans")
          )
        if (aIsRelevant && !bIsRelevant) return -1
        if (!aIsRelevant && bIsRelevant) return 1
        return 0
      })
    } else if (userShoppingType === "value") {
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
      url: item.url,
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