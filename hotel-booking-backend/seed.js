// Run with: node seed.js
// Seeds the local MongoDB with the test user and hotel needed for E2E tests.

const { MongoClient, ObjectId } = require("mongodb");

const MONGO_URI = "mongodb://localhost:27017/hotel-booking";

const testUser = {
  _id: new ObjectId("6554f2ecd4f07417501dcbf1"),
  email: "1@1.com",
  // bcrypt hash of "password123"
  password: "$2a$08$034zqQ5mL/zho/IJLUtbt.TUtBgRaaBj.yg85T40EdYhfGOQelaQa",
  firstName: "e2e_test_firstName",
  lastName: "e2e_test_lastName",
  __v: 0,
};

const testHotel = {
  _id: new ObjectId("6566072befbb78591fadc606"),
  userId: "6554f2ecd4f07417501dcbf1",
  name: "Dublin Getaways",
  city: "Dublin",
  country: "Ireland",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus ultricies sodales rhoncus.",
  type: "All Inclusive",
  adultCount: 2,
  childCount: 3,
  facilities: ["Airport Shuttle", "Family Rooms", "Non-Smoking Rooms", "Spa"],
  pricePerNight: 119,
  starRating: 2,
  imageUrls: [
    "http://res.cloudinary.com/dr55yjjx4/image/upload/v1701185322/a4ypeock0piore5mbnyy.jpg",
    "http://res.cloudinary.com/dr55yjjx4/image/upload/v1701185322/vd9oude4cwkti7s9yp0y.jpg",
  ],
  lastUpdated: new Date(1701185323228),
  __v: 0,
};

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log("✅ Connected to local MongoDB");

    const db = client.db("hotel-booking");

    // Seed user
    const users = db.collection("users");
    await users.deleteOne({ _id: testUser._id });
    await users.insertOne(testUser);
    console.log("✅ Test user seeded  (email: 1@1.com  password: password123)");

    // Seed hotel
    const hotels = db.collection("hotels");
    await hotels.deleteOne({ _id: testHotel._id });
    await hotels.insertOne(testHotel);
    console.log("✅ Test hotel seeded (Dublin Getaways)");

    console.log("\n🎉 Done! You can now run the tests.");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
  } finally {
    await client.close();
  }
}

seed();
