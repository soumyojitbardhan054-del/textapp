import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  deleteDoc
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

// Collection Reference
const messagesCollection = collection(db, "messages");

let currentUsername = localStorage.getItem("chat_username") || "";
let selectedImageBase64 = "";

// 1. Name Prompt Logic
const nameModal = document.getElementById("nameModal");
if (!currentUsername) {
  nameModal.style.display = "flex";
} else {
  nameModal.style.display = "none";
}

document.getElementById("saveNameBtn").addEventListener("click", () => {
  const name = document.getElementById("usernameInput").value.trim();
  if (name) {
    localStorage.setItem("chat_username", name);
    currentUsername = name;
    nameModal.style.display = "none";
  }
});

// 2. Real-time Listening to Chat History
const q = query(messagesCollection, orderBy("time", "asc"));
onSnapshot(q, (snapshot) => {
  const chatHistory = document.getElementById("chatHistory");
  chatHistory.innerHTML = "";

  if (snapshot.empty) {
    chatHistory.innerHTML = `<div class="system-msg">No messages yet...</div>`;
    return;
  }

  snapshot.forEach((doc) => {
    const data = doc.data();
    const msgElement = document.createElement("div");
    
    // Determine if the message belongs to "me" or "the other person"
    const isMe = data.sender.toLowerCase() === currentUsername.toLowerCase();
    msgElement.className = `message-wrapper ${isMe ? "me" : "them"}`;

    let contentHtml = `<span class="sender-name">${data.sender}</span>`;
    
    if (data.message) {
      contentHtml += `<div class="bubble">${data.message}</div>`;
    }
    if (data.image) {
      contentHtml += `<img src="${data.image}" class="chat-img" alt="shared pic" />`;
    }

    msgElement.innerHTML = contentHtml;
    chatHistory.appendChild(msgElement);
  });

  // Auto-scroll to the bottom on new texts
  chatHistory.scrollTop = chatHistory.scrollHeight;
});

// 3. Handling Image Selection
const imageInput = document.getElementById("imageInput");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      selectedImageBase64 = event.target.result;
      imagePreview.src = selectedImageBase64;
      imagePreviewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById("cancelImage").addEventListener("click", () => {
  selectedImageBase64 = "";
  imageInput.value = "";
  imagePreviewContainer.classList.add("hidden");
});

// 4. Send Message Functionality
document.getElementById("sendBtn").addEventListener("click", async () => {
  const text = document.getElementById("message").value.trim();

  // Don't send if both image and text are blank
  if (!text && !selectedImageBase64) return;

  await addDoc(messagesCollection, {
    sender: currentUsername,
    message: text,
    image: selectedImageBase64,
    time: Date.now()
  });

  // Clear Inputs
  document.getElementById("message").value = "";
  selectedImageBase64 = "";
  imageInput.value = "";
  imagePreviewContainer.classList.add("hidden");
});

// 5. Manual Clear/Reset Feature
document.getElementById("clearChatBtn").addEventListener("click", async () => {
  if (confirm("Are you sure you want to delete all messages for everyone?")) {
    const querySnapshot = await getDocs(messagesCollection);
    querySnapshot.forEach(async (documentSnapshot) => {
      await deleteDoc(documentSnapshot.ref);
    });
  }
});
