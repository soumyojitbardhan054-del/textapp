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
  appId: "1:109418513805:web:b9de58d58001d85e6ce9c4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messagesCollection = collection(db, "messages");

let currentUsername = localStorage.getItem("chat_username") || "";
let selectedImageBase64 = "";

const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;
document.getElementById("chatContainer").style.backgroundColor = themes[currentThemeIndex];

const messageArea = document.getElementById("message");
messageArea.value = localStorage.getItem("chat_draft") || "";

// 1. Identity Display Handlers
const nameModal = document.getElementById("nameModal");
function updateIdentityDisplays() {
  if (currentUsername) {
    document.getElementById("currentUserDisplay").textContent = `Logged in as: ${currentUsername}`;
    document.getElementById("mobileUserDisplay").textContent = `User: ${currentUsername}`;
    nameModal.style.display = "none";
  } else {
    nameModal.style.display = "flex";
  }
}
updateIdentityDisplays();

document.getElementById("saveNameBtn").addEventListener("click", () => {
  const name = document.getElementById("usernameInput").value.trim();
  if (name) {
    localStorage.setItem("chat_username", name);
    currentUsername = name;
    updateIdentityDisplays();
  }
});

// Trigger name change modal manually
document.getElementById("changeNameBtn").addEventListener("click", () => {
  document.getElementById("usernameInput").value = currentUsername;
  nameModal.style.display = "flex";
});

// 2. Image Compression
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

const imageInput = document.getElementById("imageInput");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");

imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImageBase64 = await compressImage(file);
    imagePreview.src = selectedImageBase64;
    imagePreviewContainer.classList.remove("hidden");
  }
});

document.getElementById("cancelImage").addEventListener("click", () => {
  selectedImageBase64 = "";
  imageInput.value = "";
  imagePreviewContainer.classList.add("hidden");
});

// 3. Real-time Stream with Grouping Logic
const q = query(messagesCollection, orderBy("time", "asc"));
onSnapshot(q, (snapshot) => {
  const chatHistory = document.getElementById("chatHistory");
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
    
    // Check if this message is from the same person as the last message
    const isConsecutive = data.sender.toLowerCase() === lastSender.toLowerCase();
    lastSender = data.sender;

    msgElement.className = `message-wrapper ${isMe ? "me" : "them"} ${isConsecutive ? "consecutive" : ""}`;

    const timeString = data.time 
      ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : "";

    let innerContent = "";
    
    // Only render the name header if it's NOT consecutive text
    if (!isConsecutive) {
      innerContent += `
        <div class="message-meta">
          <span class="sender-name">${data.sender}</span>
        </div>
      `;
    }
    
    // Core message bubble structure
    innerContent += `<div class="bubble-layout">`;
    
    if (data.image) {
      innerContent += `<img src="${data.image}" class="chat-img" alt="shared photo">`;
    }
    if (data.message) {
      innerContent += `<div class="bubble">${data.message}</div>`;
    }
    
    // Action tools under or alongside the text
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

  // Event deletion anchors
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

// 4. Input Interactions
messageArea.addEventListener("input", (e) => {
  localStorage.setItem("chat_draft", e.target.value);
});

document.getElementById("sendBtn").addEventListener("click", async () => {
  const text = messageArea.value.trim();
  if (!text && !selectedImageBase64) return;

  await addDoc(messagesCollection, {
    sender: currentUsername,
    message: text,
    image: selectedImageBase64,
    time: Date.now()
  });

  messageArea.value = "";
  localStorage.removeItem("chat_draft");
  selectedImageBase64 = "";
  imageInput.value = "";
  imagePreviewContainer.classList.add("hidden");
});

document.getElementById("themeBtn").addEventListener("click", () => {
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  localStorage.setItem("chat_theme_index", currentThemeIndex);
  document.getElementById("chatContainer").style.backgroundColor = themes[currentThemeIndex];
});

document.getElementById("clearChatBtn").addEventListener("click", async () => {
  if (confirm("Are you sure you want to clear the entire chat log?")) {
    const querySnapshot = await getDocs(messagesCollection);
    querySnapshot.forEach(async (docSnapshot) => {
      await deleteDoc(docSnapshot.ref);
    });
  }
});
