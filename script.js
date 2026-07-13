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
let currentScale = 1; // Tracks current zoom level

const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;

let targetEndTimestamp = 0;
let godIsActive = true;
let currentAnswer = null;
let warningTwoMinSent = false;

// Global Layout Track Memory Management
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
  
  // Image Selection Elements
  const imageInput = document.getElementById("imageInput");
  const cameraInput = document.getElementById("cameraInput");
  const imagePreviewContainer = document.getElementById("imagePreviewContainer");
  const imagePreview = document.getElementById("imagePreview");
  const cancelImage = document.getElementById("cancelImage");
  
  // Zoom Elements
  const zoomModal = document.getElementById("zoomModal");
  const zoomedImage = document.getElementById("zoomedImage");
  const closeZoom = document.getElementById("closeZoom");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");

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

  async function updatePresence(isOnline, isTyping = false, oldName = "") {
    if (!currentUsername) return;

    if (oldName && oldName.toLowerCase() !== currentUsername.toLowerCase()) {
      const oldDocRef = doc(statusCollection, oldName.toLowerCase().replace(/\s+/g, '_'));
      await deleteDoc(oldDocRef).catch(err => console.error("Old identity clearance failed:", err));
    }

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
    saveNameBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      handleUserSetupSave();
    });
  }

  if (changeNameBtn && usernameInput && nameModal) {
    const openModal = () => {
      usernameInput.value = currentUsername;
      nameModal.classList.remove("hidden-modal");
    };
    changeNameBtn.addEventListener("click", openModal);
    changeNameBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      openModal();
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

  // Unified File Processor for both Camera and Gallery
  async function processSelectedFile(file) {
    if (file && imagePreview && imagePreviewContainer) {
      selectedImageBase64 = await compressImage(file);
      imagePreview.src = selectedImageBase64;
      imagePreviewContainer.classList.remove("hidden");
    }
  }

  if (imageInput) {
    imageInput.addEventListener("change", async (e) => {
      await processSelectedFile(e.target.files[0]);
    });
  }

  if (cameraInput) {
    cameraInput.addEventListener("change", async (e) => {
      await processSelectedFile(e.target.files[0]);
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
    const querySnapshot = await getDocs(messagesCollection);
    for (const docSnapshot of querySnapshot.docs) {
      await deleteDoc(docSnapshot.ref);
    }
  }

  async function sendGodSms(textPayload) {
    await addDoc(messagesCollection, {
      sender: "GOD",
      senderColor: "#ff4757",
      message: textPayload,
      time: Date.now()
    });
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

    globalTimerDisplayString = `Room Purge in: ${minutesLeft}m ${secondsLeft}s [God Mode: ${godIsActive ? "👁️ ACTIVE" : "🤐 MUTED"}]`;
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

      const timeString = data.time 
        ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : "";

      const customUserColor = data.senderColor || "var(--accent)";
      const firstInitial = data.sender ? data.sender.charAt(0).toUpperCase() : "?";

      let cleanedMessage = data.message || "";
      if (cleanedMessage) {
        cleanedMessage = cleanedMessage
          .replace(/\$\$/g, "")
          .replace(/\$/g, "")
          .replace(/\\\[/g, "")
          .replace(/\\\]/g, "")
          .replace(/\\\(|\\\)/g, "")
          .replace(/\\text\{([^}]+)\}/g, "$1")
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
      if (data.image) {
        innerContent += `<img src="${data.image}" class="chat-img" alt="shared photo">`;
      }
      if (cleanedMessage) {
        innerContent += `<div class="bubble" style="${isMe ? `background:${customUserColor};color:#111;` : ''}">${cleanedMessage}</div>`;
      }
      
      innerContent += `
          <div class="bubble-sub">
            <span class="timestamp">${timeString}</span>
            <span class="delete-single-btn" data-id="${msgId}" title="Delete Message">🗑️</span>
          </div>
        </div>
      `;

      msgElement.innerHTML = innerContent;
      chatHistory.appendChild(msgElement);
    });

    // Wire up Delete Message Buttons
    document.querySelectorAll(".delete-single-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const idToDelete = e.target.getAttribute("data-id");
        if (confirm("Delete this message?")) {
          await deleteDoc(doc(db, "messages", idToDelete));
        }
      });
    });

    // Wire up Lightbox Zoom on Chat Images
    document.querySelectorAll(".chat-img").forEach(img => {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", (e) => {
        if (zoomedImage && zoomModal) {
          zoomedImage.src = e.target.src;
          currentScale = 1; 
          zoomedImage.style.transform = `scale(${currentScale})`;
          zoomModal.classList.remove("hidden");
        }
      });
    });

    chatHistory.scrollTo({
      top: chatHistory.scrollHeight,
      behavior: "smooth"
    });
    
    window.visualViewport?.addEventListener("resize",()=>{
       setTimeout(()=>{
         const ch=document.getElementById("chatHistory");
         if(ch) ch.scrollTop=ch.scrollHeight;
       },100);
    });
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
          userRow.innerHTML = `
            <div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div>
            <span>${data.username}</span>
          `;
          onlineUsersList.appendChild(userRow);
        }

        if (data.isTyping && data.username !== currentUsername) {
          typingUsers.push(data.username);
        }
      }
    });

    if (typingUsers.length > 0) {
      globalTypingDisplayString = `✍️ ${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...`;
    } else {
      globalTypingDisplayString = "";
    }
    combineFooterDisplays();
  });

  // ==========================================
  // AI Integration via Groq API
  // ==========================================
  async function fetchAiReply(userPrompt) {
    try {
      updateAiPresence(true);
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer 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"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-specdec", 
          messages: [
            { role: "system", content: "You are a helpful, conversational, super fast AI assistant inside a developer chat room." },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.choices?.[0]?.message?.content;
      
      await addDoc(messagesCollection, {
        sender: "AI Bot",
        senderColor: "#ff9f43",
        message: replyText ? replyText.trim() : "My processing space timed out. Try asking me again!",
        time: Date.now()
      });
    } catch (err) {
      console.error("AI Fetch Failure:", err);
      await addDoc(messagesCollection, {
        sender: "AI Bot",
        senderColor: "#ff9f43",
        message: "❌ Failed to fetch reply from AI. Check connection or API keys.",
        time: Date.now()
      });
    } finally {
      updateAiPresence(false);
    }
  }

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

      if (godIsActive && currentAnswer !== null) {
        if (parseInt(text) === currentAnswer) {
          godIsActive = false;
          currentAnswer = null;
          messageArea.value = "";
          await sendGodSms("❌ Direct interface command approved. I am silenced until the cycle resets.");
          return;
        } else {
          messageArea.value = "";
          await sendGodSms("❌ INCORRECT. Try again or face total deletion.");
          return;
        }
      }

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
      if (cameraInput) cameraInput.value = "";
      if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
      
      clearTimeout(typingTimeout);
      updatePresence(true, false);

      if (text.toLowerCase().startsWith("@ai")) {
        const cleanedPrompt = text.replace(/^@ai\s*/i, "").trim();
        
        if (cleanedPrompt) {
          fetchAiReply(cleanedPrompt);
        } else {
          await addDoc(messagesCollection, {
            sender: "AI Bot",
            senderColor: "#ff9f43",
            message: "👋 I'm listening! Type `@ai` followed by your question.",
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
    clearChatBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to completely clear the entire chat log?")) {
        await purgeChatRoomLogs();
      }
    });
  }

  // Lightbox Control Buttons
  if (zoomInBtn && zoomedImage) {
    zoomInBtn.addEventListener("click", () => {
      currentScale += 0.25;
      zoomedImage.style.transform = `scale(${currentScale})`;
    });
  }

  if (zoomOutBtn && zoomedImage) {
    zoomOutBtn.addEventListener("click", () => {
      if (currentScale > 0.5) { 
        currentScale -= 0.25;
        zoomedImage.style.transform = `scale(${currentScale})`;
      }
    });
  }

  if (closeZoom && zoomModal) {
    closeZoom.addEventListener("click", () => {
      zoomModal.classList.add("hidden");
    });
  }

  // Mobile scroll helper
  const scrollBtn = document.createElement("button");
  scrollBtn.id = "scrollBottomBtn";
  scrollBtn.type = "button";
  scrollBtn.textContent = "⬇";
  scrollBtn.title = "Scroll to latest message";
  document.querySelector(".chat-container")?.appendChild(scrollBtn);

  const scrollToLatest = () => {
    if (!chatHistory) return;
    chatHistory.scrollTo({
      top: chatHistory.scrollHeight,
      behavior: "smooth"
    });
  };

  scrollBtn.addEventListener("click", scrollToLatest);

  chatHistory?.addEventListener("scroll", () => {
    const nearBottom =
      chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight < 80;
    scrollBtn.style.display = nearBottom ? "none" : "flex";
  });
});
