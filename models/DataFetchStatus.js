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

// Add a method to update progress
dataFetchStatusSchema.statics.updateProgress = async function (userId, progress, message) {
  try {
    return await this.findOneAndUpdate(
      { userId },
      {
        progress,
        message,
        ...(progress >= 100 ? { status: "completed", completedAt: new Date() } : {}),
      },
      { new: true },
    )
  } catch (error) {
    console.error(`Error updating progress for user ${userId}:`, error)
    return null
  }
}

const DataFetchStatus = mongoose.model("DataFetchStatus", dataFetchStatusSchema)

module.exports = DataFetchStatus
