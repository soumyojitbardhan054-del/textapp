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

// Themes array to loop through
const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;
document.getElementById("chatContainer").style.backgroundColor = themes[currentThemeIndex];

// Load Auto-Saved Draft text on startup
const messageArea = document.getElementById("message");
messageArea.value = localStorage.getItem("chat_draft") || "";

// 1. Check Identity
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

// 2. High-Performance Client-Side Image Compression Function
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

// 3. Image Input Tracking
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

// 4. Stream Messages in Real-Time (With Individual Delete & Timestamps)
const q = query(messagesCollection, orderBy("time", "asc"));
onSnapshot(q, (snapshot) => {
  const chatHistory = document.getElementById("chatHistory");
  chatHistory.innerHTML = "";

  if (snapshot.empty) {
    chatHistory.innerHTML = `<div class="system-msg">No messages yet. Say hi!</div>`;
    return;
  }

  snapshot.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const msgId = snapshotDoc.id;
    const msgElement = document.createElement("div");
    const isMe = data.sender.toLowerCase() === currentUsername.toLowerCase();
    
    msgElement.className = `message-wrapper ${isMe ? "me" : "them"}`;

    // Format the timestamp nicely (e.g., 05:30 PM)
    const timeString = data.time 
      ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : "";

    let innerContent = `
      <div class="message-meta">
        <span class="sender-name">${data.sender}</span>
        ${isMe ? `<span class="delete-single-btn" data-id="${msgId}" title="Delete message">🗑️</span>` : ""}
      </div>
    `;
    
    if (data.image) {
      innerContent += `<img src="${data.image}" class="chat-img" alt="shared photo">`;
    }
    if (data.message) {
      innerContent += `<div class="bubble">${data.message}</div>`;
    }
    
    innerContent += `<span class="timestamp">${timeString}</span>`;

    msgElement.innerHTML = innerContent;
    chatHistory.appendChild(msgElement);
  });

  // Attach dynamic event listeners to individual delete trash cans
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

// 5. Auto-Save Draft Text Tracking
messageArea.addEventListener("input", (e) => {
  localStorage.setItem("chat_draft", e.target.value);
});

// 6. Send Dispatcher
document.getElementById("sendBtn").addEventListener("click", async () => {
  const text = messageArea.value.trim();
  if (!text && !selectedImageBase64) return;

  await addDoc(messagesCollection, {
    sender: currentUsername,
    message: text,
    image: selectedImageBase64,
    time: Date.now()
  });

  // Reset text inputs & delete local storage draft
  messageArea.value = "";
  localStorage.removeItem("chat_draft");
  
  selectedImageBase64 = "";
  imageInput.value = "";
  imagePreviewContainer.classList.add("hidden");
});

// 7. Cycle Background Themes
document.getElementById("themeBtn").addEventListener("click", () => {
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  localStorage.setItem("chat_theme_index", currentThemeIndex);
  document.getElementById("chatContainer").style.backgroundColor = themes[currentThemeIndex];
});

// 8. Global Reset Wipes
document.getElementById("clearChatBtn").addEventListener("click", async () => {
  if (confirm("Are you sure you want to clear the entire chat log?")) {
    const querySnapshot = await getDocs(messagesCollection);
    querySnapshot.forEach(async (docSnapshot) => {
      await deleteDoc(docSnapshot.ref);
    });
  }
});
