const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const userRoutes = require("./routes/userRoutes")
const storeRoutes = require("./routes/storeRoutes")
const pantryItemRoutes = require("./routes/pantryItemRoutes")
const newsRoutes = require("./routes/newsRoutes")
const priceAlertRoutes = require("./routes/PriceAlertRoutes")
const recipeRoutes = require("./routes/recipeRoutes")
const bulkBuyRoutes = require("./routes/bulkBuyRoutes")
const dashboardRoutes = require("./routes/dashboardRoutes")
const searchRoutes = require("./routes/searchRoutes")

// Load environment variables
dotenv.config()

// Create Express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`)
  next()
})

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Routes
app.use("/api/users", userRoutes)
app.use("/api/stores", storeRoutes)
app.use("/api/pantry-items", pantryItemRoutes)
app.use("/api/news", newsRoutes)
app.use("/api/price-alerts", priceAlertRoutes)
app.use("/api/recipes", recipeRoutes)
app.use("/api/bulk-buy", bulkBuyRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/search", searchRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", environment: process.env.NODE_ENV })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Something went wrong!", error: err.message })
})

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})
