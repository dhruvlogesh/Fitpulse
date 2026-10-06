const nodemailer = require("nodemailer");

// Nodemailer Gmail transporter setup
const transportOptions = {
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
};

// Handle self-signed certificate error on restricted networks (for local development only)
if (process.env.MAIL_ALLOW_SELF_SIGNED === "true") {
  transportOptions.tls = {
    rejectUnauthorized: false
  };
}

const transporter = nodemailer.createTransport(transportOptions);

/* ---------- small helpers ---------- */

// Escapes user-provided inputs to avoid HTML injection in emails
function esc(text) {
  return String(text || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Random item picker
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Good morning / afternoon / evening based on Asia/Kolkata time
function timeGreeting() {
  const hour = Number(
    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false })
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* ---------- the welcome message generator ---------- */

const motivation = [
  "Small workouts add up. Show up today and the rest will follow.",
  "You don't have to be perfect, you just have to be consistent.",
  "Every rep you log is proof of the effort you put in.",
  "Progress is quiet at first. Keep going and it gets loud.",
  "The hardest part is starting, and you've already done that."
];

const roleLines = {
  Member: {
    register: "Your account is ready. Start by logging your first workout, even a short walk counts, then add your weight on the Progress page.",
    login: "Your workouts and progress are right where you left them. Ready for today's session?"
  },
  Coach: {
    register: "Your coach account is ready. Once the admin assigns workouts to you, they will show up on your dashboard for review.",
    login: "Your members are counting on your feedback. Check your assigned workouts and leave some remarks."
  }
};

// type is "register" or "login"
function generateWelcomeMessage({ name = "User", role = "Member", type = "register" } = {}) {
  const hello = timeGreeting();
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const lines = roleLines[role] || roleLines.Member;
  const isNew = type === "register";

  const headline = isNew
    ? `Welcome to FitPulse, ${name}! 💪`
    : `Welcome back, ${name}! 👋`;

  const intro = isNew
    ? `${hello} ${name}! We're happy to have you on FitPulse as a ${role}.`
    : `${hello} ${name}! You just logged in as ${role} on ${when}.`;

  const body = isNew ? lines.register : lines.login;
  const quote = pick(motivation);
  const security = isNew ? "" : "If this wasn't you, please tell the admin right away.";

  const text = [intro, "", body, "", `"${quote}"`, security && "", security, "", "Stay consistent,", "Team FitPulse"]
    .filter(line => line !== undefined)
    .join("\n");

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #f1e8e2;border-radius:12px;overflow:hidden">
    <div style="background:#ff6b35;color:#fff;padding:20px;font-size:22px;font-weight:bold">
      Fit<span style="color:#ffe0cf">Pulse</span>
    </div>
    <div style="padding:25px;color:#2b3a4a;line-height:1.6">
      <h2 style="margin-top:0">${esc(headline)}</h2>
      <p>${esc(intro)}</p>
      <p>${esc(body)}</p>
      <p style="background:#fff4ee;padding:12px;border-radius:8px;font-style:italic">"${esc(quote)}"</p>
      ${security ? `<p style="color:#6b7b8c;font-size:13px">${esc(security)}</p>` : ""}
      <p style="margin-bottom:0">Stay consistent,<br><b>Team FitPulse</b></p>
    </div>
  </div>`;

  return { subject: headline, text, html };
}

/* ---------- sending functions ---------- */

// returns true if the mail was sent, false if not (never crashes the app)
async function send(to, message) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.log("Email skipped: MAIL_USER / MAIL_PASS not set in .env");
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"FitPulse" <${process.env.MAIL_USER}>`,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    console.log("Email sent to", to);
    return true;
  } catch (error) {
    console.log("Email failed:", error.message);
    return false;
  }
}

function sendWelcomeEmail({ name, email, role } = {}) {
  return send(email, generateWelcomeMessage({ name, role, type: "register" }));
}

function sendLoginEmail({ name, email, role } = {}) {
  return send(email, generateWelcomeMessage({ name, role, type: "login" }));
}

module.exports = { generateWelcomeMessage, sendWelcomeEmail, sendLoginEmail };
