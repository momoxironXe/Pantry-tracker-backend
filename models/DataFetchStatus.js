const mongoose = require("mongoose")

const dataFetchStatusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  message: {
    type: String,
    default: "Initializing data fetch...",
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  error: {
    type: String,
  },
})

// Index to automatically expire documents after 7 days
dataFetchStatusSchema.index({ startedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 })

const DataFetchStatus = mongoose.model("DataFetchStatus", dataFetchStatusSchema)

module.exports = DataFetchStatus
