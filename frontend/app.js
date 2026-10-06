/* Shared helpers for every FitPulse page.
   Each page's <body> says who may see it: data-role="Member | Coach | Admin | Public | Any" */

function getUser() {
  return {
    id: localStorage.getItem("userId"),
    name: localStorage.getItem("userName"),
    role: localStorage.getItem("role")
  };
}

// stops text from users being treated as HTML
function esc(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function niceDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusClass(status) {
  if (status === "Planned") return "planned";
  if (status === "In Progress") return "progress";
  return "done";
}

function selectWorkout(id) {
  localStorage.setItem("workoutId", id);
}

function logout() {
  localStorage.clear();
  window.location.href = "Home.html";
}

async function getJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function send(url, method, body) {
  const res = await fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data: data };
}

function say(el, text, good) {
  el.textContent = text;
  el.style.color = good ? "green" : "red";
}

const MENUS = {
  Public: [["Home.html", "Home"], ["About.html", "About"], ["Login.html", "Login"], ["Register.html", "Register"]],
  Member: [["MemberDashboard.html", "Dashboard"], ["LogWorkout.html", "Log Workout"], ["MyWorkouts.html", "My Workouts"], ["Progress.html", "Progress"], ["Profile.html", "Profile"]],
  Coach: [["CoachDashboard.html", "Dashboard"], ["AssignedWorkouts.html", "Workouts"], ["Profile.html", "Profile"]],
  Admin: [["AdminDashboard.html", "Dashboard"], ["AllWorkouts.html", "Workouts"], ["Members.html", "Members"], ["Coaches.html", "Coaches"], ["Categories.html", "Categories"], ["Reports.html", "Reports"]]
};

(function startPage() {
  let pageRole = document.body.dataset.role;
  if (!pageRole) return;

  const me = getUser();
  if (pageRole === "Any") pageRole = me.role;

  if (pageRole !== "Public" && (!me.id || me.role !== pageRole)) {
    window.location.href = "Login.html";
    return;
  }

  const page = location.pathname.split("/").pop() || "Home.html";
  const links = MENUS[pageRole].map(([file, label]) =>
    `<a href="${file}" class="${file === page ? "active" : ""}">${label}</a>`
  ).join("");
  const logoutLink = pageRole === "Public" ? "" : `<a href="#" onclick="logout();return false">Logout</a>`;

  document.getElementById("nav").innerHTML =
    `<div class="logo">Fit<span>Pulse</span></div><div>${links}${logoutLink}</div>`;

  document.body.insertAdjacentHTML("beforeend",
    `<footer>© 2026 FitPulse · Workout &amp; Progress Tracking Platform</footer>`);
})();
