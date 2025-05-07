const express = require("express")
const Recipe = require("../models/Recipe")
const PantryItem = require("../models/PantryItem")
const auth = require("../middleware/auth")
const router = express.Router()

// Get all recipes for a user
router.get("/", auth, async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.user._id }).sort({ updatedAt: -1 })

    res.json({ recipes })
  } catch (error) {
    console.error("Error getting recipes:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get a single recipe by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, userId: req.user._id })

    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" })
    }

    res.json({ recipe })
  } catch (error) {
    console.error("Error getting recipe:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create a new recipe
router.post("/", auth, async (req, res) => {
  try {
    const { name, description, servings, ingredients, instructions, tags } = req.body

    if (!name || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ message: "Recipe name and at least one ingredient are required" })
    }

    // Process ingredients to match with pantry items
    const processedIngredients = []

    for (const ingredient of ingredients) {
      const { name, quantity, unit } = ingredient

      if (!name || !quantity) {
        return res.status(400).json({ message: "Each ingredient must have a name and quantity" })
      }

      // Try to find matching pantry item
      const searchTerms = name.split(" ").filter((term) => term.length > 3)
      let matchQuery = { name: { $regex: name, $options: "i" } }

      if (searchTerms.length > 1) {
        matchQuery = {
          $or: [{ name: { $regex: name, $options: "i" } }, { name: { $regex: searchTerms.join("|"), $options: "i" } }],
        }
      }

      const matchingItems = await PantryItem.find(matchQuery).limit(3)

      const processedIngredient = {
        name,
        quantity: Number(quantity),
        unit: unit || "",
      }

      if (matchingItems.length > 0) {
        processedIngredient.itemId = matchingItems[0]._id

        if (matchingItems.length > 1) {
          processedIngredient.alternativeItems = matchingItems.slice(1).map((item) => item._id)
        }
      }

      processedIngredients.push(processedIngredient)
    }

    // Create new recipe
    const recipe = new Recipe({
      userId: req.user._id,
      name,
      description: description || "",
      servings: Number(servings) || 4,
      ingredients: processedIngredients,
      instructions: instructions || "",
      tags: tags || [],
      priceHistory: [],
      currentPrice: {
        totalPrice: 0,
        lastUpdated: new Date(),
        percentChange: {
          weekly: null,
          monthly: null,
        },
      },
    })

    // Calculate initial price
    await recipe.calculateCurrentPrice()

    // Save recipe
    await recipe.save()

    // Add to user's recipes
    req.user.recipes.push(recipe._id)
    await req.user.save()

    res.status(201).json({ recipe })
  } catch (error) {
    console.error("Error creating recipe:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update a recipe
router.patch("/:id", auth, async (req, res) => {
  try {
    const { name, description, servings, ingredients, instructions, tags } = req.body

    const recipe = await Recipe.findOne({ _id: req.params.id, userId: req.user._id })

    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" })
    }

    // Update basic fields
    if (name) recipe.name = name
    if (description !== undefined) recipe.description = description
    if (servings) recipe.servings = Number(servings)
    if (instructions !== undefined) recipe.instructions = instructions
    if (tags) recipe.tags = tags

    // Update ingredients if provided
    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      // Process ingredients to match with pantry items
      const processedIngredients = []

      for (const ingredient of ingredients) {
        const { name, quantity, unit } = ingredient

        if (!name || !quantity) {
          return res.status(400).json({ message: "Each ingredient must have a name and quantity" })
        }

        // Try to find matching pantry item
        const searchTerms = name.split(" ").filter((term) => term.length > 3)
        let matchQuery = { name: { $regex: name, $options: "i" } }

        if (searchTerms.length > 1) {
          matchQuery = {
            $or: [
              { name: { $regex: name, $options: "i" } },
              { name: { $regex: searchTerms.join("|"), $options: "i" } },
            ],
          }
        }

        const matchingItems = await PantryItem.find(matchQuery).limit(3)

        const processedIngredient = {
          name,
          quantity: Number(quantity),
          unit: unit || "",
        }

        if (matchingItems.length > 0) {
          processedIngredient.itemId = matchingItems[0]._id

          if (matchingItems.length > 1) {
            processedIngredient.alternativeItems = matchingItems.slice(1).map((item) => item._id)
          }
        }

        processedIngredients.push(processedIngredient)
      }

      recipe.ingredients = processedIngredients
    }

    // Recalculate price
    await recipe.calculateCurrentPrice()

    // Save recipe
    await recipe.save()

    res.json({ recipe })
  } catch (error) {
    console.error("Error updating recipe:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete a recipe
router.delete("/:id", auth, async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndDelete({ _id: req.params.id, userId: req.user._id })

    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" })
    }

    // Remove from user's recipes
    req.user.recipes = req.user.recipes.filter((id) => id.toString() !== req.params.id)
    await req.user.save()

    res.json({ message: "Recipe deleted successfully" })
  } catch (error) {
    console.error("Error deleting recipe:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get recipe price history
router.get("/:id/price-history", auth, async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, userId: req.user._id })

    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" })
    }

    // Format price history for frontend
    const priceHistory = recipe.priceHistory.map((record) => ({
      date: record.date,
      totalPrice: record.totalPrice,
      ingredients: record.ingredientPrices.map((ip) => ({
        name:
          recipe.ingredients.find((i) => i.itemId && i.itemId.toString() === ip.ingredientId.toString())?.name ||
          "Unknown",
        price: ip.price,
        store: ip.store,
      })),
    }))

    res.json({
      recipeId: recipe._id,
      recipeName: recipe.name,
      currentPrice: recipe.currentPrice,
      priceHistory,
    })
  } catch (error) {
    console.error("Error getting recipe price history:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update recipe prices (can be called manually or by a scheduled job)
router.post("/update-prices", auth, async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.user._id })

    if (recipes.length === 0) {
      return res.json({ message: "No recipes found to update" })
    }

    const updatedRecipes = []

    for (const recipe of recipes) {
      await recipe.calculateCurrentPrice()
      await recipe.save()
      updatedRecipes.push({
        id: recipe._id,
        name: recipe.name,
        currentPrice: recipe.currentPrice,
      })
    }

    res.json({
      message: `Updated prices for ${updatedRecipes.length} recipes`,
      recipes: updatedRecipes,
    })
  } catch (error) {
    console.error("Error updating recipe prices:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
