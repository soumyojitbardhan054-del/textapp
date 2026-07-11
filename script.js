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
const messagesCollection = collection(db, "messages");

let currentUsername = localStorage.getItem("chat_username") || "";
let selectedImageBase64 = "";

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

  chatHistory.scrollTop = chatHistory.scrollHeight;
});

// IMAGE COMPRESSION LOGIC (Fixes the upload error)
const imageInput = document.getElementById("imageInput");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.src = event.target.result;
      img.onload = function () {
        // Create canvas to shrink image size
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600; // Good layout resolution
        const scaleSize = MAX_WIDTH / img.width;
        
        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to highly compressed JPEG data string
        selectedImageBase64 = canvas.toDataURL("image/jpeg", 0.6); 
        imagePreview.src = selectedImageBase64;
        imagePreviewContainer.classList.remove("hidden");
      };
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById("cancelImage").addEventListener("click", () => {
  selectedImageBase64 = "";
  imageInput.value = "";
  imagePreviewContainer.classList.add("hidden");
});

document.getElementById("sendBtn").addEventListener("click", async () => {
  const text = document.getElementById("message").value.trim();

  if (!text && !selectedImageBase64) return;

  await addDoc(messagesCollection, {
    sender: currentUsername,
    message: text,
    image: selectedImageBase64,
    time: Date.now()
  });

  document.getElementById("message").value = "";
  selectedImageBase64 = "";
  imageInput.value = "";
  imagePreviewContainer.classList.add("hidden");
});

document.getElementById("clearChatBtn").addEventListener("click", async () => {
  if (confirm("Are you sure you want to completely clear the chat history?")) {
    const querySnapshot = await getDocs(messagesCollection);
    querySnapshot.forEach(async (documentSnapshot) => {
      await deleteDoc(documentSnapshot.ref);
    });
  }
});
