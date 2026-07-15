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
  writeBatch,
  where
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
const chatsCollection = collection(db, "chats");

let currentUsername = localStorage.getItem("chat_username") || "";
let currentUserColor = localStorage.getItem("chat_user_color") || "#00d2d3";
let selectedImageBase64 = "";
let typingTimeout = null;
let currentScale = 1;

const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;

// Dynamic Font Size Configuration (Mega Small & Mega Big Limits)
let currentFontSize = parseInt(localStorage.getItem('chatFontSize')) || 22; 
const minFontSize = 8;   // Mega small (Microscopic mode)
const maxFontSize = 46;  // Mega big (Absolute giant mode)

let targetEndTimestamp = 0;
let godIsActive = true;
let currentAnswer = null;
let warningTwoMinSent = false;

let globalTimerDisplayString = "";
let globalTypingDisplayString = "";

// --- Private Chat / Invite Code System ---
let myCode = localStorage.getItem("chat_user_code") || generateInviteCode();
let activeChatType = "global";   // "global" | "private"
let activeChatId = null;         // Firestore doc id of the private chat room (null for global)
let activeChatLabel = "Global Chat";
let unsubscribeMessages = null;
let unsubscribeChatList = null;

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars like 0/O, 1/I
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  localStorage.setItem("chat_user_code", code);
  return code;
}

function getPrivateChatId(nameA, nameB) {
  return [nameA.toLowerCase(), nameB.toLowerCase()].sort().join("__");
}

function getActiveMessagesRef() {
  if (activeChatType === "private" && activeChatId) {
    return collection(db, "chats", activeChatId, "messages");
  }
  return messagesCollection;
}

// Helper function to dynamically update the font size across the chat
function applyChatFontSize(size) {
  let styleEl = document.getElementById('dynamic-font-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-font-style';
    document.head.appendChild(styleEl);
  }
  
  styleEl.innerHTML = `
    .bubble, #message { 
        font-size: ${size}px !important; 
    }
  `;
  
  localStorage.setItem('chatFontSize', size);
}

document.addEventListener("DOMContentLoaded", () => {
  // Apply the saved or default font size immediately on load
  applyChatFontSize(currentFontSize);

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
  
  // Font Size Buttons
  const incFontBtn = document.getElementById("incFontBtn");
  const decFontBtn = document.getElementById("decFontBtn");

  const onlineUsersList = document.getElementById("onlineUsersList");
  const typingIndicator = document.getElementById("typingIndicator");

  // FIXED: Force the lightbox overlay to hidden on boot up. This drops any unhandled blocking on desktop views.
  if (zoomModal) {
    zoomModal.classList.add("hidden");
  }

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
      code: myCode,
      isOnline: isOnline,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true }).catch(err => console.error("Presence update failed:", err));
  }

  async function updateAiPresence(isTyping) {
    const aiDocRef = doc(statusCollection, "ai_bot");
    await setDoc(aiDocRef, {
      username: "AI Bot",
      color: "#ff9f43",
      isOnline: true,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true }).catch(err => console.error("AI presence update failed:", err));
  }

  function updateIdentityDisplays() {
    if (!nameModal) return;
    if (currentUsername) {
      if (currentUserDisplay) currentUserDisplay.textContent = `User: ${currentUsername}`;
      if (mobileUserDisplay) mobileUserDisplay.textContent = `Profile: ${currentUsername}`;
      nameModal.classList.add("hidden-modal");
      updatePresence(true, false);
      subscribeToChatList();
    } else {
      nameModal.classList.remove("hidden-modal");
    }
  }
  updateIdentityDisplays();

  // --- Mobile sidebar (chats drawer) open/close ---
  function openSidebar() {
    sidebar?.classList.add("open");
    sidebarBackdrop?.classList.add("show");
  }
  function closeSidebar() {
    sidebar?.classList.remove("open");
    sidebarBackdrop?.classList.remove("show");
  }
  menuToggleBtn?.addEventListener("click", openSidebar);
  closeSidebarBtn?.addEventListener("click", closeSidebar);
  sidebarBackdrop?.addEventListener("click", closeSidebar);

  // --- Copy invite code ---
  copyCodeBtn?.addEventListener("click", () => {
    navigator.clipboard?.writeText(myCode).then(() => {
      copyCodeBtn.textContent = "✅";
      setTimeout(() => { copyCodeBtn.textContent = "📋"; }, 1200);
    }).catch(() => {});
  });

  // --- Switching between Global chat and a private chat ---
  function switchToChat(type, chatId, label) {
    activeChatType = type;
    activeChatId = chatId;
    activeChatLabel = label;
    if (chatTitle) chatTitle.textContent = `💬 ${label}`;
    highlightActiveChatItem();
    subscribeToMessages();
    closeSidebar();
  }

  function highlightActiveChatItem() {
    document.querySelectorAll(".chat-list-item").forEach(item => {
      const isActive = (item.dataset.type === activeChatType) &&
        (item.dataset.type === "global" || item.dataset.chatId === activeChatId);
      item.classList.toggle("active", isActive);
    });
  }

  // --- Render the sidebar chat list (Global + private chats) ---
  function renderChatList(privateChats) {
    if (!chatList) return;
    chatList.innerHTML = "";

    const globalItem = document.createElement("div");
    globalItem.className = "chat-list-item";
    globalItem.dataset.type = "global";
    globalItem.innerHTML = `<div class="mini-avatar" style="background:var(--accent)">🌍</div><span class="chat-name">Global Chat</span>`;
    globalItem.addEventListener("click", () => switchToChat("global", null, "Global Chat"));
    chatList.appendChild(globalItem);

    privateChats.forEach(chat => {
      const myKey = currentUsername.toLowerCase().replace(/\s+/g, '_');
      const otherKey = chat.participants.find(p => p !== myKey);
      const otherName = (chat.participantNames && chat.participantNames[otherKey]) || "Unknown";
      const firstInitial = otherName.charAt(0).toUpperCase();

      const item = document.createElement("div");
      item.className = "chat-list-item";
      item.dataset.type = "private";
      item.dataset.chatId = chat.id;
      item.innerHTML = `<div class="mini-avatar" style="background:#a55eea">${firstInitial}</div><span class="chat-name">${otherName}</span>`;
      item.addEventListener("click", () => switchToChat("private", chat.id, otherName));
      chatList.appendChild(item);
    });

    highlightActiveChatItem();
  }

  function subscribeToChatList() {
    if (!currentUsername) return;
    if (unsubscribeChatList) unsubscribeChatList();

    const myKey = currentUsername.toLowerCase().replace(/\s+/g, '_');
    const chatsQuery = query(chatsCollection, where("participants", "array-contains", myKey));

    unsubscribeChatList = onSnapshot(chatsQuery, (snapshot) => {
      const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderChatList(chats);
    }, (err) => console.error("Chat list subscription failed:", err));
  }

  // --- Add Friend (start private chat via invite code) ---
  function openAddFriendModal() {
    if (friendCodeInput) friendCodeInput.value = "";
    if (addFriendError) addFriendError.classList.add("hidden");
    addFriendModal?.classList.remove("hidden-modal");
    closeSidebar();
  }
  function closeAddFriendModal() {
    addFriendModal?.classList.add("hidden-modal");
  }
  function showAddFriendError(msg) {
    if (!addFriendError) return;
    addFriendError.textContent = msg;
    addFriendError.classList.remove("hidden");
  }

  addFriendBtn?.addEventListener("click", openAddFriendModal);
  cancelFriendCodeBtn?.addEventListener("click", closeAddFriendModal);

  submitFriendCodeBtn?.addEventListener("click", async () => {
    if (!friendCodeInput) return;
    const enteredCode = friendCodeInput.value.trim().toUpperCase();
    if (!enteredCode) return;

    if (enteredCode === myCode) {
      showAddFriendError("That's your own code! Share it with a friend instead.");
      return;
    }

    try {
      const q = query(statusCollection, where("code", "==", enteredCode));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showAddFriendError("No user found with that code. Double-check and try again.");
        return;
      }

      const friendDoc = snapshot.docs[0].data();
      const friendUsername = friendDoc.username;
      const myKey = currentUsername.toLowerCase().replace(/\s+/g, '_');
      const friendKey = friendUsername.toLowerCase().replace(/\s+/g, '_');
      const chatId = getPrivateChatId(myKey, friendKey);

      await setDoc(doc(chatsCollection, chatId), {
        participants: [myKey, friendKey],
        participantNames: {
          [myKey]: currentUsername,
          [friendKey]: friendUsername
        },
        createdAt: Date.now()
      }, { merge: true });

      closeAddFriendModal();
      switchToChat("private", chatId, friendUsername);
    } catch (err) {
      console.error("Add friend failed:", err);
      showAddFriendError("Something went wrong. Please try again.");
    }
  });

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
      const querySnapshot = await getDocs(getActiveMessagesRef());
      if (querySnapshot.empty) return;
      
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Batch room clearance failure:", err);
    }
  }

  async function sendGodSms(textPayload) {
    await addDoc(messagesCollection, {
      sender: "GOD",
      senderColor: "#ff4757",
      message: textPayload,
      time: Date.now()
    }).catch(err => console.error("God automation dispatch error:", err));
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
      
      await setDoc(doc(db, "status", "timer_state"), { endTime: nextEnd }).catch(e => console.error(e));
    }
  }, 1000);

  if (chatHistory) {
    chatHistory.addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-single-btn")) {
        const idToDelete = e.target.getAttribute("data-id");
        if (idToDelete && confirm("Delete this message?")) {
          await deleteDoc(doc(getActiveMessagesRef(), idToDelete)).catch(err => console.error(err));
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

  function subscribeToMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const qMessages = query(getActiveMessagesRef(), orderBy("time", "asc"));
    unsubscribeMessages = onSnapshot(qMessages, renderMessagesSnapshot, (err) => console.error("Message subscription failed:", err));
  }

  function renderMessagesSnapshot(snapshot) {
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

    chatHistory.scrollTo({
      top: chatHistory.scrollHeight,
      behavior: "smooth"
    });
  }

  subscribeToMessages();

  window.visualViewport?.addEventListener("resize", () => {
     setTimeout(() => {
       if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
     }, 100);
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

  async function fetchAiReply(userPrompt) {
    try {
      updateAiPresence(true);
      
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a helpful, conversational, super fast AI assistant inside a developer chat room." },
            { role: "user", content: userPrompt }
          ]
        })
      });

      const replyText = await response.text();
      
      await addDoc(getActiveMessagesRef(), {
        sender: "AI Bot",
        senderColor: "#ff9f43",
        message: replyText ? replyText.trim() : "My processing space timed out. Try asking me again!",
        time: Date.now()
      });
    } catch (err) {
      console.error("AI Fetch Failure:", err);
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
        e.preventDefault(); 
        sendBtn.click();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      if (!messageArea) return;
      const text = messageArea.value.trim();
      if (!text && !selectedImageBase64) return;

      if (activeChatType === "global" && godIsActive && currentAnswer !== null) {
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

      if (activeChatType === "global" && text.toLowerCase() === "/removegod") {
        messageArea.value = "";
        if (!godIsActive) {
          await sendGodSms("I am already muted this round.");
          return;
        }
        const mathQuestion = makeHardQuestion();
        await sendGodSms(`⚡ SYSTEM CHALLENGE ENFORCED: ${mathQuestion}`);
        return;
      }

      await addDoc(getActiveMessagesRef(), {
        sender: currentUsername || "Anonymous",
        senderColor: currentUserColor,
        message: text,
        image: selectedImageBase64,
        time: Date.now()
      }).catch(err => console.error("Message send failure:", err));

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
          await addDoc(getActiveMessagesRef(), {
            sender: "AI Bot",
            senderColor: "#ff9f43",
            message: "👋 I'm listening! Type `@ai` followed by your question.",
            time: Date.now()
          });
        }
      }
    });
  }

  // --- Theme & Font Settings Events ---
  if (themeBtn && chatContainer) {
    themeBtn.addEventListener("click", () => {
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      localStorage.setItem("chat_theme_index", currentThemeIndex);
      chatContainer.style.backgroundColor = themes[currentThemeIndex];
    });
  }

  if (incFontBtn && decFontBtn) {
    incFontBtn.addEventListener("click", () => {
      if (currentFontSize < maxFontSize) {
        currentFontSize += 2;
        applyChatFontSize(currentFontSize);
      }
    });
    
    decFontBtn.addEventListener("click", () => {
      if (currentFontSize > minFontSize) {
        currentFontSize -= 2;
        applyChatFontSize(currentFontSize);
      }
    });
  }
  // ------------------------------------

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to completely clear the entire chat log?")) {
        await purgeChatRoomLogs();
      }
    });
  }

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
