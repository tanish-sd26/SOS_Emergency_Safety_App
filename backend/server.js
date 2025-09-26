const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

import dotenv from "dotenv";
dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

//const accountSid = "ACce11327a9bb641dd0c8217552e683571";
//const authToken = "cf1664d8734f80e3a0df1e612557a0d9";
//const client = new twilio(accountSid, authToken);

app.post("/sos", (req, res) => {
    const msg = req.body.message;
    const toNumber = req.body.to || "+91XXXXXXXXXX"; // default contact if not sent in body

    client.messages.create({
        body: msg,
        from: "+13204001363",
        to: toNumber
    }).then(message => res.send({status: "SMS Sent", sid: message.sid}))
      .catch(err => res.send({status: "Error", error: err}));
});

app.listen(3000, () => console.log("Twilio server running on port 3000"));
