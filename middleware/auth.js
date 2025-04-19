const jwt = require("jsonwebtoken")
const User = require("../models/User")

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "")
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Find the user with the decoded ID and include the token
    const user = await User.findOne({ _id: decoded._id, "tokens.token": token })

    if (!user) {
      throw new Error("User not found")
    }

    // Set the complete user object on the request
    req.user = user
    req.token = token
    next()
  } catch (error) {
    console.error("Auth error:", error.message)
    res.status(401).send({ error: "Please authenticate." })
  }
}

module.exports = auth
