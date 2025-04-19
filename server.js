const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
require("dotenv").config()

// Import routes
const userRoutes = require("./routes/userRoutes")
const pantryItemRoutes = require("./routes/pantryItemRoutes")
const storeRoutes = require("./routes/storeRoutes")
const newsRoutes = require("./routes/newsRoutes")
const dashboardRoutes = require("./routes/dashboardRoutes")
const searchRoutes = require("./routes/searchRoutes")

// Initialize express app
const app = express()

// Middleware
app.use(cors)
app.use(express.json())

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err))

// Routes
app.use("/api/users", userRoutes)
app.use("/api/pantry-items", pantryItemRoutes)
app.use("/api/stores", storeRoutes)
app.use("/api/news", newsRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/search", searchRoutes)

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
