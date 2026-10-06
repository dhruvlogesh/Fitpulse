const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  weight: { type: Number, required: true },   // kg
  note:   { type: String, default: "" },
  date:   { type: Date, default: Date.now }
});

module.exports = mongoose.model("Progress", progressSchema);
