import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
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
const statusCollection = collection(db, "status");

let currentUsername = localStorage.getItem("chat_username") || "";
let currentUserColor = localStorage.getItem("chat_user_color") || "#00d2d3";
let selectedImageBase64 = "";
let typingTimeout = null;

const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;

// GOD & Timer State Controls
let totalCycleSeconds = 600; // 10 minutes cyclic countdown
let godIsActive = true;
let currentAnswer = null;
let warningTwoMinSent = false;
let warningFiveSecSent = false;

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
const onlineUsersList = document.getElementById("onlineUsersList");
const typingIndicator = document.getElementById("typingIndicator");

if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];
if (messageArea) messageArea.value = localStorage.getItem("chat_draft") || "";

// Color Setup inside Modal Selection
document.querySelectorAll(".color-dot").forEach(dot => {
  if (dot.getAttribute("data-color") === currentUserColor) {
    document.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
    dot.classList.add("selected");
  }
  dot.addEventListener("click", (e) => {
    document.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
    e.target.classList.add("selected");
    currentUserColor = e.target.getAttribute("data-color");
  });
});

async function updatePresence(isOnline, isTyping = false) {
  if (!currentUsername) return;
  const userDocRef = doc(statusCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
  await setDoc(userDocRef, {
    username: currentUsername,
    color: currentUserColor,
    isOnline: isOnline,
    isTyping: isTyping,
    lastSeen: Date.now()
  }, { merge: true });
}

async function updateAiPresence(isTyping) {
  const aiDocRef = doc(statusCollection, "ai_bot");
  await setDoc(aiDocRef, {
    username: "AI Bot",
    color: "#ff9f43",
    isOnline: true,
    isTyping: isTyping,
    lastSeen: Date.now()
  }, { merge: true });
}

function updateIdentityDisplays() {
  if (!nameModal) return;
  if (currentUsername) {
    if (currentUserDisplay) currentUserDisplay.textContent = `User: ${currentUsername}`;
    if (mobileUserDisplay) mobileUserDisplay.textContent = `Profile: ${currentUsername}`;
    nameModal.classList.add("hidden-modal");
    updatePresence(true, false);
  } else {
    nameModal.classList.remove("hidden-modal");
  }
}
updateIdentityDisplays();

window.addEventListener("beforeunload", () => {
  updatePresence(false, false);
});

if (saveNameBtn && usernameInput) {
  saveNameBtn.addEventListener("click", () => {
    const name = usernameInput.value.trim();
    if (name) {
      localStorage.setItem("chat_username", name);
      localStorage.setItem("chat_user_color", currentUserColor);
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
        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        canvas.width = width; canvas.height = height;
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

// Global Chat Clear Function
async function purgeChatRoomLogs() {
  const querySnapshot = await getDocs(messagesCollection);
  querySnapshot.forEach(async (docSnapshot) => {
    await deleteDoc(docSnapshot.ref);
  });
}

// Post system messages from GOD entity
async function sendGodSms(textPayload) {
  await addDoc(messagesCollection, {
    sender: "GOD",
    senderColor: "#ff4757",
    message: textPayload,
    time: Date.now()
  });
}

// Generate complex numerical validation math questions
function makeHardQuestion() {
  const num1 = Math.floor(Math.random() * 80) + 20;
  const num2 = Math.floor(Math.random() * 12) + 4;
  const num3 = Math.floor(Math.random() * 150) + 50;
  currentAnswer = (num1 * num2) - num3;
  return `Solve to silence me: (${num1} × ${num2}) - ${num3} = ?`;
}

// Global Room Countdown Interval (Updates every second)
setInterval(() => {
  totalCycleSeconds--;

  const minutesLeft = Math.floor(totalCycleSeconds / 60);
  const secondsLeft = totalCycleSeconds % 60;
  
  if (typingIndicator) {
    typingIndicator.textContent = `Room Purge in: ${minutesLeft}m ${secondsLeft}s | God Mode: ${godIsActive ? "ACTIVE 👁️" : "DISMISSED 🤐"}`;
    typingIndicator.classList.remove("hidden");
  }

  // 1. Warning from GOD at exactly 2 minutes remaining (120 seconds left)
  if (godIsActive && totalCycleSeconds === 120 && !warningTwoMinSent) {
    warningTwoMinSent = true;
    sendGodSms("⚠️ TWO MINUTES REMAINING. Your chat logs draw closer to terminal erasure. Behave or face the void.");
  }

  // 2. Continuous warning spam from GOD every single second when less than 5 seconds remain
  if (godIsActive && totalCycleSeconds <= 5 && totalCycleSeconds > 0) {
    sendGodSms(`🚨 ${totalCycleSeconds} SECONDS REMAINING! Your behavioral logs are absolute trash. Purification imminent.`);
  }

  // 3. Wiping sequence activation
  if (totalCycleSeconds <= 0) {
    purgeChatRoomLogs();
    totalCycleSeconds = 600; // Reset to 10 mins
    godIsActive = true; 
    warningTwoMinSent = false;
    warningFiveSecSent = false;
    currentAnswer = null;
  }
}, 1000);

// Stream Messages (Includes LaTeX Cleaner)
const qMessages = query(messagesCollection, orderBy("time", "asc"));
onSnapshot(qMessages, (snapshot) => {
  if (!chatHistory) return;
  chatHistory.innerHTML = "";

  if (snapshot.empty) {
    chatHistory.innerHTML = `<div class="system-msg">Room empty and cleared. Talk while you can...</div>`;
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

    const customUserColor = data.senderColor || "var(--accent)";
    const firstInitial = data.sender ? data.sender.charAt(0).toUpperCase() : "?";

    // --- FIX LATEX CODE STAGE ---
    let cleanedMessage = data.message || "";
    if (cleanedMessage) {
      cleanedMessage = cleanedMessage
        .replace(/\$\$/g, "")
        .replace(/\$/g, "")
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/\\\(|\\\)/g, "")
        .replace(/\\text\{([^}]+)\}/g, "$1");
    }

    let innerContent = "";
    if (!isConsecutive) {
      innerContent += `<div class="message-meta">
        <div class="user-avatar-circle" style="background:${customUserColor}">${firstInitial}</div>
        <span class="sender-name" style="color:${customUserColor}">${data.sender}</span>
      </div>`;
    }
    
    innerContent += `<div class="bubble-layout">`;
    if (data.image) {
      innerContent += `<img src="${data.image}" class="chat-img" alt="shared photo">`;
    }
    if (cleanedMessage) {
      innerContent += `<div class="bubble" style="${isMe ? `background:${customUserColor};color:#111;` : ''}">${cleanedMessage}</div>`;
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

// Stream Presence and Typing Statuses
onSnapshot(statusCollection, (snapshot) => {
  if (onlineUsersList) onlineUsersList.innerHTML = "";
  let typingUsers = [];

  // Permanent sidebar items for status trackers
  if (onlineUsersList) {
    const aiRow = document.createElement("div");
    aiRow.className = "online-user-item";
    aiRow.innerHTML = `<div class="mini-avatar" style="background:#ff9f43">🤖</div> <span>AI Bot</span>`;
    onlineUsersList.appendChild(aiRow);

    const godRow = document.createElement("div");
    godRow.className = "online-user-item";
    godRow.innerHTML = `<div class="mini-avatar" style="background:#ff4757">👁️</div> <span>GOD [${godIsActive ? "Online" : "Muted"}]</span>`;
    onlineUsersList.appendChild(godRow);
  }

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const isRecent = (Date.now() - data.lastSeen) < 120000;

    if (data.username !== "AI Bot" && data.username !== "GOD" && data.isOnline && isRecent) {
      if (onlineUsersList) {
        const firstLetter = data.username ? data.username.charAt(0).toUpperCase() : "?";
        const userRow = document.createElement("div");
        userRow.className = "online-user-item";
        userRow.innerHTML = `
          <div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div>
          <span>${data.username}</span>
        `;
        onlineUsersList.appendChild(userRow);
      }
    }
    
    if (data.isTyping && data.username.toLowerCase() !== currentUsername.toLowerCase()) {
      typingUsers.push(data.username);
    }
  });

  if (typingIndicator && typingUsers.length > 0) {
    // Falls back to global countdown timer text if nobody is actively typing
  }
});

// Fetch AI response
async function fetchAiReply(userPrompt) {
  try {
    updateAiPresence(true);
    
    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a helpful, super fast, and cool AI assistant directly inside a developer group chat." },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const replyText = await response.text();
    
    await addDoc(messagesCollection, {
      sender: "AI Bot",
      senderColor: "#ff9f43",
      message: replyText || "I heard you, but my brain stalled out. Try asking again!",
      time: Date.now()
    });
  } catch (err) {
    console.error("AI Error:", err);
  } finally {
    updateAiPresence(false);
  }
}

// User Actions Heartbeat and Chat Submit
if (messageArea) {
  messageArea.addEventListener("input", (e) => {
    localStorage.setItem("chat_draft", e.target.value);
    updatePresence(true, true);
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      updatePresence(true, false);
    }, 2500);
  });
  
  messageArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendBtn.click();
    }
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", async () => {
    if (!messageArea) return;
    const text = messageArea.value.trim();
    if (!text && !selectedImageBase64) return;

    // Challenge interception validation logic 
    if (godIsActive && currentAnswer !== null) {
      if (parseInt(text) === currentAnswer) {
        godIsActive = false;
        currentAnswer = null;
        messageArea.value = "";
        await sendGodSms("❌ Direct interface command approved. I am silenced until the cycle resets.");
        return;
      } else {
        messageArea.value = "";
        await sendGodSms("❌ INCORRECT. Your mind remains weak. Try again or face total deletion.");
        return;
      }
    }

    // Trigger keyword to initiate the math verification block
    if (text.toLowerCase() === "/removegod") {
      messageArea.value = "";
      if (!godIsActive) {
        await sendGodSms("I am already muted this round.");
        return;
      }
      const mathQuestion = makeHardQuestion();
      await sendGodSms(`⚡ SYSTEM CHALLENGE ENFORCED: ${mathQuestion}`);
      return;
    }

    await addDoc(messagesCollection, {
      sender: currentUsername || "Anonymous",
      senderColor: currentUserColor,
      message: text,
      image: selectedImageBase64,
      time: Date.now()
    });

    messageArea.value = "";
    localStorage.removeItem("chat_draft");
    selectedImageBase64 = "";
    if (imageInput) imageInput.value = "";
    if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
    
    clearTimeout(typingTimeout);
    updatePresence(true, false);

    // AI Trigger Parse
    if (text.toLowerCase().startsWith("@ai")) {
      const cleanedPrompt = text.replace(/^@ai\s*/i, "").trim();
      
      if (cleanedPrompt) {
        fetchAiReply(cleanedPrompt);
      } else {
        await addDoc(messagesCollection, {
          sender: "AI Bot",
          senderColor: "#ff9f43",
          message: "👋 I'm listening! Type `@ai` followed by your question (e.g., `@ai tell me a cool fact`).",
          time: Date.now()
        });
      }
    }
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
  clearChatBtn.addEventListener("click", () => {
    alert("Manual override locked by God execution loop.");
  });
}
