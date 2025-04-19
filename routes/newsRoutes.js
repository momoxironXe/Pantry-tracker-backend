const express = require("express")
const NewsItem = require("../models/NewsItem")
const auth = require("../middleware/auth")
const newsService = require("../services/newsService")
const router = express.Router()

// Get all news items
router.get("/", async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const news = await NewsItem.find().sort({ publishedAt: -1 }).limit(Number.parseInt(limit))

    res.json(news)
  } catch (error) {
    console.error("Error getting news:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get news relevant to user
router.get("/relevant", auth, async (req, res) => {
  try {
    const { shoppingType, zipCode } = req.user

    const news = await newsService.getRelevantNews(shoppingType, zipCode)

    res.json(news)
  } catch (error) {
    console.error("Error getting relevant news:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get a single news item by ID
router.get("/:id", async (req, res) => {
  try {
    const news = await NewsItem.findById(req.params.id)

    if (!news) {
      return res.status(404).json({ message: "News item not found" })
    }

    res.json(news)
  } catch (error) {
    console.error("Error getting news item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create a new news item (admin only)
router.post("/", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const news = new NewsItem(req.body)
    await news.save()

    res.status(201).json(news)
  } catch (error) {
    console.error("Error creating news item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update a news item (admin only)
router.patch("/:id", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const updates = req.body
    const allowedUpdates = ["title", "content", "category", "impactLevel", "affectedItems", "source"]

    const isValidOperation = Object.keys(updates).every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
      return res.status(400).json({ message: "Invalid updates" })
    }

    const news = await NewsItem.findById(req.params.id)

    if (!news) {
      return res.status(404).json({ message: "News item not found" })
    }

    // Apply updates
    allowedUpdates.forEach((update) => {
      if (updates[update] !== undefined) {
        news[update] = updates[update]
      }
    })

    await news.save()

    res.json(news)
  } catch (error) {
    console.error("Error updating news item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete a news item (admin only)
router.delete("/:id", auth, async (req, res) => {
  try {
    // In a real app, you would check if the user is an admin

    const news = await NewsItem.findByIdAndDelete(req.params.id)

    if (!news) {
      return res.status(404).json({ message: "News item not found" })
    }

    res.json({ message: "News item deleted successfully" })
  } catch (error) {
    console.error("Error deleting news item:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
