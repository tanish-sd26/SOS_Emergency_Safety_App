// server.js (use this)
require('dotenv').config();           // load .env at top
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Read from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || "+1234567890";
const PORT = process.env.PORT || 3000;

if (!accountSid || !authToken) {
  console.error("ERROR: Twilio credentials are not set in .env");
  process.exit(1); // fail early so you know to set them
}

const client = new twilio(accountSid, authToken);

app.post("/sos", (req, res) => {
  const msg = req.body.message;
  const toNumber = req.body.to || req.body.toNumber || "+91XXXXXXXXXX"; // prefer passed number

  client.messages.create({
    body: msg,
    from: twilioNumber,
    to: toNumber
  }).then(message => res.send({status: "SMS Sent", sid: message.sid}))
    .catch(err => res.status(500).send({status: "Error", error: err.message}));
});

app.listen(PORT, () => console.log(`Twilio server running on port ${PORT}`));
