// const express = require("express";)

import express from "express";
import dotenv from "dotenv";

//Routes
import authRoutes from "./routes/auth.route.js";
import { connectDB } from "./lib/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use("/api/auth", authRoutes);

console.log("PortEnvioronment", PORT);

app.listen(PORT, () => {
    console.log("The port is running on http://localhost:" + PORT);

    connectDB();

})

//sSPhqpo38PLpELFS
//mongo pass