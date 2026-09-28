const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./config/db");

connectDB();
console.log("ENV MONGO_URI:", process.env.MONGO_URI ? "FOUND" : "NOT FOUND");


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
