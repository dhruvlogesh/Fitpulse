require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const { sendWelcomeEmail, sendLoginEmail } = require("./mailer");

const User = require("./models/User");
const Workout = require("./models/Workout");
const Feedback = require("./models/Feedback");
const Progress = require("./models/Progress");

const app = express();
app.use(express.json());
app.use(cors());
const FRONTEND = __dirname + "/../frontend";
app.use(express.static(FRONTEND));

app.get("/", (req, res) => {
  res.sendFile("Home.html", { root: FRONTEND });
});

const STATUSES = ["Planned", "In Progress", "Completed"];
const CATEGORIES = ["Strength", "Cardio", "Yoga", "HIIT"];

/* ---------- small helpers ---------- */

// wraps every route so we don't repeat try/catch everywhere
const safe = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};

const countStatus = (list, status) => list.filter(w => w.status === status).length;
const totalOf = (list, field) => list.reduce((sum, w) => sum + (w[field] || 0), 0);

// adds the member's name to each workout so admins/coaches see names, not just ids
async function addMemberNames(workouts) {
  const ids = [...new Set(workouts.map(w => w.userId))];
  const members = await User.find({ userId: { $in: ids } });
  const names = {};
  members.forEach(m => (names[m.userId] = m.name));
  return workouts.map(w => ({ ...w.toObject(), memberName: names[w.userId] || w.userId }));
}

/* ---------- database ---------- */

mongoose
  .connect("mongodb://127.0.0.1:27017/fitpulse")
  .then(async () => {
    console.log("MongoDB Connected");

    // make sure there is always one admin to log in with
    const admin = await User.findOne({ role: "Admin" });
    if (!admin) {
      await User.create({
        userId: "admin",
        name: "Admin",
        email: "admin@fitpulse.com",
        phone: "0000000000",
        password: "admin123",
        role: "Admin"
      });
      console.log("Default admin created -> userId: admin | password: admin123");
    }
  })
  .catch(err => console.log(err));

/* ---------- auth ---------- */

app.post("/register", safe(async (req, res) => {
  const { userId, name, email, phone, password, role } = req.body;

  if (!userId || !name || !email || !phone || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (!["Member", "Coach"].includes(role)) {
    return res.status(400).json({ message: "Choose Member or Coach as account type" });
  }

  if (await User.findOne({ userId })) {
    return res.status(409).json({ message: "That User ID is already taken" });
  }
  if (await User.findOne({ email })) {
    return res.status(409).json({ message: "Email already exists" });
  }

  await User.create({
    userId, name, email, phone, role,
    password
  });

  const emailSent = await sendWelcomeEmail({ name, email, role });
  if (emailSent) {
    res.json({ message: `Registration successful! A welcome email is on its way to ${email}` });
  } else {
    res.json({ message: "Registration successful (the welcome email could not be sent right now)" });
  }
}));

app.post("/login", safe(async (req, res) => {
  const { userId, password, role } = req.body;

  if (!userId || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const user = await User.findOne({ userId, role });
  if (!user || password !== user.password) {
    return res.status(401).json({ message: "Invalid login details" });
  }

  // Send login email in background without await (skip for Admin)
  if (user.role !== "Admin") {
    sendLoginEmail(user);
  }

  res.json({
    message: "Login successful",
    userId: user.userId,
    name: user.name,
    role: user.role
  });
}));

app.get("/user/:userId", safe(async (req, res) => {
  const user = await User.findOne({ userId: req.params.userId }).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
}));

/* ---------- workouts (member) ---------- */

app.post("/workouts", safe(async (req, res) => {
  const { userId, title, category, description, intensity, duration, calories, date, status } = req.body;

  if (!userId || !title || !category || !intensity || !duration) {
    return res.status(400).json({ message: "Please fill all required fields" });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Unknown workout category" });
  }
  if (Number(duration) <= 0) {
    return res.status(400).json({ message: "Duration must be more than 0 minutes" });
  }

  await Workout.create({
    workoutId: "WRK" + Date.now(),
    userId, title, category, intensity,
    description: description || "",
    duration: Number(duration),
    calories: Number(calories) || 0,
    date: date ? new Date(date) : new Date(),
    status: status === "Completed" ? "Completed" : "Planned"
  });

  res.json({ message: "Workout saved successfully" });
}));

app.get("/workouts/user/:userId", safe(async (req, res) => {
  const workouts = await Workout.find({ userId: req.params.userId }).sort({ date: -1 });
  res.json(workouts);
}));

app.get("/workout/:id", safe(async (req, res) => {
  const workout = await Workout.findOne({ workoutId: req.params.id });
  if (!workout) return res.status(404).json({ message: "Workout not found" });
  res.json(workout);
}));

// member taps "Mark as done"
app.put("/workout/:id/done", safe(async (req, res) => {
  const workout = await Workout.findOneAndUpdate(
    { workoutId: req.params.id },
    { status: "Completed" },
    { new: true }
  );
  if (!workout) return res.status(404).json({ message: "Workout not found" });
  res.json({ message: "Nice work! Workout marked as completed" });
}));

app.get("/dashboard/:userId", safe(async (req, res) => {
  const workouts = await Workout.find({ userId: req.params.userId });
  const done = workouts.filter(w => w.status === "Completed");

  res.json({
    total: workouts.length,
    planned: countStatus(workouts, "Planned"),
    progress: countStatus(workouts, "In Progress"),
    completed: done.length,
    minutes: totalOf(done, "duration"),
    calories: totalOf(done, "calories")
  });
}));

/* ---------- progress (body weight log) ---------- */

app.post("/progress", safe(async (req, res) => {
  const { userId, weight, note } = req.body;

  if (!userId || !weight || Number(weight) <= 0) {
    return res.status(400).json({ message: "Please enter a valid weight" });
  }

  await Progress.create({ userId, weight: Number(weight), note: note || "" });
  res.json({ message: "Progress saved. Keep going!" });
}));

app.get("/progress/:userId", safe(async (req, res) => {
  const entries = await Progress.find({ userId: req.params.userId }).sort({ date: -1 });
  res.json(entries);
}));

/* ---------- feedback ---------- */

app.post("/feedback", safe(async (req, res) => {
  const { userId, workoutId, rating, comment } = req.body;

  if (!userId || !workoutId || !rating || !comment) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // one feedback per member per workout - sending again just updates it
  await Feedback.findOneAndUpdate(
    { userId, workoutId },
    { userId, workoutId, rating: Number(rating), comment },
    { upsert: true }
  );

  res.json({ message: "Thanks! Your feedback has been saved" });
}));

/* ---------- coach ---------- */

app.get("/assigned-workouts/:coachId", safe(async (req, res) => {
  const workouts = await Workout.find({ coachId: req.params.coachId }).sort({ date: -1 });
  res.json(await addMemberNames(workouts));
}));

app.get("/coach-dashboard/:coachId", safe(async (req, res) => {
  const workouts = await Workout.find({ coachId: req.params.coachId });

  res.json({
    assigned: workouts.length,
    progress: countStatus(workouts, "In Progress"),
    completed: countStatus(workouts, "Completed")
  });
}));

// coach updates status + leaves remarks
app.put("/workout/:id", safe(async (req, res) => {
  const { status, remarks } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const workout = await Workout.findOneAndUpdate(
    { workoutId: req.params.id },
    { status, remarks },
    { new: true }
  );
  if (!workout) return res.status(404).json({ message: "Workout not found" });

  res.json({ message: "Workout updated successfully" });
}));

/* ---------- admin ---------- */

app.get("/workouts", safe(async (req, res) => {
  const workouts = await Workout.find().sort({ date: -1 });
  res.json(await addMemberNames(workouts));
}));

app.get("/members", safe(async (req, res) => {
  res.json(await User.find({ role: "Member" }).select("-password"));
}));

app.get("/coaches", safe(async (req, res) => {
  res.json(await User.find({ role: "Coach" }).select("-password"));
}));

app.put("/assign-workout/:id", safe(async (req, res) => {
  const { coachId } = req.body;

  if (!(await User.findOne({ userId: coachId, role: "Coach" }))) {
    return res.status(404).json({ message: "Coach not found" });
  }

  const workout = await Workout.findOneAndUpdate(
    { workoutId: req.params.id },
    { coachId },
    { new: true }
  );
  if (!workout) return res.status(404).json({ message: "Workout not found" });

  res.json({ message: "Coach assigned successfully" });
}));

app.get("/admin-dashboard", safe(async (req, res) => {
  const workouts = await Workout.find();

  res.json({
    total: workouts.length,
    planned: countStatus(workouts, "Planned"),
    progress: countStatus(workouts, "In Progress"),
    completed: countStatus(workouts, "Completed"),
    members: await User.countDocuments({ role: "Member" }),
    coaches: await User.countDocuments({ role: "Coach" })
  });
}));

app.get("/workout-reports", safe(async (req, res) => {
  const workouts = await Workout.find();
  const feedback = await Feedback.find();

  const byCategory = {};
  CATEGORIES.forEach(c => (byCategory[c] = workouts.filter(w => w.category === c).length));

  const avgRating = feedback.length
    ? (totalOf(feedback, "rating") / feedback.length).toFixed(1)
    : 0;

  res.json({
    total: workouts.length,
    planned: countStatus(workouts, "Planned"),
    progress: countStatus(workouts, "In Progress"),
    completed: countStatus(workouts, "Completed"),
    byCategory,
    avgRating,
    feedbackCount: feedback.length
  });
}));

/* ---------- public numbers for the home page ---------- */

app.get("/public-stats", safe(async (req, res) => {
  const workouts = await Workout.find();
  const done = workouts.filter(w => w.status === "Completed");

  res.json({
    members: await User.countDocuments({ role: "Member" }),
    total: workouts.length,
    completed: done.length,
    minutes: totalOf(done, "duration")
  });
}));

app.listen(5000, () => {
  console.log("FitPulse running on http://localhost:5000");
});
