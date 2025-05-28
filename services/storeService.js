const axios = require("axios")
const Store = require("../models/Store")

// Get nearby stores based on zip code using Google Places API
const getNearbyStores = async (zipCode, {lat, lng}, radius = 32000) => {
  try {

    // Now search for grocery stores near these coordinates
    const placesResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&keyword=pantry|grocery|food&key=${process.env.GOOGLE_MAPS_API_KEY}`,
    )

    if (placesResponse.data.status === "ZERO_RESULTS") {
      console.warn(`No stores found for zip code ${zipCode} and radius ${radius}.`)
      return [] // Return an empty array if no results are found
    }

    if (placesResponse.data.status !== "OK") {
      throw new Error(`Places API failed: ${placesResponse.data.status}`)
    }

    // Process and save each store
    const stores = []

    // Limit to maximum 10 stores
    const maxStores = 10
    const placesToProcess = placesResponse.data.results.slice(0, maxStores)

    for (const place of placesToProcess) {
      // Check if store already exists in our database
      let store = await Store.findOne({ placeId: place.place_id })

      if (!store) {
        // Get more details about the place
        const detailsResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,opening_hours,price_level&key=${process.env.GOOGLE_MAPS_API_KEY}`,
        )

        if (detailsResponse.data.status !== "OK") {
          console.warn(`Could not get details for ${place.name}: ${detailsResponse.data.status}`)
          continue
        }

        const details = detailsResponse.data.result

        // Determine store type based on name
        let storeType = "Supermarket"
        if (place.name.includes("Costco") || place.name.includes("Sam's Club") || place.name.includes("BJ's")) {
          storeType = "Warehouse Club"
        } else if (place.name.includes("Aldi") || place.name.includes("Lidl") || place.name.includes("Dollar")) {
          storeType = "Discount Store"
        } else if (
          place.name.includes("Whole Foods") ||
          place.name.includes("Trader Joe's") ||
          place.name.includes("Market")
        ) {
          storeType = "Specialty Store"
        }

        // Determine chain name
        let chainName = place.name
        if (place.name.includes("Walmart")) chainName = "Walmart"
        else if (place.name.includes("Target")) chainName = "Target"
        else if (place.name.includes("Kroger")) chainName = "Kroger"
        else if (place.name.includes("Safeway")) chainName = "Safeway"
        else if (place.name.includes("Publix")) chainName = "Publix"
        else if (place.name.includes("Whole Foods")) chainName = "Whole Foods"
        else if (place.name.includes("Trader Joe's")) chainName = "Trader Joe's"
        else if (place.name.includes("Aldi")) chainName = "Aldi"
        else if (place.name.includes("Costco")) chainName = "Costco"

        // Determine if we have API support for this store
        let apiSupport = {
          hasDirectApi: false,
          apiType: "None",
        }

        if (chainName === "Walmart") {
          apiSupport = {
            hasDirectApi: true,
            apiType: "Walmart",
          }
        } else if (chainName === "Target") {
          apiSupport = {
            hasDirectApi: true,
            apiType: "Target",
          }
        } else if (chainName === "Kroger") {
          apiSupport = {
            hasDirectApi: true,
            apiType: "Kroger",
          }
        }

        // Format hours if available
        const hours = {}
        if (details.opening_hours && details.opening_hours.weekday_text) {
          const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
          details.opening_hours.weekday_text.forEach((text, index) => {
            hours[daysOfWeek[index]] = text.split(": ")[1]
          })
        }

        // Create new store
        store = new Store({
          name: place.name,
          address: {
            formattedAddress: details.formatted_address || place.vicinity,
            zipCode,
          },
          location: {
            type: "Point",
            coordinates: [place.geometry.location.lng, place.geometry.location.lat],
          },
          placeId: place.place_id,
          chainName,
          storeType,
          phone: details.formatted_phone_number,
          website: details.website,
          hours,
          rating: place.rating,
          priceLevel: details.price_level || place.price_level,
          apiSupport,
        })
        await store.save()
      }

      stores.push(store)
    }

    return stores
  } catch (error) {
    console.error("Error in getNearbyStores:", error)
    throw error
  }
}

// Get stores by zip code from our database
const getStoresByZipCode = async (zipCode) => {
  try {

    // First, find the coordinates for the given zip code
    const geocodeResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${zipCode}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
    )

    if (geocodeResponse.data.status !== "OK") {
      throw new Error(`Geocoding failed: ${geocodeResponse.data.status}`)
    }

    const { lat, lng } = geocodeResponse.data.results[0].geometry.location

    // Use MongoDB's $geoNear to find stores sorted by distance
    const existingStores = await Store.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distance", // Field to store the calculated distance
          spherical: true,
          maxDistance: 32000, // Optional: Limit to 32 km (20 miles)
        },
      },
      { $limit: 10 }, // Limit to 10 stores
    ])

    // If we have at least 3 stores, return them
    if (existingStores.length >= 3) {
      return existingStores
    }

    // Otherwise, fetch new stores from Google API
    return await getNearbyStores(zipCode, {lat, lng})
  } catch (error) {
    console.error("Error in getStoresByZipCode:", error)
    throw error
  }
}

// Get stores by user's shopping type preference
const getStoresByUserPreference = async (zipCode, shoppingType) => {
  try {
    console.log(`Getting stores for ZIP: ${zipCode}, shopping type: ${shoppingType}`)

    if (!zipCode) {
      console.error("No zipCode provided to getStoresByUserPreference")
      return []
    }

    const stores = await getStoresByZipCode(zipCode)

    // Default shopping type if not provided
    const userShoppingType = shoppingType || "bulk"

    // Filter or sort stores based on shopping type
    if (userShoppingType === "health") {
      // Prioritize stores like Whole Foods, Trader Joe's, etc.
      stores.sort((a, b) => {
        const healthyStores = ["Whole Foods", "Trader Joe's", "Sprouts"]
        const aIsHealthy = healthyStores.some((name) => a.name.includes(name))
        const bIsHealthy = healthyStores.some((name) => b.name.includes(name))

        if (aIsHealthy && !bIsHealthy) return -1
        if (!aIsHealthy && bIsHealthy) return 1
        return 0
      })
    } else if (userShoppingType === "bulk") {
      // Prioritize warehouse clubs
      stores.sort((a, b) => {
        if (a.storeType === "Warehouse Club" && b.storeType !== "Warehouse Club") return -1
        if (a.storeType !== "Warehouse Club" && b.storeType === "Warehouse Club") return 1
        return 0
      })
    } else if (userShoppingType === "value") {
      // Prioritize discount stores
      stores.sort((a, b) => {
        if (a.storeType === "Discount Store" && b.storeType !== "Discount Store") return -1
        if (a.storeType !== "Discount Store" && b.storeType === "Discount Store") return 1

        // If price level is available, use it as secondary sort
        if (a.priceLevel && b.priceLevel) {
          return a.priceLevel - b.priceLevel
        }

        return 0
      })
    }

    return stores
  } catch (error) {
    console.error("Error in getStoresByUserPreference:", error)
    return []
  }
}

module.exports = {
  getNearbyStores,
  getStoresByZipCode,
  getStoresByUserPreference,
}
