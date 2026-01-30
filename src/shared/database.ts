import mongoose from "mongoose";
import dns from "dns";
import config from "../config";
import { User, UserRole } from "../app/models";
import bcrypt from "bcrypt";

// Force Node.js to use IPv4 first and set Google DNS
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function connectMongoDB() {
  try {
    await mongoose.connect(config.database_url as string, {
      serverSelectionTimeoutMS: 30000,
      heartbeatFrequencyMS: 2000,
      family: 4, // Force IPv4
    });
    console.log("MongoDB connected successfully!");

    // await initiateSuperAdmin();
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected from MongoDB");
});

// async function initiateSuperAdmin() {
//   const adminEmail = "admin@saldo.com";
  
//   const existingAdmin = await User.findOne({ email: adminEmail });
//   if (existingAdmin) return;

//   const hashedPassword = await bcrypt.hash(
//     "Admin@123456",
//     Number(config.bcrypt_salt_rounds)
//   );

//   await User.create({
//     fullName: "Super Admin",
//     email: adminEmail,
//     mobileNumber: "0000000000",
//     password: hashedPassword,
//     role: UserRole.ADMIN,
//   });

//   console.log("Super Admin created successfully");
// }

connectMongoDB();

export { connectMongoDB };
