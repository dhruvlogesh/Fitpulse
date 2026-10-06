const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  userId:    String,
  workoutId: String,
  rating:    Number,
  comment:   String
});

module.exports = mongoose.model("Feedback", feedbackSchema);
