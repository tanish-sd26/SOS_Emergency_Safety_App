# 🚨 SOS Emergency Safety App

A modern, web-based emergency alert system that enables users to send **instant SOS alerts with live location** to trusted contacts using a single click.

---

## 🌐 Live Demo

🔗https://sos-emergency-safety-app.web.app
---

## 📌 Overview

The **SOS Emergency Safety App** is designed to improve personal safety by providing a fast and reliable way to alert others during emergency situations.  
It allows users to trigger alerts, share real-time location, and notify contacts instantly using web technologies.

---

## 🔥 Key Features

- 🚨 One-click SOS alert system  
- 📍 Real-time location tracking (Geolocation API)  
- 📩 Email alerts using EmailJS  
- 💬 WhatsApp alert integration  
- 🔊 Emergency alarm system  
- 🎙️ Voice-triggered SOS activation  
- 📒 Alert history tracking  
- 👤 Emergency contact management  
- 🌙 Dark/Light mode UI  

---

## ⚙️ Tech Stack

**Frontend:**
- HTML5  
- CSS3  
- JavaScript (Vanilla JS)

**Backend & Services:**
- Firebase Authentication  
- Firebase Firestore (Database)  
- Firebase Hosting  

**APIs & Integrations:**
- Geolocation API  
- EmailJS  
- WhatsApp API (via link-based messaging)

---

## 🧠 How It Works

1. User logs into the system using Firebase Authentication  
2. Adds emergency contacts (email/phone)  
3. On pressing the **SOS button**:
   - The system fetches live location  
   - Creates an alert record in Firestore  
   - Sends notifications via Email and WhatsApp  
4. Alert is stored in history for future reference  

---

## 🖥️ Screenshots

### 🟢 Normal State
<img width="1763" height="1153" alt="image" src="https://github.com/user-attachments/assets/8f878af2-bfb3-4a01-a123-8f4b9208cf05" />

### 🔴 Emergency Active State
<img width="1763" height="1239" alt="image" src="https://github.com/user-attachments/assets/bdc27411-268a-4d20-9cc2-f7e64a8353d6" />

---

## 🧩 System Modules

- 🔐 Authentication Module  
- 📇 Contact Management Module  
- 🚨 SOS Trigger Module  
- 📊 Alert History Module  

---

## 🔒 Security

- Firebase Authentication ensures secure login  
- User-specific data access control  
- Cloud-based secure data storage  

---

## ⚠️ Limitations

- Requires active internet connection  
- SMS/Call functionality not included in free version  
- Depends on user’s location permissions  

---

## 🚀 Future Enhancements

- Add SMS and auto-calling functionality  
- Develop Android/iOS mobile application  
- Integrate with emergency services (police/ambulance)  
- Enable offline SOS alerts using SMS fallback 

---

## 🧪 Testing

- Verified SOS trigger functionality  
- Tested real-time location fetching  
- Checked alert delivery via Email & WhatsApp  
- Handled edge cases like no internet and location denial  
---

## 👩‍💻 Author

**Tanisha Suresh Maurya**  
