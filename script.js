import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
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
  appId: "1:1:109418513805:web:b9de58d58001d85e6ce9c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messagesCollection = collection(db, "messages");

// State parameters
let currentUsername = localStorage.getItem("chat_username") || "";
let selectedImageBase64 = "";
const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;

// Gather DOM nodes cleanly
const nameModal = document.getElementById("nameModal");
const usernameInput = document.getElementById("usernameInput");
const saveNameBtn = document.getElementById("saveNameBtn");
const changeNameBtn = document.getElementById("changeNameBtn");
const currentUserDisplay = document.getElementById("currentUserDisplay");
const mobileUserDisplay = document.getElementById("mobileUserDisplay");
const chatContainer = document.getElementById("chatContainer");
const messageArea = document.getElementById("message");
const chatHistory = document.getElementById("chatHistory");
const sendBtn = document.getElementById("sendBtn");
const imageInput = document.getElementById("imageInput");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const cancelImage = document.getElementById("cancelImage");
const themeBtn = document.getElementById("themeBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

// Set initial view state safely
if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];
if (messageArea) messageArea.value = localStorage.getItem("chat_draft") || "";

function updateIdentityDisplays() {
  if (!nameModal) return;
  if (currentUsername) {
    if (currentUserDisplay) currentUserDisplay.textContent = `Logged in as: ${currentUsername}`;
    if (mobileUserDisplay) mobileUserDisplay.textContent = `User: ${currentUsername}`;
    nameModal.classList.add("hidden-modal");
  } else {
    nameModal.classList.remove("hidden-modal");
  }
}
updateIdentityDisplays();

if (saveNameBtn && usernameInput) {
  saveNameBtn.addEventListener("click", () => {
    const name = usernameInput.value.trim();
    if (name) {
      localStorage.setItem("chat_username", name);
      currentUsername = name;
      updateIdentityDisplays();
    }
  });
}

if (changeNameBtn && usernameInput && nameModal) {
  changeNameBtn.addEventListener("click", () => {
    usernameInput.value = currentUsername;
    nameModal.classList.remove("hidden-modal");
  });
}

// Image processing pipeline
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 600;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
    };
  });
}

if (imageInput) {
  imageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file && imagePreview && imagePreviewContainer) {
      selectedImageBase64 = await compressImage(file);
      imagePreview.src = selectedImageBase64;
      imagePreviewContainer.classList.remove("hidden");
    }
  });
}

if (cancelImage) {
  cancelImage.addEventListener("click", () => {
    selectedImageBase64 = "";
    if (imageInput) imageInput.value = "";
    if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
  });
}

// Firestore Feed Consumer
const q = query(messagesCollection, orderBy("time", "asc"));
onSnapshot(q, (snapshot) => {
  if (!chatHistory) return;
  chatHistory.innerHTML = "";

  if (snapshot.empty) {
    chatHistory.innerHTML = `<div class="system-msg">No messages yet. Say hi!</div>`;
    return;
  }

  let lastSender = "";

  snapshot.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const msgId = snapshotDoc.id;
    const msgElement = document.createElement("div");
    const isMe = data.sender.toLowerCase() === currentUsername.toLowerCase();
    
    const isConsecutive = data.sender.toLowerCase() === lastSender.toLowerCase();
    lastSender = data.sender;

    msgElement.className = `message-wrapper ${isMe ? "me" : "them"} ${isConsecutive ? "consecutive" : ""}`;

    const timeString = data.time 
      ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : "";

    let innerContent = "";
    if (!isConsecutive) {
      innerContent += `<div class="message-meta"><span class="sender-name">${data.sender}</span></div>`;
    }
    
    innerContent += `<div class="bubble-layout">`;
    if (data.image) {
      innerContent += `<img src="${data.image}" class="chat-img" alt="shared photo">`;
    }
    if (data.message) {
      innerContent += `<div class="bubble">${data.message}</div>`;
    }
    
    innerContent += `
        <div class="bubble-sub">
          <span class="timestamp">${timeString}</span>
          ${isMe ? `<span class="delete-single-btn" data-id="${msgId}" title="Delete">🗑️</span>` : ""}
        </div>
      </div>
    `;

    msgElement.innerHTML = innerContent;
    chatHistory.appendChild(msgElement);
  });

  document.querySelectorAll(".delete-single-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const idToDelete = e.target.getAttribute("data-id");
      if (confirm("Delete this message?")) {
        await deleteDoc(doc(db, "messages", idToDelete));
      }
    });
  });

  chatHistory.scrollTop = chatHistory.scrollHeight;
});

// Draft capture tracking
if (messageArea) {
  messageArea.addEventListener("input", (e) => {
    localStorage.setItem("chat_draft", e.target.value);
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", async () => {
    if (!messageArea) return;
    const text = messageArea.value.trim();
    if (!text && !selectedImageBase64) return;

    await addDoc(messagesCollection, {
      sender: currentUsername || "Anonymous",
      message: text,
      image: selectedImageBase64,
      time: Date.now()
    });

    messageArea.value = "";
    localStorage.removeItem("chat_draft");
    selectedImageBase64 = "";
    if (imageInput) imageInput.value = "";
    if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
  });
}

if (themeBtn && chatContainer) {
  themeBtn.addEventListener("click", () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    localStorage.setItem("chat_theme_index", currentThemeIndex);
    chatContainer.style.backgroundColor = themes[currentThemeIndex];
  });
}

if (clearChatBtn) {
  clearChatBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear the entire chat log?")) {
      const querySnapshot = await getDocs(messagesCollection);
      querySnapshot.forEach(async (docSnapshot) => {
        await deleteDoc(docSnapshot.ref);
      });
    }
  });
}
