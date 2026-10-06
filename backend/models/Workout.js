const mongoose = require("mongoose");

const workoutSchema = new mongoose.Schema({
  workoutId:   { type: String, unique: true },
  userId:      { type: String, required: true },      // the member who logged it
  coachId:     { type: String, default: "" },         // coach assigned to review it
  title:       { type: String, required: true },
  category:    { type: String, required: true },      // Strength, Cardio, Yoga, HIIT
  description: { type: String, default: "" },         // exercises, sets, reps, notes
  intensity:   { type: String, required: true },      // Light, Moderate, Intense
  duration:    { type: Number, required: true },      // minutes
  calories:    { type: Number, default: 0 },
  date:        { type: Date, default: Date.now },
  status:      { type: String, default: "Planned" },  // Planned, In Progress, Completed
  remarks:     { type: String, default: "" }          // coach feedback
});

module.exports = mongoose.model("Workout", workoutSchema);
