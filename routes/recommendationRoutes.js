const express = require("express");
const router = express.Router();
const {
  getRecommendations,
  getRecommendationsForUser,
} = require("../controllers/recommendationController");

// GET recommendations based on outfit
router.get("/user/:userId", getRecommendationsForUser);
router.get("/:outfitId", getRecommendations);

module.exports = router;