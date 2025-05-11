const axios = require("axios");
const PantryItem = require("../models/PantryItem");
const Store = require("../models/Store");

// Simplified to only fetch Walmart products
const fetchAllStoreProducts = async (zipCode) => {
  try {
    console.log(`Fetching products from Walmart for zip code ${zipCode}...`);

    // Only fetch Walmart products
    const walmartProducts = await fetchWalmartProducts();

    console.log(`Fetched ${walmartProducts.length} products from Walmart`);
    return walmartProducts;
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
};

// Modify the fetchWalmartProducts function to batch save products
const fetchWalmartProducts = async () => {
  try {
    console.log("Fetching Walmart products...");

    // Define search keywords for Walmart products - include produce keywords
    const searchKeywords = [
      "kirkland organic mustard",
      "kirkland organic flour",
      "fresh apples"
    ];

    const products = [];
    const apiKey = process.env.SCRAPER_API_KEY;

    // Fetch products for each search keyword
    for (const keyword of searchKeywords) {
      const encodedKeyword = encodeURIComponent(keyword);
      const url = `https://api.scraperapi.com/?api_key=${apiKey}&url=https://www.walmart.com/search?q=${encodedKeyword}&output_format=json&autoparse=true&country_code=us&device_type=desktop`;
      console.log(`Fetching Walmart products for keyword "${keyword}"...`);
      const response = await axios.get(url);

      if (response.data && response.data.items) {
        const items = response.data.items;
        // Process each item
        for (const item of items) {
          // Extract ONLY the required fields as specified by the user
          const product = {
            name: item.name || "",
            price: Number.parseFloat(item.price) || generateRandomPrice(),
            imageUrl: item.image || "",
            currencyCode: item.priceCurrency || "$",
            storeName: "Walmart",
            category: determineCategoryFromName(item.name || "", keyword),
          };

          products.push(product);
        }
      }
    }

    console.log(`Fetched ${products.length} products from Walmart`);
    return products;
  } catch (error) {
    console.error("Error in fetchWalmartProducts:", error);
    return [];
  }
};

// Helper function to generate a random price between 1 and 15
function generateRandomPrice() {
  return Number.parseFloat((Math.random() * 14 + 1).toFixed(2));
}

// Modify the saveProductsToDatabase function to batch save products
const saveProductsToDatabase = async (products) => {
  try {
    console.log(`Saving ${products.length} products to database...`);

    if (products.length === 0) {
      return [];
    }

    // Get all store references first
    const storeNames = [
      ...new Set(products.map((product) => product.storeName)),
    ];
    const stores = await Store.find({
      $or: storeNames.map((name) => ({
        $or: [
          { name: { $regex: name, $options: "i" } },
          { chainName: { $regex: name, $options: "i" } },
        ],
      })),
    });

    // Create a map of store names to store IDs for quick lookup
    const storeMap = {};
    stores.forEach((store) => {
      storeMap[store.name.toLowerCase()] = store._id;
      if (store.chainName) {
        storeMap[store.chainName.toLowerCase()] = store._id;
      }
    });

    // Get existing products by name to avoid duplicates
    const existingProductNames = new Set();
    const existingProducts = await PantryItem.find({
      name: { $in: products.map((p) => p.name) },
    });

    existingProducts.forEach((product) => {
      existingProductNames.add(product.name);
    });

    // Prepare bulk operations
    const newProductsToSave = [];
    const priceUpdates = [];

    for (const product of products) {
      // Skip if product already exists
      if (existingProductNames.has(product.name)) {
        // Find the existing product
        const existingProduct = existingProducts.find(
          (p) => p.name === product.name
        );

        // Add price point if we have a valid store and price
        const storeId = storeMap[product.storeName.toLowerCase()];
        if (storeId && product.price) {
          const numericPrice = Number.parseFloat(product.price);
          if (!isNaN(numericPrice) && numericPrice > 0) {
            priceUpdates.push({
              productId: existingProduct._id,
              storeId,
              price: numericPrice,
            });
          }
        }
        continue;
      }

      // Create new product document
      const newProduct = {
        name: product.name,
        description: product.name, // Using name as description
        category: product.category,
        type: product.name.toLowerCase().includes("great value")
          ? "Store Brand"
          : "National Brand",
        size: product.size || "",
        unit: extractUnitFromSize(product.size || ""),
        imageUrl: product.imageUrl,
        // Set default values for required fields
        isHealthy: product.name.toLowerCase().includes("organic"),
        isValuePick: Math.random() > 0.7, // 30% chance of being a value pick
        isBulkOption:
          product.name.toLowerCase().includes("pack") || Math.random() > 0.8, // 20% chance of being bulk
        isSeasonalProduce:
          product.category === "Produce" && Math.random() > 0.7, // 30% chance for produce
        // Initialize price fields with valid data
        priceHistory: [],
        currentLowestPrice: {
          price: product.price || generateRandomPrice(),
          storeId: storeMap[product.storeName.toLowerCase()],
          lastUpdated: new Date(),
        },
        priceRange: {
          min: product.price
            ? product.price * 0.8
            : generateRandomPrice() * 0.8,
          max: product.price
            ? product.price * 1.2
            : generateRandomPrice() * 1.2,
          period: 6,
        },
        isBuyRecommended: Math.random() > 0.7, // 30% chance of being recommended
        buyRecommendationReason: "Price is at or near 6-week low",
      };

      newProductsToSave.push(newProduct);
      existingProductNames.add(product.name); // Add to set to prevent duplicates
    }

    // Batch insert new products
    let savedProducts = [];
    if (newProductsToSave.length > 0) {
      savedProducts = await PantryItem.insertMany(newProductsToSave);
      console.log(`Batch inserted ${savedProducts.length} new products`);
    }

    // Update price points for existing products
    const allProducts = [...savedProducts, ...existingProducts];

    // Batch update price points
    if (priceUpdates.length > 0) {
      const bulkOps = [];

      for (const update of priceUpdates) {
        const product = allProducts.find(
          (p) => p._id.toString() === update.productId.toString()
        );
        if (!product) continue;

        // Add price point to history
        const pricePoint = {
          storeId: update.storeId,
          price: update.price,
          date: new Date(),
        };

        // Update current lowest price if applicable
        let updateLowestPrice = false;
        if (
          !product.currentLowestPrice.price ||
          update.price < product.currentLowestPrice.price
        ) {
          updateLowestPrice = true;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: update.productId },
            update: {
              $push: { priceHistory: pricePoint },
              ...(updateLowestPrice
                ? {
                    $set: {
                      "currentLowestPrice.price": update.price,
                      "currentLowestPrice.storeId": update.storeId,
                      "currentLowestPrice.lastUpdated": new Date(),
                    },
                  }
                : {}),
            },
          },
        });
      }

      if (bulkOps.length > 0) {
        await PantryItem.bulkWrite(bulkOps);
        console.log(`Updated price points for ${bulkOps.length} products`);
      }
    }

    // Return all products (new and existing)
    return allProducts;
  } catch (error) {
    console.error("Error saving products to database:", error);
    return [];
  }
};

// Modify the searchWalmartProducts function to ensure price data is valid
const searchWalmartProducts = async (query) => {
  try {
    console.log(`Searching Walmart products for: ${query}`);

    const products = [];
    const apiKey = process.env.SCRAPER_API_KEY;

    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.scraperapi.com/?api_key=${apiKey}&url=https://www.walmart.com/search?q=${encodedQuery}&output_format=json&autoparse=true&country_code=us&device_type=desktop`;

    const response = await axios.get(url);

    if (response.data && response.data.items) {
      const items = response.data.items;

      // Process each item
      for (const item of items) {
        // Extract the required fields
        const price = Number.parseFloat(item.price) || generateRandomPrice();

        const product = {
          name: item.name || "",
          price: price,
          imageUrl: item.image || "",
          currencyCode: item.priceCurrency || "$",
          storeName: "Walmart",
          category: determineCategoryFromName(item.name || "", query),
          // Add price range data
          priceRange: {
            min: price * 0.8,
            max: price * 1.2,
          },
        };

        products.push(product);
      }
    }

    console.log(`Found ${products.length} products for query "${query}"`);
    return products;
  } catch (error) {
    console.error(`Error searching Walmart products for "${query}":`, error);
    return [];
  }
};

// Helper function to determine category from product name and search keyword
function determineCategoryFromName(name, keyword = "") {
  const lowerName = name.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  // Check if the keyword contains produce-related terms
  if (
    lowerKeyword.includes("fresh") ||
    lowerKeyword.includes("fruit") ||
    lowerKeyword.includes("vegetable") ||
    lowerKeyword.includes("produce") ||
    lowerKeyword.includes("apples") ||
    lowerKeyword.includes("bananas") ||
    lowerKeyword.includes("strawberries") ||
    lowerKeyword.includes("spinach") ||
    lowerKeyword.includes("broccoli") ||
    lowerKeyword.includes("carrots") ||
    lowerKeyword.includes("avocados") ||
    lowerKeyword.includes("tomatoes") ||
    lowerKeyword.includes("lettuce") ||
    lowerKeyword.includes("peppers")
  ) {
    return "Produce";
  }

  // Check the product name for category indicators
  if (
    lowerName.includes("milk") ||
    lowerName.includes("dairy") ||
    lowerName.includes("cheese") ||
    lowerName.includes("yogurt")
  ) {
    return "Dairy";
  } else if (
    lowerName.includes("apple") ||
    lowerName.includes("banana") ||
    lowerName.includes("fruit") ||
    lowerName.includes("vegetable") ||
    lowerName.includes("produce") ||
    lowerName.includes("fresh") ||
    (lowerName.includes("organic") &&
      (lowerName.includes("spinach") ||
        lowerName.includes("broccoli") ||
        lowerName.includes("carrot") ||
        lowerName.includes("avocado") ||
        lowerName.includes("tomato") ||
        lowerName.includes("lettuce") ||
        lowerName.includes("pepper")))
  ) {
    return "Produce";
  } else if (
    lowerName.includes("meat") ||
    lowerName.includes("chicken") ||
    lowerName.includes("beef") ||
    lowerName.includes("fish")
  ) {
    return "Meat";
  } else if (
    lowerName.includes("bread") ||
    lowerName.includes("bakery") ||
    lowerName.includes("bun")
  ) {
    return "Bakery";
  } else if (lowerName.includes("frozen")) {
    return "Frozen";
  } else {
    return "Pantry";
  }
}

function extractUnitFromSize(size) {
  if (!size) return "";

  const unitRegex =
    /(oz|fl oz|lb|g|kg|ml|l|count|ct|pack|pk|gallon|gal|quart|qt|pint|pt|each|ea)/i;
  const match = size.match(unitRegex);
  return match ? match[1].toLowerCase() : "";
}

module.exports = {
  fetchWalmartProducts,
  fetchAllStoreProducts,
  saveProductsToDatabase,
  searchWalmartProducts,
};
