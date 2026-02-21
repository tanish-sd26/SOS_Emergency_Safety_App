
/* * ═══════════════════════════════════════════════════════════
 * SOS EMERGENCY - CLOUD FUNCTIONS
 * Twilio SMS + Twilio Voice Call
 * ═══════════════════════════════════════════════════════════
**/
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();


const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;


// Initialize Twilio Client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * ═══════════════════════════════════════════════════
 * FUNCTION 1: Send SMS to all emergency contacts
 * Triggered automatically when new SOS alert is created
 * ═══════════════════════════════════════════════════
 */
exports.sendSOSSms = functions.firestore
  .document("users/{userId}/sos_history/{alertId}")
  .onCreate(async (snap, context) => {
    const alertData = snap.data();
    const userId = context.params.userId;
    const alertId = context.params.alertId;

    console.log(`🚨 New SOS Alert from user: ${userId}`);

    try {
      // Get user info
      const userDoc = await db.collection("users").doc(userId).get();
      const userName = userDoc.exists ? userDoc.data().name : "SOS User";
      const userEmail = userDoc.exists ? userDoc.data().email : "Unknown";

      // Get all contacts
      const contactsSnap = await db
        .collection("users")
        .doc(userId)
        .collection("contacts")
        .get();

      if (contactsSnap.empty) {
        console.log("No emergency contacts found. Skipping SMS.");
        return null;
      }

      console.log(`Found ${contactsSnap.size} contacts. Sending SMS...`);

      // Build SMS message
      const smsMessage =
        `🚨 EMERGENCY SOS ALERT!\n\n` +
        `${userName} ne emergency alert trigger kiya hai!\n\n` +
        `📍 Location: ${alertData.mapsLink}\n` +
        `🕐 Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\n` +
        `📧 Email: ${userEmail}\n\n` +
        `Please respond IMMEDIATELY!\n` +
        `Google Maps: ${alertData.mapsLink}`;

      // Send SMS to each contact
      const smsPromises = [];
      const results = { success: 0, failed: 0, errors: [] };

      for (const contactDoc of contactsSnap.docs) {
        const contact = contactDoc.data();

        if (!contact.phone) {
          console.log(`Skipping ${contact.name} - no phone number`);
          continue;
        }

        // Clean phone number
        let phoneNumber = contact.phone.replace(/[\s\-\(\)]/g, "");
        if (!phoneNumber.startsWith("+")) {
          phoneNumber = "+91" + phoneNumber; // Default India code
        }

        const promise = twilioClient.messages
          .create({
            body: smsMessage,
            from: TWILIO_PHONE_NUMBER,
            to: phoneNumber,
          })
          .then((message) => {
            console.log(`✅ SMS sent to ${contact.name} (${phoneNumber}): ${message.sid}`);
            results.success++;
          })
          .catch((error) => {
            console.error(`❌ SMS failed to ${contact.name} (${phoneNumber}):`, error.message);
            results.failed++;
            results.errors.push({ contact: contact.name, error: error.message });
          });

        smsPromises.push(promise);
      }

      await Promise.all(smsPromises);

      // Update alert document with SMS status
      await db
        .collection("users")
        .doc(userId)
        .collection("sos_history")
        .doc(alertId)
        .update({
          smsSent: true,
          smsResults: {
            total: contactsSnap.size,
            success: results.success,
            failed: results.failed,
            errors: results.errors,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });

      console.log(`📊 SMS Summary: ${results.success} sent, ${results.failed} failed`);
      return null;
    } catch (error) {
      console.error("❌ sendSOSSms Error:", error);

      // Update document with error
      await db
        .collection("users")
        .doc(userId)
        .collection("sos_history")
        .doc(alertId)
        .update({
          smsSent: false,
          smsError: error.message,
        });

      return null;
    }
  });

/**
 * ═══════════════════════════════════════════════════
 * FUNCTION 2: Make voice call to all emergency contacts
 * Triggered automatically when new SOS alert is created
 * ═══════════════════════════════════════════════════
 */
exports.sendSOSCall = functions.firestore
  .document("users/{userId}/sos_history/{alertId}")
  .onCreate(async (snap, context) => {
    const alertData = snap.data();
    const userId = context.params.userId;
    const alertId = context.params.alertId;

    console.log(`📞 Initiating SOS calls for user: ${userId}`);

    try {
      // Get user info
      const userDoc = await db.collection("users").doc(userId).get();
      const userName = userDoc.exists ? userDoc.data().name : "SOS User";

      // Get all contacts
      const contactsSnap = await db
        .collection("users")
        .doc(userId)
        .collection("contacts")
        .get();

      if (contactsSnap.empty) {
        console.log("No emergency contacts found. Skipping calls.");
        return null;
      }

      console.log(`Found ${contactsSnap.size} contacts. Making calls...`);

      // TwiML - Voice message that will be spoken
      // Twilio reads this XML to the person who picks up
      const twimlMessage =
        `<Response>` +
        `<Say voice="alice" language="en-IN">` +
        `Emergency Alert! Emergency Alert! ` +
        `This is an automated SOS call from ${userName}. ` +
        `They have triggered an emergency alert and need immediate help. ` +
        `Please check your SMS for their live location on Google Maps. ` +
        `I repeat, ${userName} needs your help immediately. ` +
        `Please respond now.` +
        `</Say>` +
        `<Pause length="2"/>` +
        `<Say voice="alice" language="en-IN">` +
        `This message will now repeat.` +
        `</Say>` +
        `<Pause length="1"/>` +
        `<Say voice="alice" language="en-IN">` +
        `Emergency Alert! ${userName} has triggered an SOS alert. ` +
        `Check your SMS for their Google Maps location. ` +
        `Please help immediately.` +
        `</Say>` +
        `</Response>`;

      // Make call to each contact
      const callPromises = [];
      const results = { success: 0, failed: 0, errors: [] };

      for (const contactDoc of contactsSnap.docs) {
        const contact = contactDoc.data();

        if (!contact.phone) {
          console.log(`Skipping call to ${contact.name} - no phone number`);
          continue;
        }

        let phoneNumber = contact.phone.replace(/[\s\-\(\)]/g, "");
        if (!phoneNumber.startsWith("+")) {
          phoneNumber = "+91" + phoneNumber;
        }

        const promise = twilioClient.calls
          .create({
            twiml: twimlMessage,
            from: TWILIO_PHONE_NUMBER,
            to: phoneNumber,
            timeout: 30, // Ring for 30 seconds max
          })
          .then((call) => {
            console.log(`✅ Call initiated to ${contact.name} (${phoneNumber}): ${call.sid}`);
            results.success++;
          })
          .catch((error) => {
            console.error(`❌ Call failed to ${contact.name} (${phoneNumber}):`, error.message);
            results.failed++;
            results.errors.push({ contact: contact.name, error: error.message });
          });

        callPromises.push(promise);
      }

      await Promise.all(callPromises);

      // Update alert document with call status
      await db
        .collection("users")
        .doc(userId)
        .collection("sos_history")
        .doc(alertId)
        .update({
          callSent: true,
          callResults: {
            total: contactsSnap.size,
            success: results.success,
            failed: results.failed,
            errors: results.errors,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });

      console.log(`📊 Call Summary: ${results.success} initiated, ${results.failed} failed`);
      return null;
    } catch (error) {
      console.error("❌ sendSOSCall Error:", error);

      await db
        .collection("users")
        .doc(userId)
        .collection("sos_history")
        .doc(alertId)
        .update({
          callSent: false,
          callError: error.message,
        });

      return null;
    }
  });

/**
 * ═══════════════════════════════════════════════════
 * FUNCTION 3: HTTP Callable - Manual SMS trigger
 * Frontend se directly call kar sakte ho
 * ═══════════════════════════════════════════════════
 */
exports.manualSendSMS = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in"
    );
  }

  const { phone, message } = data;

  if (!phone || !message) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Phone and message are required"
    );
  }

  try {
    let phoneNumber = phone.replace(/[\s\-\(\)]/g, "");
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+91" + phoneNumber;
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    return { success: true, messageSid: result.sid };
  } catch (error) {
    console.error("Manual SMS Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * ═══════════════════════════════════════════════════
 * FUNCTION 4: HTTP Callable - Manual Call trigger
 * ═══════════════════════════════════════════════════
 */
exports.manualSendCall = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in"
    );
  }

  const { phone, userName } = data;

  if (!phone) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Phone number is required"
    );
  }

  try {
    let phoneNumber = phone.replace(/[\s\-\(\)]/g, "");
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+91" + phoneNumber;
    }

    const name = userName || "SOS User";

    const twimlMessage =
      `<Response>` +
      `<Say voice="alice" language="en-IN">` +
      `Emergency Alert! This is an SOS call from ${name}. ` +
      `They need immediate help. Check your SMS for their location.` +
      `</Say>` +
      `</Response>`;

    const result = await twilioClient.calls.create({
      twiml: twimlMessage,
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      timeout: 30,
    });

    return { success: true, callSid: result.sid };
  } catch (error) {
    console.error("Manual Call Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * ═══════════════════════════════════════════════════
 * FUNCTION 5: Health Check
 * Test karne ke liye ki functions kaam kar rahe hain
 * ═══════════════════════════════════════════════════
 */
exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: "ok",
    message: "SOS Emergency Functions are running",
    timestamp: new Date().toISOString(),
    services: {
      twilio: TWILIO_ACCOUNT_SID ? "configured" : "not configured",
      firestore: "connected",
    },
  });
});