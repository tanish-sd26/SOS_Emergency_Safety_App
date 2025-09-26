// ===== Firebase Setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABz-NUgHc-x7_RQM_z9kKtZvVGbAedRGI",
  authDomain: "sos-emergency-app-4116c.firebaseapp.com",
  projectId: "sos-emergency-app-4116c",
  storageBucket: "sos-emergency-app-4116c.firebasestorage.app",
  messagingSenderId: "492785441483",
  appId: "1:492785441483:web:93e04cb271130f9b33994e"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== EmailJS Setup =====
import emailjs from "https://cdn.emailjs.com/dist/email.min.js";
emailjs.init("Ss8SLxGczWuKD90v7kyUt");

// ===== Login / Signup =====
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");

if(signupBtn){
signupBtn.addEventListener("click", async ()=>{
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try{
    await createUserWithEmailAndPassword(auth,email,password);
    alert("Signup Success!"); window.location="contacts.html";
  }catch(e){alert(e.message);}
});}

if(loginBtn){
loginBtn.addEventListener("click", async ()=>{
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try{
    await signInWithEmailAndPassword(auth,email,password);
    alert("Login Success!"); window.location="contacts.html";
  }catch(e){alert(e.message);}
});}

// ===== Contacts Page =====
const addContactBtn = document.getElementById("addContactBtn");
if(addContactBtn){
addContactBtn.addEventListener("click", async ()=>{
  const name=document.getElementById("contactName").value;
  const email=document.getElementById("contactEmail").value;
  const phone=document.getElementById("contactPhone").value;
  try{
    await addDoc(collection(db,"contacts"),{name,email,phone});
    alert("Contact Added!"); displayContacts();
  }catch(e){alert(e.message);}
});}

async function displayContacts(){
  const contactsList=document.getElementById("contactsList");
  if(!contactsList) return;
  contactsList.innerHTML="";
  const snapshot=await getDocs(collection(db,"contacts"));
  snapshot.forEach(doc=>{
    const d=doc.data();
    contactsList.innerHTML+=`<p>${d.name} - ${d.phone} - ${d.email}</p>`;
  });
}
displayContacts();

// ===== SOS Page =====
const sosBtn = document.getElementById("sosBtn");
const imSafeBtn = document.getElementById("imSafeBtn");
const alarm = document.getElementById("alarmSound");

async function sendAlerts(locationLink){
  // Fetch contacts
  const snapshot=await getDocs(collection(db,"contacts"));
  snapshot.forEach(async doc=>{
    const c=doc.data();
    const message=`SOS ALERT! ${c.name}, I need help. Location: ${locationLink}`;

    // EmailJS
    emailjs.send("service_vrzcyjh","template_8x3sslp",{
      to_email:c.email,
      user_name:"Tanisha",
      message:message,
      location:locationLink
    }).then(()=>console.log("Email sent")).catch(e=>console.log(e));

    // WhatsApp
    window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(message)}`,'_blank');

    // Optional Twilio SMS/Call via backend
    fetch("http://localhost:3000/sos",{method:"POST",body:JSON.stringify({message})});
  });
}

// SOS Button Click
if(sosBtn){
sosBtn.addEventListener("click", ()=>{
  alarm.loop=true; alarm.play();
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude;
    const long=pos.coords.longitude;
    const loc=`https://www.google.com/maps?q=${lat},${long}`;
    sendAlerts(loc);
  });
});
}

const alarmSound = document.getElementById("alarmSound");


document.getElementById("sosButton").addEventListener("click", ()=>{
  alarmSound.loop = true; 
  alarmSound.play();
  sendAlerts(); 
});

document.getElementById("imSafeButton").addEventListener("click", ()=>{
  alarmSound.pause();
  alarmSound.currentTime = 0; 
  alert("You are marked safe. Alarm stopped.");
});
 
// I'm Safe
if(imSafeBtn){
imSafeBtn.addEventListener("click", ()=>{
  alarm.pause(); alarm.currentTime=0; 
  alert("Glad you are safe!");
});
}

// ===== Voice Trigger =====
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new window.SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.onresult = function(e){
  const transcript = e.results[e.results.length-1][0].transcript.trim().toLowerCase();
  if(transcript.includes("help help")){
    sosBtn.click();
  }
};
recognition.start();
