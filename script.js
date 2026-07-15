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
  deleteDoc,
  writeBatch
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
let currentScale = 1;

const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;

let currentFontSize = parseInt(localStorage.getItem('chatFontSize')) || 16; 
const minFontSize = 8;
const maxFontSize = 46;

let targetEndTimestamp = 0;
let godIsActive = true;
let currentAnswer = null;
let warningTwoMinSent = false;

let globalTimerDisplayString = "";
let globalTypingDisplayString = "";

function applyChatFontSize(size) {
  let styleEl = document.getElementById('dynamic-font-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-font-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `.bubble, #message { font-size: ${size}px !important; }`;
  localStorage.setItem('chatFontSize', size);
}

document.addEventListener("DOMContentLoaded", () => {
  applyChatFontSize(currentFontSize);

  const sidebarEl = document.querySelector(".sidebar");
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
  const cameraInput = document.getElementById("cameraInput");
  const imagePreviewContainer = document.getElementById("imagePreviewContainer");
  const imagePreview = document.getElementById("imagePreview");
  const cancelImage = document.getElementById("cancelImage");
  
  const zoomModal = document.getElementById("zoomModal");
  const zoomedImage = document.getElementById("zoomedImage");
  const closeZoom = document.getElementById("closeZoom");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");

  const themeBtn = document.getElementById("themeBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  
  const incFontBtn = document.getElementById("incFontBtn");
  const decFontBtn = document.getElementById("decFontBtn");

  const onlineUsersList = document.getElementById("onlineUsersList");
  const typingIndicator = document.getElementById("typingIndicator");

  // Modern Navigation Minimise/Expand Button Implementation
  const terminalsToggleBtn = document.createElement("button");
  terminalsToggleBtn.id = "terminalsToggleBtn";
  terminalsToggleBtn.className = "secondary-btn";
  terminalsToggleBtn.title = "Toggle Terminals Panel Grid";
  terminalsToggleBtn.innerHTML = `
    <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
    <span>Terminals</span>
  `;
  
  const targetHeaderActions = document.querySelector(".header-actions");
  if (targetHeaderActions) {
    targetHeaderActions.insertBefore(terminalsToggleBtn, targetHeaderActions.firstChild);
  }

  // Toggle state triggers
  terminalsToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebarEl?.classList.toggle("mobile-expanded");
  });

  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 900 && sidebarEl?.classList.contains("mobile-expanded")) {
      if (!sidebarEl.contains(e.target) && e.target !== terminalsToggleBtn) {
        sidebarEl.classList.remove("mobile-expanded");
      }
    }
  });

  if (zoomModal) zoomModal.classList.add("hidden");
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

  async function updatePresence(isOnline, isTyping = false, oldName = "") {
    if (!currentUsername) return;
    if (oldName && oldName.toLowerCase() !== currentUsername.toLowerCase()) {
      const oldDocRef = doc(statusCollection, oldName.toLowerCase().replace(/\s+/g, '_'));
      await deleteDoc(oldDocRef).catch(err => console.error(err));
    }
    const userDocRef = doc(statusCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
    await setDoc(userDocRef, {
      username: currentUsername,
      color: currentUserColor,
      isOnline: isOnline,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true }).catch(err => console.error(err));
  }

  async function updateAiPresence(isTyping) {
    const aiDocRef = doc(statusCollection, "ai_bot");
    await setDoc(aiDocRef, {
      username: "AI Bot",
      color: "#ff9f43",
      isOnline: true,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true }).catch(err => console.error(err));
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

  window.addEventListener("beforeunload", () => { updatePresence(false, false); });

  function handleUserSetupSave() {
    if (!usernameInput) return;
    const newName = usernameInput.value.trim();
    if (newName) {
      const oldName = currentUsername;
      localStorage.setItem("chat_username", newName);
      localStorage.setItem("chat_user_color", currentUserColor);
      currentUsername = newName;
      updateIdentityDisplays();
      if (oldName && oldName !== newName) {
        updatePresence(true, false, oldName);
      }
    }
  }

  if (saveNameBtn) {
    saveNameBtn.addEventListener("click", handleUserSetupSave);
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

  async function processSelectedFile(file) {
    if (file && imagePreview && imagePreviewContainer) {
      selectedImageBase64 = await compressImage(file);
      imagePreview.src = selectedImageBase64;
      imagePreviewContainer.classList.remove("hidden");
    }
  }

  if (imageInput) {
    imageInput.addEventListener("change", async (e) => {
      if (e.target.files.length > 0) await processSelectedFile(e.target.files[0]);
    });
  }

  if (cameraInput) {
    cameraInput.addEventListener("change", async (e) => {
      if (e.target.files.length > 0) await processSelectedFile(e.target.files[0]);
    });
  }

  if (cancelImage) {
    cancelImage.addEventListener("click", () => {
      selectedImageBase64 = "";
      if (imageInput) imageInput.value = "";
      if (cameraInput) cameraInput.value = "";
      if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
    });
  }

  async function purgeChatRoomLogs() {
    try {
      const querySnapshot = await getDocs(messagesCollection);
      if (querySnapshot.empty) return;
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnapshot) => { batch.delete(docSnapshot.ref); });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  }

  async function sendGodSms(textPayload) {
    await addDoc(messagesCollection, {
      sender: "GOD",
      senderColor: "#ff4757",
      message: textPayload,
      time: Date.now()
    }).catch(err => console.error(err));
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
      await setDoc(doc(db, "status", "timer_state"), { endTime: freshEnd }).catch(e => console.error(e));
    }
  });

  setInterval(async () => {
    if (!targetEndTimestamp) return;
    const now = Date.now();
    let remainingSeconds = Math.max(0, Math.floor((targetEndTimestamp - now) / 1000));
    const minutesLeft = Math.floor(remainingSeconds / 60);
    const secondsLeft = remainingSeconds % 60;

    globalTimerDisplayString = `Purge in: ${minutesLeft}m ${secondsLeft}s [God: ${godIsActive ? "👁️" : "🤐"}]`;
    combineFooterDisplays();

    if (godIsActive && remainingSeconds === 120 && !warningTwoMinSent) {
      warningTwoMinSent = true;
      sendGodSms("⚠️ TWO MINUTES REMAINING. Chat logs draw closer to erasure.");
    }
    if (godIsActive && remainingSeconds <= 5 && remainingSeconds > 0) {
      sendGodSms(`🚨 ${remainingSeconds} SECONDS REMAINING!`);
    }
    if (remainingSeconds <= 0) {
      targetEndTimestamp = 0; 
      await purgeChatRoomLogs();
      const nextEnd = Date.now() + 600000;
      godIsActive = true; 
      warningTwoMinSent = false;
      currentAnswer = null;
      await setDoc(doc(db, "status", "timer_state"), { endTime: nextEnd }).catch(e => console.error(e));
    }
  }, 1000);

  if (chatHistory) {
    chatHistory.addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-single-btn")) {
        const idToDelete = e.target.getAttribute("data-id");
        if (idToDelete && confirm("Delete this message?")) {
          await deleteDoc(doc(db, "messages", idToDelete)).catch(err => console.error(err));
        }
      }
      if (e.target.classList.contains("chat-img")) {
        if (zoomedImage && zoomModal) {
          zoomedImage.src = e.target.src;
          currentScale = 1;
          zoomedImage.style.transform = `scale(${currentScale})`;
          zoomModal.classList.remove("hidden");
        }
      }
    });
  }

  const qMessages = query(messagesCollection, orderBy("time", "asc"));
  onSnapshot(qMessages, (snapshot) => {
    if (!chatHistory) return;
    chatHistory.innerHTML = "";
    if (snapshot.empty) {
      chatHistory.innerHTML = `<div class="system-msg">Room empty. Talk while you can...</div>`;
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
        cleanedMessage = cleanedMessage
          .replace(/\$\$/g, "").replace(/\$/g, "").replace(/\\\[/g, "").replace(/\\\]/g, "")
          .replace(/\\\(|\\\)/g, "").replace(/\\text\{([^}]+)\}/g, "$1")
          .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2"); 
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
      
      innerContent += `
          <div class="bubble-sub">
            <span class="timestamp">${timeString}</span>
            <span class="delete-single-btn" data-id="${msgId}">🗑️</span>
          </div>
        </div>
      `;
      msgElement.innerHTML = innerContent;
      chatHistory.appendChild(msgElement);
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
  });

  window.visualViewport?.addEventListener("resize", () => {
     setTimeout(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; }, 100);
  });

  onSnapshot(statusCollection, (snapshot) => {
    if (onlineUsersList) onlineUsersList.innerHTML = "";
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

    let typingUsers = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const isRecent = (Date.now() - data.lastSeen) < 120000;
      if (data.username !== "AI Bot" && data.username !== "GOD" && data.isOnline && isRecent) {
        if (onlineUsersList) {
          const firstLetter = data.username ? data.username.charAt(0).toUpperCase() : "?";
          const userRow = document.createElement("div");
          userRow.className = "online-user-item";
          userRow.innerHTML = `<div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div><span>${data.username}</span>`;
          onlineUsersList.appendChild(userRow);
        }
        if (data.isTyping && data.username !== currentUsername) typingUsers.push(data.username);
      }
    });

    globalTypingDisplayString = typingUsers.length > 0 ? `✍️ ${typingUsers.join(", ")} typing...` : "";
    combineFooterDisplays();
  });

  async function fetchAiReply(userPrompt) {
    try {
      updateAiPresence(true);
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a helpful AI assistant inside a developer chat room." },
            { role: "user", content: userPrompt }
          ]
        })
      });
      const replyText = await response.text();
      await addDoc(messagesCollection, {
        sender: "AI Bot",
        senderColor: "#ff9f43",
        message: replyText ? replyText.trim() : "Timed out. Try again!",
        time: Date.now()
      });
    } catch (err) {
      console.error(err);
    } finally {
      updateAiPresence(false);
    }
  }

  if (messageArea) {
    messageArea.addEventListener("input", (e) => {
      localStorage.setItem("chat_draft", e.target.value);
      updatePresence(true, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => { updatePresence(true, false); }, 2500);
    });
    messageArea.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); sendBtn.click(); }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      if (!messageArea) return;
      const text = messageArea.value.trim();
      if (!text && !selectedImageBase64) return;

      if (godIsActive && currentAnswer !== null) {
        if (parseInt(text) === currentAnswer) {
          godIsActive = false; currentAnswer = null; messageArea.value = "";
          await sendGodSms("❌ Command approved. Silenced until reset."); return;
        } else {
          messageArea.value = ""; await sendGodSms("❌ INCORRECT."); return;
        }
      }

      if (text.toLowerCase() === "/removegod") {
        messageArea.value = "";
        if (!godIsActive) { await sendGodSms("Already muted."); return; }
        const mathQuestion = makeHardQuestion();
        await sendGodSms(`⚡ CHALLENGE: ${mathQuestion}`); return;
      }

      await addDoc(messagesCollection, {
        sender: currentUsername || "Anonymous",
        senderColor: currentUserColor,
        message: text,
        image: selectedImageBase64,
        time: Date.now()
      }).catch(err => console.error(err));

      messageArea.value = "";
      localStorage.removeItem("chat_draft");
      selectedImageBase64 = "";
      if (imageInput) imageInput.value = "";
      if (cameraInput) cameraInput.value = "";
      if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
      clearTimeout(typingTimeout);
      updatePresence(true, false);

      if (text.toLowerCase().startsWith("@ai")) {
        const cleanedPrompt = text.replace(/^@ai\s*/i, "").trim();
        if (cleanedPrompt) fetchAiReply(cleanedPrompt);
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

  if (incFontBtn && decFontBtn) {
    incFontBtn.addEventListener("click", () => { if (currentFontSize < maxFontSize) { currentFontSize += 2; applyChatFontSize(currentFontSize); } });
    decFontBtn.addEventListener("click", () => { if (currentFontSize > minFontSize) { currentFontSize -= 2; applyChatFontSize(currentFontSize); } });
  }

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", async () => {
      if (confirm("Clear entire chat log?")) await purgeChatRoomLogs();
    });
  }

  if (zoomInBtn && zoomedImage) { zoomInBtn.addEventListener("click", () => { currentScale += 0.25; zoomedImage.style.transform = `scale(${currentScale})`; }); }
  if (zoomOutBtn && zoomedImage) { zoomOutBtn.addEventListener("click", () => { if (currentScale > 0.5) { currentScale -= 0.25; zoomedImage.style.transform = `scale(${currentScale})`; } }); }
  if (closeZoom && zoomModal) { closeZoom.addEventListener("click", () => { zoomModal.classList.add("hidden"); }); }

  const scrollBtn = document.createElement("button");
  scrollBtn.id = "scrollBottomBtn";
  scrollBtn.type = "button";
  scrollBtn.textContent = "⬇";
  document.querySelector(".chat-container")?.appendChild(scrollBtn);
  scrollBtn.addEventListener("click", () => { chatHistory?.scrollTo({ top: chatHistory.scrollHeight, behavior: "smooth" }); });
  chatHistory?.addEventListener("scroll", () => {
    const nearBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight < 80;
    scrollBtn.style.display = nearBottom ? "none" : "flex";
  });
});
