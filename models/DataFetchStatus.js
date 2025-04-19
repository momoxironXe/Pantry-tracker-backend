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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Update the updatedAt field before saving
dataFetchStatusSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

const DataFetchStatus = mongoose.model("DataFetchStatus", dataFetchStatusSchema)

module.exports = DataFetchStatus
