const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const accountSid = "YOUR_TWILIO_SID";
const authToken = "YOUR_TWILIO_AUTH_TOKEN";
const client = new twilio(accountSid, authToken);

app.post("/sos", (req, res) => {
    const msg = req.body.message;
    const toNumber = req.body.to || "+91XXXXXXXXXX"; // default contact if not sent in body

    client.messages.create({
        body: msg,
        from: "YOUR_TWILIO_NUMBER",
        to: toNumber
    }).then(message => res.send({status: "SMS Sent", sid: message.sid}))
      .catch(err => res.send({status: "Error", error: err}));
});

app.listen(3000, () => console.log("Twilio server running on port 3000"));
