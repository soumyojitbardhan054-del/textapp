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
  getDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================================
// 01. FIREBASE NETWORK ARCHITECTURE
// ==========================================================================
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
const usernamesCollection = collection(db, "users");

// ==========================================================================
// 02. SYSTEM STATE VARIABLES
// ==========================================================================
let currentUsername = localStorage.getItem("chat_username") || "";
let currentUserColor = localStorage.getItem("chat_user_color") || "#00d2d3";
let selectedImageBase64 = "";
let typingTimeout = null;
let aiContextMemory = [];

// Reply Context State Engine
let replyToMessageId = null;
let replyToSender = "";
let replyToText = "";

// Theme & Viewport Scaling Configuration
const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;
let currentFontSize = parseInt(localStorage.getItem('chatFontSize')) || 14; // Default starting font size
const minFontSize = 10;
const maxFontSize = 32;

// Swipe Gallery Context Variables
let galleryImages = [];
let currentGalleryIndex = 0;
let swipeStartX = 0;
let swipeCurrentX = 0;
let isSwiping = false;
let currentScale = 1;

/**
 * Dynamically binds variable style layers for real-time fluid resizing overrides
 */
function applyChatFontSize(size) {
  let styleEl = document.getElementById('dynamic-font-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-font-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `
    .bubble, #message { font-size: ${size}px !important; }
    /* Mobile Tap Visibility Overrides */
    .message-wrapper.show-controls .bubble-sub { opacity: 1 !important; visibility: visible !important; }
  `;
  localStorage.setItem('chatFontSize', size);
}

/**
 * Validates if user falls under Admin Clearance profiles
 */
function checkAdminStatus(name) {
  if (!name) return false;
  const clean = name.trim().toLowerCase();
  return clean === "ace" || clean === "ghost";
}

document.addEventListener("DOMContentLoaded", () => {
  applyChatFontSize(currentFontSize);

  // Element Cache Matrix
  const nameModal = document.getElementById("nameModal");
  const usernameInput = document.getElementById("usernameInput");
  const usernameFeedback = document.getElementById("usernameFeedback");
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
  const swipeContainer = document.getElementById("swipeContainer");
  const viewerIndexDisplay = document.getElementById("viewerIndexDisplay");
  const closeZoom = document.getElementById("closeZoom");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");

  const themeBtn = document.getElementById("themeBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const incFontBtn = document.getElementById("incFontBtn");
  const decFontBtn = document.getElementById("decFontBtn");

  const onlineUsersList = document.getElementById("onlineUsersList");
  const typingIndicator = document.getElementById("typingIndicator");

  if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];
  if (messageArea) messageArea.value = localStorage.getItem("chat_draft") || "";

  // ==========================================================================
  // 03. REPLY SYSTEM UI INJECTION & MANAGER
  // ==========================================================================
  function getOrCreateReplyContainer() {
    let replyBox = document.getElementById("replyContainer");
    if (!replyBox) {
      const inputArea = document.querySelector(".input-area");
      const actionBarContainer = document.querySelector(".action-bar-container");
      if (inputArea && actionBarContainer) {
        replyBox = document.createElement("div");
        replyBox.id = "replyContainer";
        replyBox.className = "reply-container hidden";
        replyBox.innerHTML = `
          <div class="reply-content">
            <svg class="reply-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17H7A5 5 0 0 1 7 7h10a5 5 0 0 1 0 10H13M9 17l4-4M9 17l4 4"/></svg>
            <div class="reply-details">
              <span class="reply-label" id="replyLabel">Replying to Username</span>
              <span class="reply-text-preview" id="replyPreview">Preview Message</span>
            </div>
          </div>
          <button type="button" class="cancel-reply-btn" id="cancelReplyBtn" title="Cancel Reply">✕</button>
        `;
        inputArea.insertBefore(replyBox, actionBarContainer);
        
        document.getElementById("cancelReplyBtn").addEventListener("click", clearReplyContext);
      }
    }
    return replyBox;
  }

  function initiateReply(id, sender, text) {
    replyToMessageId = id;
    replyToSender = sender;
    replyToText = text;

    const replyBox = getOrCreateReplyContainer();
    if (replyBox) {
      document.getElementById("replyLabel").textContent = `Replying to @${sender}`;
      document.getElementById("replyPreview").textContent = text || "[Image Asset]";
      replyBox.classList.remove("hidden");
    }
    if (messageArea) messageArea.focus();
  }

  function clearReplyContext() {
    replyToMessageId = null;
    replyToSender = "";
    replyToText = "";
    const replyBox = document.getElementById("replyContainer");
    if (replyBox) {
      replyBox.classList.add("hidden");
    }
  }

  // ==========================================================================
  // 04. SIDEBAR & IDENTITY CONTROLS
  // ==========================================================================
  const activeUsersPanel = document.querySelector(".active-users-panel");
  const panelHeader = document.querySelector(".panel-header");
  if (panelHeader && activeUsersPanel) {
    panelHeader.addEventListener("click", () => {
      activeUsersPanel.classList.toggle("minimized");
    });
  }

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

  let lookupTimeout = null;
  if (usernameInput) {
    usernameInput.addEventListener("input", () => {
      clearTimeout(lookupTimeout);
      const nameToCheck = usernameInput.value.trim();
      if (!nameToCheck) {
        usernameFeedback.textContent = "";
        return;
      }
      if (currentUsername && nameToCheck.toLowerCase() === currentUsername.toLowerCase()) {
        usernameFeedback.textContent = "✓ Currently Assigned to Current Session";
        usernameFeedback.style.color = "#1dd1a1";
        return;
      }

      lookupTimeout = setTimeout(async () => {
        const docRef = doc(usernamesCollection, nameToCheck.toLowerCase().replace(/\s+/g, '_'));
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          usernameFeedback.textContent = "✕ Network signature matches taken profile";
          usernameFeedback.style.color = "#ff4757";
        } else {
          usernameFeedback.textContent = "✓ Signature Available across Cluster";
          usernameFeedback.style.color = "#1dd1a1";
        }
      }, 400);
    });
  }

  async function updatePresence(isOnline, isTyping = false, oldName = "") {
    if (!currentUsername) return;
    if (oldName && oldName.toLowerCase() !== currentUsername.toLowerCase()) {
      const oldDocRef = doc(statusCollection, oldName.toLowerCase().replace(/\s+/g, '_'));
      await deleteDoc(oldDocRef).catch(() => {});
    }
    const userDocRef = doc(statusCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
    await setDoc(userDocRef, {
      username: currentUsername,
      color: currentUserColor,
      isOnline: isOnline,
      isTyping: isTyping,
      isAdmin: checkAdminStatus(currentUsername),
      lastSeen: Date.now()
    }, { merge: true }).catch(() => {});
  }

  async function updateAiPresence(isTyping) {
    const aiDocRef = doc(statusCollection, "ai_bot");
    await setDoc(aiDocRef, {
      username: "AI Bot",
      color: "#ff9f43",
      isOnline: true,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true }).catch(() => {});
  }

  function updateIdentityDisplays() {
    if (!nameModal) return;
    if (currentUsername) {
      const tag = checkAdminStatus(currentUsername) ? " [ADMIN]" : "";
      if (currentUserDisplay) currentUserDisplay.textContent = `${currentUsername}${tag}`;
      if (mobileUserDisplay) mobileUserDisplay.textContent = `Node: ${currentUsername}${tag}`;
      nameModal.classList.add("hidden-modal");
      updatePresence(true, false);
    } else {
      nameModal.classList.remove("hidden-modal");
    }
  }
  updateIdentityDisplays();

  window.addEventListener("beforeunload", () => updatePresence(false, false));

  async function handleUserSetupSave() {
    if (!usernameInput) return;
    const newName = usernameInput.value.trim();
    if (!newName) return;

    if (newName.toLowerCase() !== currentUsername.toLowerCase()) {
      const docRef = doc(usernamesCollection, newName.toLowerCase().replace(/\s+/g, '_'));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        usernameFeedback.textContent = "✕ System error: Handle matches taken signature.";
        usernameFeedback.style.color = "#ff4757";
        return;
      }
      
      await setDoc(docRef, { uid: "active_user", timestamp: Date.now() });
      if (currentUsername) {
        const oldDocRef = doc(usernamesCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
        await deleteDoc(oldDocRef).catch(() => {});
      }
    }

    const oldName = currentUsername;
    localStorage.setItem("chat_username", newName);
    localStorage.setItem("chat_user_color", currentUserColor);
    currentUsername = newName;
    
    updateIdentityDisplays();
    if (oldName && oldName !== newName) {
      updatePresence(true, false, oldName);
    }
  }

  if (saveNameBtn) {
    saveNameBtn.addEventListener("click", handleUserSetupSave);
  }

  if (changeNameBtn && usernameInput && nameModal) {
    changeNameBtn.addEventListener("click", () => {
      usernameInput.value = currentUsername;
      usernameFeedback.textContent = "";
      nameModal.classList.remove("hidden-modal");
    });
  }

  // ==========================================================================
  // 05. MEDIA PROCESSING & LIGHTBOX SWIPE LOGIC
  // ==========================================================================
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
          const MAX_SIZE = 500; 
          if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.5));
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

  if (imageInput) imageInput.addEventListener("change", async (e) => { if (e.target.files.length > 0) await processSelectedFile(e.target.files[0]); });
  if (cameraInput) cameraInput.addEventListener("change", async (e) => { if (e.target.files.length > 0) await processSelectedFile(e.target.files[0]); });
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
      querySnapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  }

  function setupLightboxIndex(idx) {
    if (idx < 0 || idx >= galleryImages.length) return;
    currentGalleryIndex = idx;
    currentScale = 1;
    
    swipeContainer.innerHTML = `<img src="${galleryImages[currentGalleryIndex]}" id="zoomedImage" style="transform: scale(1);" alt="Active View">`;
    if (viewerIndexDisplay) {
      viewerIndexDisplay.textContent = `${currentGalleryIndex + 1} / ${galleryImages.length}`;
    }
  }

  if (swipeContainer) {
    swipeContainer.addEventListener("touchstart", (e) => {
      if (currentScale > 1) return;
      isSwiping = true;
      swipeStartX = e.touches[0].clientX;
      swipeCurrentX = swipeStartX;
    }, { passive: true });

    swipeContainer.addEventListener("touchmove", (e) => {
      if (!isSwiping) return;
      swipeCurrentX = e.touches[0].clientX;
    }, { passive: true });

    swipeContainer.addEventListener("touchend", () => {
      if (!isSwiping) return;
      isSwiping = false;
      const deltaX = swipeCurrentX - swipeStartX;
      if (Math.abs(deltaX) > 50) { 
        if (deltaX > 0) {
          if (currentGalleryIndex > 0) setupLightboxIndex(currentGalleryIndex - 1);
        } else {
          if (currentGalleryIndex < galleryImages.length - 1) setupLightboxIndex(currentGalleryIndex + 1);
        }
      }
    });
  }

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => { const targetImg = document.getElementById("zoomedImage"); if (targetImg) { currentScale += 0.3; targetImg.style.transform = `scale(${currentScale})`; } });
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => { const targetImg = document.getElementById("zoomedImage"); if (targetImg && currentScale > 0.6) { currentScale -= 0.3; targetImg.style.transform = `scale(${currentScale})`; } });
  if (closeZoom) closeZoom.addEventListener("click", () => zoomModal.classList.add("hidden"));

  // ==========================================================================
  // 06. CHAT HISTORY TAP CONTROLS & SNAPSHOTS
  // ==========================================================================
  if (chatHistory) {
    chatHistory.addEventListener("click", async (e) => {
      
      // Handle mobile tap-to-reveal on chat bubbles
      const wrapper = e.target.closest(".message-wrapper");
      if (wrapper && !e.target.classList.contains("delete-single-btn") && !e.target.classList.contains("reply-btn") && !e.target.classList.contains("chat-img")) {
        const wasActive = wrapper.classList.contains("show-controls");
        document.querySelectorAll(".message-wrapper").forEach(w => w.classList.remove("show-controls"));
        if (!wasActive) wrapper.classList.add("show-controls");
      }

      // Handle message reply button
      if (e.target.classList.contains("reply-btn")) {
        const idToReply = e.target.getAttribute("data-id");
        const sender = e.target.getAttribute("data-sender");
        const text = e.target.getAttribute("data-text");
        initiateReply(idToReply, sender, text);
      }

      // Handle message delete button
      if (e.target.classList.contains("delete-single-btn")) {
        const idToDelete = e.target.getAttribute("data-id");
        if (idToDelete && confirm("Purge message package node?")) {
          await deleteDoc(doc(db, "messages", idToDelete));
        }
      }

      // Handle image zooming
      if (e.target.classList.contains("chat-img")) {
        const activeSrc = e.target.src;
        galleryImages = Array.from(document.querySelectorAll(".chat-img")).map(img => img.src);
        const findIdx = galleryImages.indexOf(activeSrc);
        if (zoomModal) {
          zoomModal.classList.remove("hidden");
          setupLightboxIndex(findIdx !== -1 ? findIdx : 0);
        }
      }
    });
  }

  const qMessages = query(messagesCollection, orderBy("time", "asc"));
  onSnapshot(qMessages, (snapshot) => {
    if (!chatHistory) return;
    chatHistory.innerHTML = "";
    if (snapshot.empty) {
      chatHistory.innerHTML = `<div class="system-msg">Room buffers empty. Channel fully secured.</div>`;
      return;
    }

    let lastSender = "";
    snapshot.forEach((snapshotDoc) => {
      const data = snapshotDoc.data();
      const msgId = snapshotDoc.id;
      const msgElement = document.createElement("div");
      const isMe = data.sender && currentUsername && data.sender.toLowerCase() === currentUsername.toLowerCase();
      const isConsecutive = data.sender && lastSender && data.sender.toLowerCase() === lastSender.toLowerCase();
      lastSender = data.sender || "";

      msgElement.className = `message-wrapper ${isMe ? "me" : "them"} ${isConsecutive ? "consecutive" : ""}`;
      const timeString = data.time ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
      const customUserColor = data.senderColor || "var(--accent)";
      const firstInitial = data.sender ? data.sender.charAt(0).toUpperCase() : "?";
      
      // Clean up string for HTML data attributes
      const sanitizedText = (data.message || "").replace(/"/g, '&quot;');

      let innerContent = "";
      if (!isConsecutive) {
        const isAdmin = checkAdminStatus(data.sender);
        const adminBadge = isAdmin ? `<span class="admin-badge-label" style="border: 1px solid ${customUserColor}; font-size:9px; margin-left:6px; padding:1px 4px; border-radius:4px; color:${customUserColor}">Ace</span>` : "";
        innerContent += `<div class="message-meta">
          <div class="user-avatar-circle" style="background:${customUserColor}">${firstInitial}</div>
          <span class="sender-name" style="color:${customUserColor}">${data.sender || "Anonymous"}${adminBadge}</span>
        </div>`;
      }
      
      innerContent += `<div class="bubble-layout">`;
      
      // Render Embedded Reply Quotes if present
      if (data.replyToSender) {
        innerContent += `
          <div class="reply-bubble-quote" style="border-left-color: ${customUserColor}">
            <span class="quote-sender" style="color:${customUserColor}">@${data.replyToSender}</span>
            <span class="quote-text">${data.replyToText || "[Shared Asset]"}</span>
          </div>
        `;
      }

      if (data.image) innerContent += `<img src="${data.image}" class="chat-img" alt="Shared Asset">`;
      if (data.message) innerContent += `<div class="bubble" style="${isMe ? `background:${customUserColor};color:#111;` : ''}">${data.message}</div>`;
      
      // Sub-controls (Reply / Delete / Timestamp)
      innerContent += `
          <div class="bubble-sub">
            <span class="reply-btn" data-id="${msgId}" data-sender="${data.sender || "Anonymous"}" data-text="${sanitizedText}">
              <svg style="pointer-events: none;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6l6-6"/></svg> Reply
            </span>
            <span class="timestamp">${timeString}</span>
            <span class="delete-single-btn" data-id="${msgId}">🗑️</span>
          </div>
        </div>
      `;
      msgElement.innerHTML = innerContent;
      chatHistory.appendChild(msgElement);
    });

    setTimeout(() => {
      if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
    }, 50);
  });

  window.visualViewport?.addEventListener("resize", () => {
     setTimeout(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; }, 100);
  });

  onSnapshot(statusCollection, (snapshot) => {
    if (!onlineUsersList) return;
    onlineUsersList.innerHTML = "";
    
    const aiRow = document.createElement("div");
    aiRow.className = "online-user-item";
    aiRow.innerHTML = `<div class="mini-avatar" style="background:#ff9f43">🤖</div> <span>AI Bot</span>`;
    onlineUsersList.appendChild(aiRow);

    let typingUsers = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const isRecent = (Date.now() - data.lastSeen) < 120000;
      if (data.username !== "AI Bot" && data.isOnline && isRecent) {
        const firstLetter = data.username ? data.username.charAt(0).toUpperCase() : "?";
        const adminTag = checkAdminStatus(data.username) ? "👑 " : "";
        const userRow = document.createElement("div");
        userRow.className = "online-user-item";
        userRow.innerHTML = `
          <div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div>
          <span>${adminTag}${data.username}</span>
        `;
        onlineUsersList.appendChild(userRow);

        if (data.isTyping && data.username !== currentUsername) {
          typingUsers.push(data.username);
        }
      }
    });

    if (typingUsers.length > 0) {
      typingIndicator.innerHTML = `✍️ ${typingUsers.join(", ")} is composing...`;
      typingIndicator.classList.remove("hidden");
    } else {
      typingIndicator.classList.add("hidden");
    }
  });

  // ==========================================================================
  // 07. COMMUNICATION DISPATCH ENGINE
  // ==========================================================================
  async function fetchAiReply(userPrompt) {
    try {
      updateAiPresence(true);
      aiContextMemory.push({ role: "user", content: userPrompt });
      if (aiContextMemory.length > 12) aiContextMemory.shift();

      const payloadMessages = [
        { role: "system", content: "You are a swift, hyper-optimized conversational engineer assistant built inside GhostChat channel. Keep structural formatting tight, markdown clean, and replies professional." },
        ...aiContextMemory
      ];

      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages })
      });

      const replyText = await response.text();
      const responseClean = replyText ? replyText.trim() : "System cluster response error: empty buffer pipeline.";
      
      aiContextMemory.push({ role: "assistant", content: responseClean });
      
      await addDoc(messagesCollection, {
        sender: "AI Bot",
        senderColor: "#ff9f43",
        message: responseClean,
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
      typingTimeout = setTimeout(() => updatePresence(true, false), 2500);
    });
    messageArea.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendBtn.click(); } });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      if (!messageArea) return;
      const text = messageArea.value.trim();
      if (!text && !selectedImageBase64) return;

      const newMsgPayload = {
        sender: currentUsername || "Anonymous",
        senderColor: currentUserColor,
        message: text,
        image: selectedImageBase64,
        time: Date.now()
      };

      // Append reply dependencies to payload if active
      if (replyToMessageId) {
        newMsgPayload.replyToId = replyToMessageId;
        newMsgPayload.replyToSender = replyToSender;
        newMsgPayload.replyToText = replyToText;
      }

      await addDoc(messagesCollection, newMsgPayload);

      // Reset Environment Input State
      messageArea.value = "";
      localStorage.removeItem("chat_draft");
      selectedImageBase64 = "";
      if (imageInput) imageInput.value = "";
      if (cameraInput) cameraInput.value = "";
      if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
      
      clearReplyContext();
      clearTimeout(typingTimeout);
      updatePresence(true, false);

      if (text.toLowerCase().startsWith("@ai")) {
        const cleanedPrompt = text.replace(/^@ai\s*/i, "").trim();
        if (cleanedPrompt) fetchAiReply(cleanedPrompt);
      }
    });
  }

  // ==========================================================================
  // 08. UTILITY EVENT BINDINGS
  // ==========================================================================
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      localStorage.setItem("chat_theme_index", currentThemeIndex);
      if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];
    });
  }

  if (incFontBtn) incFontBtn.addEventListener("click", () => { if (currentFontSize < maxFontSize) { currentFontSize += 2; applyChatFontSize(currentFontSize); } });
  if (decFontBtn) decFontBtn.addEventListener("click", () => { if (currentFontSize > minFontSize) { currentFontSize -= 2; applyChatFontSize(currentFontSize); } });
  if (clearChatBtn) clearChatBtn.addEventListener("click", () => { if (confirm("Confirm structural buffer clear?")) purgeChatRoomLogs(); });

  const scrollBtn = document.createElement("button");
  scrollBtn.id = "scrollBottomBtn";
  scrollBtn.type = "button";
  scrollBtn.textContent = "⬇";
  document.querySelector(".chat-container")?.appendChild(scrollBtn);

  scrollBtn.addEventListener("click", () => chatHistory?.scrollTo({ top: chatHistory.scrollHeight, behavior: "smooth" }));
  chatHistory?.addEventListener("scroll", () => {
    const nearBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight < 80;
    scrollBtn.style.display = nearBottom ? "none" : "flex";
  });
});
