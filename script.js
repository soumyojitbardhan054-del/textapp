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
const secretVaultCollection = collection(db, "secret_vault");

let currentUsername = localStorage.getItem("chat_username") || "";
let currentUserColor = localStorage.getItem("chat_user_color") || "#00d2d3";
let selectedImageBase64 = "";
let typingTimeout = null;

const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;

let targetEndTimestamp = 0;
let godIsActive = true;
let currentAnswer = null;
let warningTwoMinSent = false;
let globalTimerDisplayString = "";
let globalTypingDisplayString = "";

document.addEventListener("DOMContentLoaded", () => {
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

  // --- RECONSTRUCTED VAULT UI OVERLAY ---
  let vaultContainer = null;
  let vaultHistory = null;
  let vaultInput = null;

  function buildSecretVaultUI() {
    if (document.getElementById("secretVaultContainer")) return;

    // Full screen wrapper container to ensure layout isolation on laptops
    vaultContainer = document.createElement("div");
    vaultContainer.id = "secretVaultContainer";
    vaultContainer.style.position = "fixed";
    vaultContainer.style.top = "0";
    vaultContainer.style.left = "0";
    vaultContainer.style.width = "100vw";
    vaultContainer.style.height = "100vh";
    vaultContainer.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
    vaultContainer.style.display = "none"; 
    vaultContainer.style.justifyContent = "center";
    vaultContainer.style.alignItems = "center";
    vaultContainer.style.zIndex = "999999";

    vaultContainer.innerHTML = `
      <div style="width: 90%; max-width: 400px; height: 500px; display: flex; flex-direction: column; background: #0b0e14; border: 2px solid #ff9f43; border-radius: 8px; padding: 15px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #ff9f43; font-size: 18px; font-family: monospace;">¢ SECRET VAULT</h2>
          <button id="closeVaultBtn" style="background: transparent; color: #ff4757; border: none; font-size: 20px; cursor: pointer; padding: 0 5px;">✖</button>
        </div>
        <div id="vaultHistory" style="flex: 1; overflow-y: auto; text-align: left; font-size: 13px; font-family: monospace; display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; padding-right: 5px;"></div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="vaultInput" placeholder="Send optimized bytes..." style="flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #333; background: #161b22; color: #fff; outline: none;">
          <button id="vaultSendBtn" style="background: #ff9f43; color: #111; border: none; border-radius: 4px; padding: 0 16px; cursor: pointer; font-weight: bold;">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(vaultContainer);

    vaultHistory = document.getElementById("vaultHistory");
    vaultInput = document.getElementById("vaultInput");
    
    document.getElementById("closeVaultBtn").addEventListener("click", () => {
      vaultContainer.style.display = "none";
    });

    // Close window if user clicks on the darkened overlay layout outside the modal panel
    vaultContainer.addEventListener("click", (e) => {
      if (e.target === vaultContainer) vaultContainer.style.display = "none";
    });

    document.getElementById("vaultSendBtn").addEventListener("click", async () => {
      const text = vaultInput.value.trim();
      if (!text) return;
      // High compression signature: minimal field labels save backend data metrics
      await addDoc(secretVaultCollection, { s: currentUsername, m: text, t: Date.now() });
      vaultInput.value = "";
    });

    vaultInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("vaultSendBtn").click();
    });

    const qSecret = query(secretVaultCollection, orderBy("t", "asc"));
    onSnapshot(qSecret, (snapshot) => {
      if (!vaultHistory) return;
      vaultHistory.innerHTML = "";
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement("div");
        div.style.background = "#161b22";
        div.style.padding = "8px";
        div.style.borderRadius = "4px";
        div.style.borderLeft = "3px solid #ff9f43";
        div.innerHTML = `<strong style="color:#ff9f43">${data.s}:</strong> <span style="color:#e6edf3; word-break: break-all;">${data.m}</span>`;
        vaultHistory.appendChild(div);
      });
      vaultHistory.scrollTop = vaultHistory.scrollHeight;
    });
  }

  function checkSecretAccess() {
    const headerActions = document.querySelector(".header-actions");
    let existingSecretBtn = document.getElementById("triggerSecretBtn");
    
    if (currentUsername.includes("¢")) {
      buildSecretVaultUI();
      if (!existingSecretBtn && headerActions) {
        const secretBtn = document.createElement("button");
        secretBtn.id = "triggerSecretBtn";
        secretBtn.className = "secondary-btn";
        secretBtn.style.backgroundColor = "#ff9f43";
        secretBtn.style.color = "#111";
        secretBtn.style.fontWeight = "bold";
        secretBtn.textContent = "Vault ¢";
        headerActions.insertBefore(secretBtn, clearChatBtn);
        
        secretBtn.addEventListener("click", () => {
          if (vaultContainer) vaultContainer.style.display = "flex";
        });
      }
    } else {
      if (existingSecretBtn) existingSecretBtn.remove();
      if (vaultContainer) vaultContainer.style.display = "none";
    }
  }

  // --- PRESENCE & IDENTITY ---
  async function updatePresence(isOnline, isTyping = false, oldName = "") {
    if (!currentUsername) return;
    if (oldName && oldName.toLowerCase() !== currentUsername.toLowerCase()) {
      const oldDocRef = doc(statusCollection, oldName.toLowerCase().replace(/\s+/g, '_'));
      await deleteDoc(oldDocRef).catch(() => {});
    }
    const userDocRef = doc(statusCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
    await setDoc(userDocRef, {
      username: currentUsername, color: currentUserColor, isOnline: isOnline, isTyping: isTyping, lastSeen: Date.now()
    }, { merge: true });
  }

  async function updateAiPresence(isTyping) {
    const aiDocRef = doc(statusCollection, "ai_bot");
    await setDoc(aiDocRef, {
      username: "AI Bot", color: "#ff9f43", isOnline: true, isTyping: isTyping, lastSeen: Date.now()
    }, { merge: true });
  }

  function updateIdentityDisplays() {
    if (!nameModal) return;
    if (currentUsername) {
      if (currentUserDisplay) currentUserDisplay.textContent = `User: ${currentUsername}`;
      if (mobileUserDisplay) mobileUserDisplay.textContent = `Profile: ${currentUsername}`;
      nameModal.classList.add("hidden-modal");
      updatePresence(true, false);
      checkSecretAccess(); 
    } else {
      nameModal.classList.remove("hidden-modal");
    }
  }
  updateIdentityDisplays();

  window.addEventListener("beforeunload", () => updatePresence(false, false));

  function handleUserSetupSave() {
    if (!usernameInput) return;
    const newName = usernameInput.value.trim();
    if (newName) {
      const oldName = currentUsername;
      localStorage.setItem("chat_username", newName);
      localStorage.setItem("chat_user_color", currentUserColor);
      currentUsername = newName;
      updateIdentityDisplays();
      if (oldName && oldName !== newName) updatePresence(true, false, oldName);
    }
  }

  if (saveNameBtn) {
    saveNameBtn.addEventListener("click", handleUserSetupSave);
    saveNameBtn.addEventListener("touchend", (e) => { e.preventDefault(); handleUserSetupSave(); });
  }

  if (changeNameBtn) {
    const openModal = () => {
      usernameInput.value = currentUsername;
      nameModal.classList.remove("hidden-modal");
    };
    changeNameBtn.addEventListener("click", openModal);
    changeNameBtn.addEventListener("touchend", (e) => { e.preventDefault(); openModal(); });
  }

  // --- IMAGE UPLOAD ---
  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width, height = img.height;
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

  // --- ENGINE LOOPS & FIRESTORE HANDLERS ---
  async function purgeChatRoomLogs() {
    const querySnapshot = await getDocs(messagesCollection);
    for (const docSnapshot of querySnapshot.docs) {
      await deleteDoc(docSnapshot.ref);
    }
  }

  async function sendGodSms(textPayload) {
    await addDoc(messagesCollection, { sender: "GOD", senderColor: "#ff4757", message: textPayload, time: Date.now() });
  }

  function makeHardQuestion() {
    const num1 = Math.floor(Math.random() * 80) + 20;
    const num2 = Math.floor(Math.random() * 12) + 4;
    const num3 = Math.floor(Math.random() * 150) + 50;
    currentAnswer = (num1 * num2) - num3;
    return `Solve to silence me: (${num1} × ${num2}) - ${num3} = ?`;
  }

  function combineFooterDisplays() {
    if (!typingIndicator) return;
    let parts = [];
    if (globalTimerDisplayString) parts.push(globalTimerDisplayString);
    if (globalTypingDisplayString) parts.push(globalTypingDisplayString);
    if (parts.length > 0) {
      typingIndicator.innerHTML = parts.join(" | ");
      typingIndicator.classList.remove("hidden");
    } else {
      typingIndicator.classList.add("hidden");
    }
  }

  onSnapshot(doc(db, "status", "timer_state"), async (docSnap) => {
    if (docSnap.exists()) {
      targetEndTimestamp = docSnap.data().endTime;
    } else {
      const freshEnd = Date.now() + 600000; 
      await setDoc(doc(db, "status", "timer_state"), { endTime: freshEnd });
    }
  });

  setInterval(async () => {
    if (!targetEndTimestamp) return;
    const now = Date.now();
    let remainingSeconds = Math.max(0, Math.floor((targetEndTimestamp - now) / 1000));
    const minutesLeft = Math.floor(remainingSeconds / 60);
    const secondsLeft = remainingSeconds % 60;

    globalTimerDisplayString = `Purge in: ${minutesLeft}m ${secondsLeft}s [God: ${godIsActive ? "👁️ ACTIVE" : "🤐 MUTED"}]`;
    combineFooterDisplays();

    if (godIsActive && remainingSeconds === 120 && !warningTwoMinSent) {
      warningTwoMinSent = true;
      sendGodSms("⚠️ TWO MINUTES REMAINING. Your chat logs draw closer to terminal erasure.");
    }
    if (godIsActive && remainingSeconds <= 5 && remainingSeconds > 0) {
      sendGodSms(`🚨 ${remainingSeconds} SECONDS REMAINING! Purification imminent.`);
    }
    if (remainingSeconds <= 0) {
      targetEndTimestamp = 0; 
      await purgeChatRoomLogs();
      const nextEnd = Date.now() + 600000;
      godIsActive = true; 
      warningTwoMinSent = false;
      currentAnswer = null;
      await setDoc(doc(db, "status", "timer_state"), { endTime: nextEnd });
    }
  }, 1000);

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

      const timeString = data.time ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
      const customUserColor = data.senderColor || "var(--accent)";
      const firstInitial = data.sender ? data.sender.charAt(0).toUpperCase() : "?";

      let cleanedMessage = data.message || "";
      if (cleanedMessage) {
        cleanedMessage = cleanedMessage.replace(/\$\$/g, "").replace(/\$/g, "").replace(/\\\[/g, "").replace(/\\\]/g, "").replace(/\\\(|\\\)/g, "").replace(/\\text\{([^}]+)\}/g, "$1").replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2"); 
      }

      let innerContent = "";
      if (!isConsecutive) {
        innerContent += `<div class="message-meta">
          <div class="user-avatar-circle" style="background:${customUserColor}">${firstInitial}</div>
          <span class="sender-name" style="color:${customUserColor}">${data.sender}</span>
        </div>`;
      }
      
      innerContent += `<div class="bubble-layout">`;
      if (data.image) innerContent += `<img src="${data.image}" class="chat-img" alt="shared photo">`;
      if (cleanedMessage) innerContent += `<div class="bubble" style="${isMe ? `background:${customUserColor};color:#111;` : ''}">${cleanedMessage}</div>`;
      innerContent += `<div class="bubble-sub"><span class="timestamp">${timeString}</span><span class="delete-single-btn" data-id="${msgId}" title="Delete Message">🗑️</span></div></div>`;
      
      msgElement.innerHTML = innerContent;
      chatHistory.appendChild(msgElement);
    });

    document.querySelectorAll(".delete-single-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const idToDelete = e.target.getAttribute("data-id");
        if (confirm("Delete this message?")) await deleteDoc(doc(db, "messages", idToDelete));
      });
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
  });

  onSnapshot(statusCollection, (snapshot) => {
    if (onlineUsersList) onlineUsersList.innerHTML = "";
    if (onlineUsersList) {
      const aiRow = document.createElement("div"); aiRow.className = "online-user-item";
      aiRow.innerHTML = `<div class="mini-avatar" style="background:#ff9f43">🤖</div> <span>AI Bot</span>`;
      onlineUsersList.appendChild(aiRow);

      const godRow = document.createElement("div"); godRow.className = "online-user-item";
      godRow.innerHTML = `<div class="mini-avatar" style="background:#ff4757">👁️</div> <span>GOD [${godIsActive ? "Online" : "Muted"}]</span>`;
      onlineUsersList.appendChild(godRow);
    }

    let typingUsers = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const isRecent = (Date.now() - data.lastSeen) < 120000;
      if (data.username !== "AI Bot" && data.username !== "GOD" && data.isOnline && isRecent) {
        if (onlineUsersList) {
          const firstLetter = data.username ? data.username.charAt(0).toUpperCase() : "?";
          const userRow = document.createElement("div"); userRow.className = "online-user-item";
          userRow.innerHTML = `<div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div><span>${data.username}</span>`;
          onlineUsersList.appendChild(userRow);
        }
        if (data.isTyping && data.username !== currentUsername) typingUsers.push(data.username);
      }
    });

    globalTypingDisplayString = typingUsers.length > 0 ? `✍️ ${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...` : "";
    combineFooterDisplays();
  });

  async function fetchAiReply(userPrompt) {
    try {
      updateAiPresence(true);
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "system", content: "You are a helpful, fast AI assistant inside a dev chat room." }, { role: "user", content: userPrompt }]
        })
      });
      const replyText = await response.text();
      await addDoc(messagesCollection, { sender: "AI Bot", senderColor: "#ff9f43", message: replyText ? replyText.trim() : "My processing space timed out. Try asking me again!", time: Date.now() });
    } catch (err) {
      console.error(err);
    } finally {
      updateAiPresence(false);
    }
  }

  if (messageArea) {
    messageArea.addEventListener("input", (e) => {
    
