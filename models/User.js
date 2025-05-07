const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const searchHistorySchema = new mongoose.Schema({
  query: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PantryItem",
    },
  ],
})

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  verificationCode: {
    code: String,
    expiresAt: Date,
  },
  zipCode: {
    type: String,
    required: true,
    trim: true,
  },
  shoppingStyle: {
    type: String,
    enum: ["budget", "prepper", "seasonal", "homesteader", "clean", "bulk"],
    default: "budget",
  },
  preferences: {
    preferredStores: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
      },
    ],
    dietaryPreferences: {
      type: [String],
      enum: ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Organic", "None"],
      default: ["None"],
    },
    alertCategories: {
      type: [String],
      enum: ["Meat", "Produce", "Dairy", "Pantry", "Grains", "Canned", "Frozen", "Baking", "All"],
      default: ["All"],
    },
    notificationPreferences: {
      email: {
        weeklyDeals: {
          type: Boolean,
          default: true,
        },
        priceAlerts: {
          type: Boolean,
          default: true,
        },
        newsUpdates: {
          type: Boolean,
          default: false,
        },
      },
      sms: {
        enabled: {
          type: Boolean,
          default: false,
        },
        priceAlerts: {
          type: Boolean,
          default: false,
        },
        stockAlerts: {
          type: Boolean,
          default: false,
        },
      },
    },
  },
  pantryItems: [
    {
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PantryItem",
      },
      quantity: {
        type: Number,
        default: 1,
      },
      monthlyUsage: {
        type: Number,
        default: 1,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  recipes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
    },
  ],
  searchHistory: [searchHistorySchema],
  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
    },
  ],
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
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now()

  // Hash the password before saving if it's modified
  if (this.isModified("password")) {
    bcrypt.hash(this.password, 10, (err, hash) => {
      if (err) return next(err)
      this.password = hash
      next()
    })
  } else {
    next()
  }
})

// Method to generate auth token
userSchema.methods.generateAuthToken = async function () {
  const token = jwt.sign({ _id: this._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  })

  this.tokens = this.tokens.concat({ token })
  await this.save()

  return token
}

// Method to check password
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password)
}

// Method to return user profile without sensitive data
userSchema.methods.toJSON = function () {
  const userObject = this.toObject()

  delete userObject.password
  delete userObject.tokens

  return userObject
}

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email })
  if (!user) {
    throw new Error("Invalid login credentials")
  }

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    throw new Error("Invalid login credentials")
  }

  return user
}

const User = mongoose.model("User", userSchema)

module.exports = User
