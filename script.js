import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAw5Bjo8hHrrwGy-bLYw-bVj6VxMxQikkY",
  authDomain: "texting-996fa.firebaseapp.com",
  projectId: "texting-996fa",
  storageBucket: "texting-996fa.firebasestorage.app",
  messagingSenderId: "109418513805",
  appId: "1:109418513805:web:b9de58d58001d85e6ce9c4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const messageRef = doc(db, "chat", "current");

onSnapshot(messageRef, (snapshot) => {
  const display = document.getElementById("currentMessage");

  if (snapshot.exists()) {
    display.textContent = snapshot.data().message;
  } else {
    display.textContent = "No message yet...";
  }
});

document.getElementById("sendBtn").addEventListener("click", async () => {
  const text = document.getElementById("message").value.trim();

  if (!text) return;

  await setDoc(messageRef, {
    message: text,
    time: Date.now()
  });

  document.getElementById("message").value = "";
});