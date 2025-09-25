// ===== Firebase Setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== EmailJS Setup =====
import emailjs from "https://cdn.emailjs.com/dist/email.min.js";
emailjs.init("YOUR_EMAILJS_PUBLIC_KEY");

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
    emailjs.send("YOUR_SERVICE_ID","YOUR_TEMPLATE_ID",{
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
