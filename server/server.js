const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./config/db");
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is not set");
  process.exit(1);
}

connectDB();
console.log("ENV MONGO_URI:", process.env.MONGO_URI ? "FOUND" : "NOT FOUND");


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
