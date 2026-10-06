require("dotenv").config();
const nodemailer = require("nodemailer");
const { generateWelcomeMessage } = require("./mailer");

const targetEmail = process.argv[2];

if (!targetEmail) {
  console.log("Please provide a recipient email address: node testMail.js someone@gmail.com");
  process.exit(1);
}

if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
  console.error("Error: MAIL_USER and MAIL_PASS are not configured in .env");
  process.exit(1);
}

// Configure Gmail transporter
const transportOptions = {
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
};

// Handle self-signed certificate error (for local development only)
if (process.env.MAIL_ALLOW_SELF_SIGNED === "true") {
  transportOptions.tls = {
    rejectUnauthorized: false
  };
}

const transporter = nodemailer.createTransport(transportOptions);

const message = generateWelcomeMessage({
  name: "Test User",
  role: "Member",
  type: "register"
});

async function main() {
  try {
    await transporter.sendMail({
      from: `"FitPulse" <${process.env.MAIL_USER}>`,
      to: targetEmail,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    console.log("Email sent");
  } catch (error) {
    console.error(error.message || error);
  }
}

main();
