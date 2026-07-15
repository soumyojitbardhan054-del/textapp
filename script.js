import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  getDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Architecture Configuration Matrix
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

// Session Context Parameters
let currentUsername = localStorage.getItem("chat_username") || "";
let currentUserColor = localStorage.getItem("chat_user_color") || "#00d2d3";
let selectedImageBase64 = "";
let typingTimeout = null;
let aiContextMemory = [];

// Phase 3 Advanced Context States
let editingMessageId = null; 
let quotingMessageId = null;  
let quotingMessageData = null; 
let messageToForward = null;  
let activePinnedMessages = []; 
let currentPinnedIndex = 0;

// Theme & Viewport Scaling Configuration
const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;
let currentFontSize = parseInt(localStorage.getItem('chatFontSize')) || 14;
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
  styleEl.innerHTML = `.bubble, #message { font-size: ${size}px !important; }`;
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

  // Core HTML UI Elements Selection Cache
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

  // Phase 3 Specific Element Cache Points
  const chatSearchInput = document.getElementById("chatSearchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  
  const pinnedMessagesShelf = document.getElementById("pinnedMessagesShelf");
  const pinnedContentDisplay = document.getElementById("pinnedContentDisplay");
  const unpinActiveBtn = document.getElementById("unpinActiveBtn");
  
  const quoteContextOverlay = document.getElementById("quoteContextOverlay");
  const quoteTargetUser = document.getElementById("quoteTargetUser");
  const quoteTargetSnippet = document.getElementById("quoteTargetSnippet");
  const cancelQuoteBtn = document.getElementById("cancelQuoteBtn");

  const editContextOverlay = document.getElementById("editContextOverlay");
  const editTargetSnippet = document.getElementById("editTargetSnippet");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  const forwardModal = document.getElementById("forwardModal");
  const forwardUsersDirectory = document.getElementById("forwardUsersDirectory");
  const closeForwardBtn = document.getElementById("closeForwardBtn");

  if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];

  // Restore Draft Message for current username from local signature state
  if (messageArea && currentUsername) {
    messageArea.value = localStorage.getItem(`chat_draft_${currentUsername.toLowerCase()}`) || "";
  }

  // Active Terminals Minimize Action Binding
  const activeUsersPanel = document.querySelector(".active-users-panel");
  const panelHeader = document.querySelector(".panel-header");
  if (panelHeader && activeUsersPanel) {
    panelHeader.addEventListener("click", () => {
      activeUsersPanel.classList.toggle("minimized");
    });
  }

  // Setup Identity Palette Selectors
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

  // Unique Username Live Checker Pipeline
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
        usernameFeedback.textContent = "✓ Assigned to current session";
        usernameFeedback.style.color = "#1dd1a1";
        return;
      }

      lookupTimeout = setTimeout(async () => {
        const docRef = doc(usernamesCollection, nameToCheck.toLowerCase().replace(/\s+/g, '_'));
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          usernameFeedback.textContent = "✕ Signature matches active system node";
          usernameFeedback.style.color = "#ff4757";
        } else {
          usernameFeedback.textContent = "✓ Signature Available";
          usernameFeedback.style.color = "#1dd1a1";
        }
      }, 350);
    });
  }

  // Network Dynamic Presence Sync Engine
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
      if (mobileUserDisplay) mobileUserDisplay.textContent = `Terminal Node: ${currentUsername}${tag}`;
      nameModal.classList.add("hidden-modal");
      updatePresence(true, false);
      if (messageArea) {
        messageArea.value = localStorage.getItem(`chat_draft_${currentUsername.toLowerCase()}`) || "";
      }
    } else {
      nameModal.classList.remove("hidden-modal");
    }
  }
  updateIdentityDisplays();

  // Heartbeat loop to keep current session visible and active in Terminal list
  setInterval(() => {
    if (currentUsername) updatePresence(true, false);
  }, 45000);

  window.addEventListener("beforeunload", () => updatePresence(false, false));

  async function handleUserSetupSave() {
    if (!usernameInput) return;
    const newName = usernameInput.value.trim();
    if (!newName) return;

    if (newName.toLowerCase() !== currentUsername.toLowerCase()) {
      const docRef = doc(usernamesCollection, newName.toLowerCase().replace(/\s+/g, '_'));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        usernameFeedback.textContent = "✕ System error: Handle matched verified signature.";
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

  // Camera Capture & Image File Downscaling Mechanics
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
          resolve(canvas.toDataURL("image/jpeg", 0.65));
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

  // Interactive Content Search Filtering Engine
  if (chatSearchInput) {
    chatSearchInput.addEventListener("input", () => {
      const val = chatSearchInput.value.toLowerCase().trim();
      if (val) {
        clearSearchBtn.classList.remove("hidden");
      } else {
        clearSearchBtn.classList.add("hidden");
      }
      filterUIMessages(val);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      chatSearchInput.value = "";
      clearSearchBtn.classList.add("hidden");
      filterUIMessages("");
    });
  }

  function filterUIMessages(queryStr) {
    const wrappers = document.querySelectorAll("#chatHistory .message-wrapper");
    wrappers.forEach(wrap => {
      const textEl = wrap.querySelector(".bubble");
      if (!textEl) return;
      const text = textEl.textContent.toLowerCase();
      if (!queryStr || text.includes(queryStr)) {
        wrap.style.display = "";
      } else {
        wrap.style.display = "none";
      }
    });
  }

  // Lightbox Media Swipe Indexing
  function setupLightboxIndex(idx) {
    if (idx < 0 || idx >= galleryImages.length) return;
    currentGalleryIndex = idx;
    currentScale = 1;
    
    swipeContainer.innerHTML = `<img src="${galleryImages[currentGalleryIndex]}" id="zoomedImage" style="transform: scale(1);" alt="Active View">`;
    if (viewerIndexDisplay) {
      viewerIndexDisplay.textContent = `${currentGalleryIndex + 1} / ${galleryImages.length}`;
    }
  }

  // Close Quote and Close Edit Context Utilities
  function cancelQuotingState() {
    quotingMessageId = null;
    quotingMessageData = null;
    if (quoteContextOverlay) quoteContextOverlay.classList.add("hidden");
  }

  function cancelEditingState() {
    editingMessageId = null;
    if (editContextOverlay) editContextOverlay.classList.add("hidden");
    if (messageArea) messageArea.value = "";
    if (sendBtn) sendBtn.title = "Broadcast Data Signature Packet";
  }

  if (cancelQuoteBtn) cancelQuoteBtn.addEventListener("click", cancelQuotingState);
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", cancelEditingState);

  // Global Event Listener inside Chat History wrapper for structural message actions (Replies, reactions, edits, pinned)
  if (chatHistory) {
    chatHistory.addEventListener("click", async (e) => {
      const target = e.target;
      
      // Delete message execution
      if (target.classList.contains("delete-single-btn")) {
        const idToDelete = target.getAttribute("data-id");
        if (idToDelete && confirm("Purge message package node?")) {
          await deleteDoc(doc(db, "messages", idToDelete));
        }
        return;
      }

      // Edit message execution trigger
      if (target.classList.contains("edit-action-trigger")) {
        const msgId = target.getAttribute("data-id");
        const bodyContent = target.getAttribute("data-text");
        if (msgId && bodyContent) {
          editingMessageId = msgId;
          messageArea.value = bodyContent;
          editTargetSnippet.textContent = bodyContent;
          editContextOverlay.classList.remove("hidden");
          if (sendBtn) sendBtn.title = "Update Message Packet";
          messageArea.focus();
        }
        return;
      }

      // Quote reply message action trigger
      if (target.classList.contains("quote-action-trigger")) {
        const msgId = target.getAttribute("data-id");
        const sender = target.getAttribute("data-sender");
        const bodyText = target.getAttribute("data-text");
        if (msgId) {
          quotingMessageId = msgId;
          quotingMessageData = { sender, text: bodyText };
          quoteTargetUser.textContent = sender;
          quoteTargetSnippet.textContent = bodyText;
          quoteContextOverlay.classList.remove("hidden");
          messageArea.focus();
        }
        return;
      }

      // Forward Message routing overlay configuration
      if (target.classList.contains("forward-action-trigger")) {
        const bodyText = target.getAttribute("data-text");
        const media = target.getAttribute("data-image") || "";
        messageToForward = { text: bodyText, image: media };
        if (forwardModal) {
          forwardModal.classList.remove("hidden-modal");
          populateForwardingDirectory();
        }
        return;
      }

      // Pin Message Action trigger
      if (target.classList.contains("pin-action-trigger")) {
        const msgId = target.getAttribute("data-id");
        const bodyText = target.getAttribute("data-text");
        const sender = target.getAttribute("data-sender");
        if (msgId) {
          await setDoc(doc(db, "messages", msgId), {
            isPinned: true
          }, { merge: true });
        }
        return;
      }

      // Emoji Reaction update handler
      if (target.classList.contains("emoji-pill-btn")) {
        const msgId = target.getAttribute("data-id");
        const reactionEmoji = target.getAttribute("data-emoji");
        if (msgId && reactionEmoji && currentUsername) {
          const docRef = doc(db, "messages", msgId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            let reactions = data.reactions || {};
            if (!reactions[reactionEmoji]) {
              reactions[reactionEmoji] = [];
            }
            const userIndex = reactions[reactionEmoji].indexOf(currentUsername);
            if (userIndex !== -1) {
              reactions[reactionEmoji].splice(userIndex, 1);
              if (reactions[reactionEmoji].length === 0) {
                delete reactions[reactionEmoji];
              }
            } else {
              reactions[reactionEmoji].push(currentUsername);
            }
            await updateDoc(docRef, { reactions });
          }
        }
        return;
      }

      // Quote layout tag click auto-scroller anchor focus
      if (target.classList.contains("quote-snippet-preview") || target.closest(".quote-snippet-preview")) {
        const anchorId = target.getAttribute("data-anchor") || target.closest(".quote-snippet-preview")?.getAttribute("data-anchor");
        if (anchorId) {
          const anchorEl = document.getElementById(`msg-${anchorId}`);
          if (anchorEl) {
            anchorEl.scrollIntoView({ behavior: "smooth", block: "center" });
            anchorEl.classList.add("flash-highlight-active");
            setTimeout(() => anchorEl.classList.remove("flash-highlight-active"), 2000);
          }
        }
        return;
      }

      // Expand gallery zoom
      if (target.classList.contains("chat-img")) {
        const activeSrc = target.src;
        galleryImages = Array.from(document.querySelectorAll(".chat-img")).map(img => img.src);
        const findIdx = galleryImages.indexOf(activeSrc);
        if (zoomModal) {
          zoomModal.classList.remove("hidden");
          setupLightboxIndex(findIdx !== -1 ? findIdx : 0);
        }
      }
    });
  }

  // Populate Forward overlay peer roster targets list
  async function populateForwardingDirectory() {
    if (!forwardUsersDirectory) return;
    forwardUsersDirectory.innerHTML = "";
    const snapshot = await getDocs(statusCollection);
    let count = 0;
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const isRecent = (Date.now() - data.lastSeen) < 120000;
      if (data.username && data.username !== currentUsername && isRecent) {
        count++;
        const row = document.createElement("div");
        row.className = "forward-target-node-item";
        row.innerHTML = `
          <div class="meta-row">
            <span class="forward-node-badge" style="background:${data.color || 'var(--accent)'}">${data.username.charAt(0).toUpperCase()}</span>
            <span class="forward-node-name">${data.username}</span>
          </div>
          <button class="primary-glow-btn forward-confirm-btn" data-username="${data.username}" data-color="${data.color}">Forward</button>
        `;
        forwardUsersDirectory.appendChild(row);
      }
    });

    if (count === 0) {
      forwardUsersDirectory.innerHTML = `<p class="empty-directory-text">No active terminals detected in regional routing matrix.</p>`;
    }
  }

  // Confirm and route Forwarded message payload to targets
  if (forwardUsersDirectory) {
    forwardUsersDirectory.addEventListener("click", async (e) => {
      if (e.target.classList.contains("forward-confirm-btn") && messageToForward) {
        const targetUser = e.target.getAttribute("data-username");
        const targetColor = e.target.getAttribute("data-color");
        if (targetUser) {
          await addDoc(messagesCollection, {
            sender: currentUsername || "Anonymous",
            senderColor: currentUserColor,
            message: `[Forwarded from session] ${messageToForward.text || ""}`,
            image: messageToForward.image || "",
            time: Date.now()
          });
          if (forwardModal) forwardModal.classList.add("hidden-modal");
          messageToForward = null;
        }
      }
    });
  }

  if (closeForwardBtn) {
    closeForwardBtn.addEventListener("click", () => {
      if (forwardModal) forwardModal.classList.add("hidden-modal");
      messageToForward = null;
    });
  }

  // Touch Swipe Event Listeners for Lightbox 
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
      if (Math.abs(deltaX) > 60) { 
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

  // Real-time Database Message Streams Engine (Integrates Phase 3 Pin, Reply, Reactions, and Edits updates)
  const qMessages = query(messagesCollection, orderBy("time", "asc"));
  onSnapshot(qMessages, (snapshot) => {
    if (!chatHistory) return;
    chatHistory.innerHTML = "";
    activePinnedMessages = [];

    if (snapshot.empty) {
      chatHistory.innerHTML = `<div class="system-msg">Channel secured. Room buffers ready for transmissions.</div>`;
      updatePinnedShelfUI();
      return;
    }

    let lastSender = "";
    snapshot.forEach((snapshotDoc) => {
      const data = snapshotDoc.data();
      const msgId = snapshotDoc.id;
      
      // Keep track of pinned items
      if (data.isPinned) {
        activePinnedMessages.push({ id: msgId, text: data.message, sender: data.sender });
      }

      const msgElement = document.createElement("div");
      msgElement.id = `msg-${msgId}`;
      const isMe = data.sender && currentUsername && data.sender.toLowerCase() === currentUsername.toLowerCase();
      const isConsecutive = data.sender && lastSender && data.sender.toLowerCase() === lastSender.toLowerCase();
      lastSender = data.sender || "";

      msgElement.className = `message-wrapper ${isMe ? "me" : "them"} ${isConsecutive ? "consecutive" : ""}`;
      const timeString = data.time ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
      const customUserColor = data.senderColor || "var(--accent)";
      const firstInitial = data.sender ? data.sender.charAt(0).toUpperCase() : "?";

      let innerContent = "";
      
      // Render Meta Headers if not consecutive
      if (!isConsecutive) {
        const isAdmin = checkAdminStatus(data.sender);
        const adminBadge = isAdmin ? `<span class="admin-badge-label" style="border: 1px solid ${customUserColor}; font-size:9px; margin-left:6px; padding:1px 4px; border-radius:4px; color:${customUserColor}">Ace</span>` : "";
        innerContent += `<div class="message-meta">
          <div class="user-avatar-circle" style="background:${customUserColor}">${firstInitial}</div>
          <span class="sender-name" style="color:${customUserColor}">${data.sender || "Anonymous"}${adminBadge}</span>
        </div>`;
      }
      
      innerContent += `<div class="bubble-layout">`;
      
      // Render Phase 3 Quoted Message context reference box inside parent node wrapper
      if (data.replyToId && data.replyToData) {
        innerContent += `
          <div class="quote-snippet-preview" data-anchor="${data.replyToId}">
            <div class="quote-snippet-bar" style="background:${customUserColor}"></div>
            <div class="quote-snippet-details">
              <span class="quote-snippet-sender" style="color:${customUserColor}">${data.replyToData.sender || "Unknown"}</span>
              <p class="quote-snippet-text">${data.replyToData.text || "Media package attached..."}</p>
            </div>
          </div>
        `;
      }

      if (data.image) innerContent += `<img src="${data.image}" class="chat-img" alt="Shared Asset">`;
      
      // Process core text payload with edited annotation support
      if (data.message) {
        const editedLabel = data.edited ? `<span class="edited-annotation-tag">(edited)</span>` : "";
        innerContent += `<div class="bubble" style="${isMe ? `background:${customUserColor};color:#111;` : ''}">${data.message} ${editedLabel}</div>`;
      }
      
      // Process Phase 3 Live Emoji Reactions pill lists
      let reactionsRow = "";
      if (data.reactions && Object.keys(data.reactions).length > 0) {
        reactionsRow += `<div class="active-reactions-pills-row">`;
        Object.entries(data.reactions).forEach(([emoji, users]) => {
          if (users && users.length > 0) {
            const alreadyReacted = users.includes(currentUsername);
            reactionsRow += `
              <button class="emoji-pill-btn ${alreadyReacted ? 'user-reacted' : ''}" data-id="${msgId}" data-emoji="${emoji}" title="Reacted: ${users.join(', ')}">
                <span>${emoji}</span> <span class="react-counter">${users.length}</span>
              </button>
            `;
          }
        });
        reactionsRow += `</div>`;
      }
      innerContent += reactionsRow;

      // Interaction Action Controls Panel
      innerContent += `
          <div class="bubble-sub">
            <span class="timestamp">${timeString}</span>
            <span class="action-trigger quote-action-trigger" data-id="${msgId}" data-sender="${data.sender || "Anonymous"}" data-text="${data.message || ""}" title="Quote reply to message">💬</span>
            <span class="action-trigger pin-action-trigger" data-id="${msgId}" data-sender="${data.sender || "Anonymous"}" data-text="${data.message || ""}" title="Pin Message">📌</span>
            <span class="action-trigger forward-action-trigger" data-id="${msgId}" data-text="${data.message || ""}" data-image="${data.image || ""}" title="Forward Message">➡️</span>
            ${isMe ? `<span class="action-trigger edit-action-trigger" data-id="${msgId}" data-text="${data.message || ""}" title="Edit Message">✏️</span>` : ''}
            <span class="delete-single-btn" data-id="${msgId}" title="Delete Message">🗑️</span>
          </div>
        </div>
      `;

      // Render Phase 3 Hover Quick Reactions popup context bar
      innerContent += `
        <div class="hover-reactions-quick-bar">
          <span class="emoji-pill-btn quick-emoji" data-id="${msgId}" data-emoji="👍">👍</span>
          <span class="emoji-pill-btn quick-emoji" data-id="${msgId}" data-emoji="❤️">❤️</span>
          <span class="emoji-pill-btn quick-emoji" data-id="${msgId}" data-emoji="🔥">🔥</span>
          <span class="emoji-pill-btn quick-emoji" data-id="${msgId}" data-emoji="😂">😂</span>
          <span class="emoji-pill-btn quick-emoji" data-id="${msgId}" data-emoji="😮">😮</span>
        </div>
      `;

      msgElement.innerHTML = innerContent;
      chatHistory.appendChild(msgElement);
    });

    updatePinnedShelfUI();

    // Re-apply current search filter if active
    if (chatSearchInput && chatSearchInput.value) {
      filterUIMessages(chatSearchInput.value.toLowerCase().trim());
    } else {
      setTimeout(() => {
        if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
      }, 80);
    }
  });

  // Unpin Active Shelf Message Trigger
  if (unpinActiveBtn) {
    unpinActiveBtn.addEventListener("click", async () => {
      if (activePinnedMessages.length > 0) {
        const targetItem = activePinnedMessages[currentPinnedIndex];
        if (targetItem && targetItem.id) {
          await setDoc(doc(db, "messages", targetItem.id), {
            isPinned: false
          }, { merge: true });
        }
      }
    });
  }

  // Cycle through pinned messages shelf if multiple items exist
  if (pinnedContentDisplay) {
    pinnedContentDisplay.addEventListener("click", () => {
      if (activePinnedMessages.length > 1) {
        currentPinnedIndex = (currentPinnedIndex + 1) % activePinnedMessages.length;
        updatePinnedShelfUI();
      }
    });
  }

  function updatePinnedShelfUI() {
    if (!pinnedMessagesShelf || !pinnedContentDisplay) return;
    if (activePinnedMessages.length === 0) {
      pinnedMessagesShelf.classList.add("hidden");
      return;
    }

    pinnedMessagesShelf.classList.remove("hidden");
    if (currentPinnedIndex >= activePinnedMessages.length) {
      currentPinnedIndex = 0;
    }
    const item = activePinnedMessages[currentPinnedIndex];
    const indicator = activePinnedMessages.length > 1 ? ` (${currentPinnedIndex + 1}/${activePinnedMessages.length} - tap to cycle)` : "";
    pinnedContentDisplay.innerHTML = `<b>${item.sender || "Anonymous"}</b>: ${item.text || "Media attachments..."} ${indicator}`;
  }

  // Viewport keyboard resizing helper
  window.visualViewport?.addEventListener("resize", () => {
     setTimeout(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; }, 120);
  });

  // Active Terminal Directory Synchronizer with "Last Seen" timestamp logic
  onSnapshot(statusCollection, (snapshot) => {
    if (!onlineUsersList) return;
    onlineUsersList.innerHTML = "";
    
    // Seed persistent AI Bot node
    const aiRow = document.createElement("div");
    aiRow.className = "online-user-item";
    aiRow.innerHTML = `<div class="mini-avatar" style="background:#ff9f43">🤖</div> <span>AI Bot</span>`;
    onlineUsersList.appendChild(aiRow);

    let typingUsers = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const timeSinceActive = Date.now() - data.lastSeen;
      const isOnline = data.isOnline && (timeSinceActive < 120000); // 2 minute threshold window

      if (data.username !== "AI Bot") {
        const firstLetter = data.username ? data.username.charAt(0).toUpperCase() : "?";
        const adminTag = checkAdminStatus(data.username) ? "👑 " : "";
        const userRow = document.createElement("div");
        userRow.className = `online-user-item ${isOnline ? 'active-online' : 'active-offline'}`;
        
        let lastSeenLabel = "Offline";
        if (isOnline) {
          lastSeenLabel = "Active now";
        } else if (data.lastSeen) {
          const lastSeenDate = new Date(data.lastSeen);
          lastSeenLabel = `Last seen: ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }

        userRow.innerHTML = `
          <div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div>
          <div class="user-item-details">
            <span class="user-item-handle">${adminTag}${data.username}</span>
            <span class="user-item-status-label">${lastSeenLabel}</span>
          </div>
        `;
        onlineUsersList.appendChild(userRow);

        if (isOnline && data.isTyping && data.username !== currentUsername) {
          typingUsers.push(data.username);
        }
      }
    });

    if (typingUsers.length > 0) {
      typingIndicator.innerHTML = `✍️ ${typingUsers.join(", ")} is typing...`;
      typingIndicator.classList.remove("hidden");
    } else {
      typingIndicator.classList.add("hidden");
    }
  });

  // Advanced Multi-turn AI Assistant Pipeline
  async function fetchAiReply(userPrompt) {
    try {
      updateAiPresence(true);
      aiContextMemory.push({ role: "user", content: userPrompt });
      if (aiContextMemory.length > 12) aiContextMemory.shift();

      const payloadMessages = [
        { role: "system", content: "You are an integrated AI communication co-processor built directly inside GhostChat. Structure responses professionally, using precise markdown styling with clear formatting." },
        ...aiContextMemory
      ];

      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages })
      });

      const replyText = await response.text();
      const responseClean = replyText ? replyText.trim() : "System node link failed. Input buffers timed out.";
      
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

  // Real-time Draft Preservation System on Key Stroke
  if (messageArea) {
    messageArea.addEventListener("input", (e) => {
      if (currentUsername) {
        localStorage.setItem(`chat_draft_${currentUsername.toLowerCase()}`, e.target.value);
      }
      updatePresence(true, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => updatePresence(true, false), 2500);
    });
    
    messageArea.addEventListener("keydown", (e) => { 
      if (e.key === "Enter") { 
        e.preventDefault(); 
        sendBtn.click(); 
      } 
    });
  }

  // Send Actions Dispatcher
  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      if (!messageArea) return;
      const text = messageArea.value.trim();
      if (!text && !selectedImageBase64) return;

      // Handle Edit Action Route
      if (editingMessageId) {
        if (text) {
          await updateDoc(doc(db, "messages", editingMessageId), {
            message: text,
            edited: true
          });
        }
        cancelEditingState();
        return;
      }

      // Handle standard send pipeline with optional quoting configurations
      const payload = {
        sender: currentUsername || "Anonymous",
        senderColor: currentUserColor,
        message: text,
        image: selectedImageBase64,
        time: Date.now()
      };

      if (quotingMessageId) {
        payload.replyToId = quotingMessageId;
        payload.replyToData = quotingMessageData;
      }

      await addDoc(messagesCollection, payload);

      messageArea.value = "";
      if (currentUsername) {
        localStorage.removeItem(`chat_draft_${currentUsername.toLowerCase()}`);
      }
      selectedImageBase64 = "";
      if (imageInput) imageInput.value = "";
      if (cameraInput) cameraInput.value = "";
      if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
      
      cancelQuotingState();
      clearTimeout(typingTimeout);
      updatePresence(true, false);

      if (text.toLowerCase().startsWith("@ai")) {
        const cleanedPrompt = text.replace(/^@ai\s*/i, "").trim();
        if (cleanedPrompt) fetchAiReply(cleanedPrompt);
      }
    });
  }

  // Core Theme toggler
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      localStorage.setItem("chat_theme_index", currentThemeIndex);
      if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];
    });
  }

  // Adjust Font sizes
  if (incFontBtn) incFontBtn.addEventListener("click", () => { if (currentFontSize < maxFontSize) { currentFontSize += 2; applyChatFontSize(currentFontSize); } });
  if (decFontBtn) decFontBtn.addEventListener("click", () => { if (currentFontSize > minFontSize) { currentFontSize -= 2; applyChatFontSize(currentFontSize); } });
  if (clearChatBtn) clearChatBtn.addEventListener("click", () => { if (confirm("Clear core log history database?")) purgeChatRoomLogs(); });

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

  // Scroll Bottom button setup
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
