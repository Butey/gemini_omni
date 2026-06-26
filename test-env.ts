import express from "express";
const app = express();
app.get("/test", (req, res) => {
  res.json({
    env: process.env.GEMINI_API_KEY,
    vite: process.env.VITE_GEMINI_API_KEY,
    settings: "placeholder"
  });
});
