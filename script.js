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
  writeBatch,
  updateDoc
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

// Feature Tracking States
let replyingToId = null;
let editingMessageId = null;
let searchQueryStr = "";

// Theme & Viewport Scaling Configuration
const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;
let currentFontSize = parseInt(localStorage.getItem('chatFontSize')) || 22;
const minFontSize = 8;
const maxFontSize = 46;

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

  // Advanced Features UI Elements
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const sidebarNode = document.getElementById("sidebarNode");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const searchToggleBtn = document.getElementById("searchToggleBtn");
  const searchBarContainer = document.getElementById("searchBarContainer");
  const chatSearchInput = document.getElementById("chatSearchInput");
  const closeSearchBtn = document.getElementById("closeSearchBtn");
  const pinnedMessagesContainer = document.getElementById("pinnedMessagesContainer");
  const pinnedMessagesList = document.getElementById("pinnedMessagesList");
  const closePinnedPanelBtn = document.getElementById("closePinnedPanelBtn");
  const replyContextContainer = document.getElementById("replyContextContainer");
  const replyUserLabel = document.getElementById("replyUserLabel");
  const replyTextLabel = document.getElementById("replyTextLabel");
  const cancelReplyBtn = document.getElementById("cancelReplyBtn");

  if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];
  if (messageArea) messageArea.value = localStorage.getItem("chat_draft") || "";

  // Mobile Hamburger Sidebar Toggle Mechanisms
  if (sidebarToggleBtn && sidebarNode && sidebarOverlay) {
    sidebarToggleBtn.addEventListener("click", () => {
      sidebarNode.classList.toggle("active");
      sidebarOverlay.classList.toggle("active");
    });
    sidebarOverlay.addEventListener("click", () => {
      sidebarNode.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    });
  }

  // Live Structural Chat Filtration Engine (In-chat Search)
  if (searchToggleBtn && searchBarContainer) {
    searchToggleBtn.addEventListener("click", () => {
      searchBarContainer.classList.toggle("hidden");
      if (!searchBarContainer.classList.contains("hidden") && chatSearchInput) {
        chatSearchInput.focus();
      }
    });
  }
  if (closeSearchBtn && searchBarContainer && chatSearchInput) {
    closeSearchBtn.addEventListener("click", () => {
      searchBarContainer.classList.add("hidden");
      chatSearchInput.value = "";
      searchQueryStr = "";
      triggerLocalFiltering();
    });
  }
  if (chatSearchInput) {
    chatSearchInput.addEventListener("input", (e) => {
      searchQueryStr = e.target.value.toLowerCase().trim();
      triggerLocalFiltering();
    });
  }

  function triggerLocalFiltering() {
    const wrappers = document.querySelectorAll(".message-wrapper");
    wrappers.forEach(wrap => {
      const bubble = wrap.querySelector(".bubble");
      if (!searchQueryStr) {
        wrap.style.display = "";
        return;
      }
      if (bubble && bubble.textContent.toLowerCase().includes(searchQueryStr)) {
        wrap.style.display = "";
      } else {
        wrap.style.display = "none";
      }
    });
  }

  // Dynamic Toggle Support for Active Terminals Container Panel
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

  // Network Presence Sync Dispatches
  async function updatePresence(isOnline, isTyping = false) {
    if (!currentUsername) return;
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
      
      // Lease Unique Name Signature inside Firestore Node
      await setDoc(docRef, { uid: "active_user", timestamp: Date.now() });
      if (currentUsername) {
        const oldUserRegistryRef = doc(usernamesCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
        await deleteDoc(oldUserRegistryRef).catch(() => {});
        const oldPresenceRef = doc(statusCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
        await deleteDoc(oldPresenceRef).catch(() => {});
      }
    }

    localStorage.setItem("chat_username", newName);
    localStorage.setItem("chat_user_color", currentUserColor);
    currentUsername = newName;
    
    updateIdentityDisplays();
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

  // Mobile Gallery & Camera Base64 Downscaler Processors
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
          const MAX_SIZE = 500; // Optimized size envelope for low latency delivery
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

  // ==========================================
  // HYPER-COMPATIBLE MOBILE SWIPE CAROUSEL ENGINE
  // ==========================================
  function setupLightboxIndex(idx) {
    if (idx < 0 || idx >= galleryImages.length) return;
    currentGalleryIndex = idx;
    currentScale = 1;
    
    swipeContainer.innerHTML = `<img src="${galleryImages[currentGalleryIndex]}" id="zoomedImage" style="transform: scale(1);" alt="Active View">`;
    if (viewerIndexDisplay) {
      viewerIndexDisplay.textContent = `${currentGalleryIndex + 1} / ${galleryImages.length}`;
    }
  }

  // Set Up Dynamic Reply State Context Actions
  function setupReplyContext(msgId, sender, text) {
    replyingToId = msgId;
    if (replyUserLabel) replyUserLabel.textContent = `Replying to ${sender}`;
    if (replyTextLabel) replyTextLabel.textContent = text || "[Image]";
    if (replyContextContainer) replyContextContainer.classList.remove("hidden");
    if (messageArea) messageArea.focus();
  }

  function clearReplyContext() {
    replyingToId = null;
    if (replyContextContainer) replyContextContainer.classList.add("hidden");
  }

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", clearReplyContext);
  }

  // Handle Interactive Clicks (Reactions, Pins, Deletes, Edits, Replies, Forwards)
  if (chatHistory) {
    chatHistory.addEventListener("click", async (e) => {
      const target = e.target;
      const msgId = target.getAttribute("data-id");

      if (target.classList.contains("delete-single-btn")) {
        if (msgId && confirm("Purge message package node?")) {
          await deleteDoc(doc(db, "messages", msgId));
        }
      }

      if (target.classList.contains("pin-btn")) {
        if (msgId) {
          const isPinned = target.getAttribute("data-pinned") === "true";
          await updateDoc(doc(db, "messages", msgId), { isPinned: !isPinned });
        }
      }

      if (target.classList.contains("reply-btn")) {
        if (msgId) {
          const senderName = target.getAttribute("data-sender");
          const msgText = target.getAttribute("data-text");
          setupReplyContext(msgId, senderName, msgText);
        }
      }

      if (target.classList.contains("edit-btn")) {
        if (msgId && messageArea) {
          const originalText = target.getAttribute("data-text");
          editingMessageId = msgId;
          messageArea.value = originalText;
          messageArea.focus();
          if (sendBtn) sendBtn.title = "Update Data Signature";
        }
      }

      if (target.classList.contains("forward-btn")) {
        if (msgId) {
          const textToForward = target.getAttribute("data-text");
          const imgToForward = target.getAttribute("data-img");
          const targetUser = prompt("Forward packet to channel as signature identity handles:", currentUsername);
          if (targetUser) {
            await addDoc(messagesCollection, {
              sender: targetUser,
              senderColor: currentUserColor,
              message: textToForward || "",
              image: imgToForward || "",
              time: Date.now()
            });
          }
        }
      }

      if (target.classList.contains("reaction-trigger")) {
        if (msgId) {
          const emoji = target.getAttribute("data-emoji");
          const docRef = doc(db, "messages", msgId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const reactions = data.reactions || {};
            reactions[emoji] = (reactions[emoji] || 0) + 1;
            await updateDoc(docRef, { reactions: reactions });
          }
        }
      }

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

  if (closePinnedPanelBtn && pinnedMessagesContainer) {
    closePinnedPanelBtn.addEventListener("click", () => {
      pinnedMessagesContainer.classList.add("hidden");
    });
  }

  // Mobile Friendly Touch Events Supporting Passive Interceptions
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

  // Real-time Database Message Streams Engine
  const qMessages = query(messagesCollection, orderBy("time", "asc"));
  onSnapshot(qMessages, (snapshot) => {
    if (!chatHistory) return;
    
    // Manage persistent tracking lists for both historical rows and structural pins
    let activePinnedItemsHtml = "";
    let hasPins = false;
    
    chatHistory.innerHTML = "";
    if (snapshot.empty) {
      chatHistory.innerHTML = `<div class="system-msg">Room buffers empty. Channel fully secured.</div>`;
      if (pinnedMessagesContainer) pinnedMessagesContainer.classList.add("hidden");
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

      // Render Pin Tracking Layouts
      if (data.isPinned) {
        hasPins = true;
        activePinnedItemsHtml += `
          <div class="pinned-item-row">
            <span class="pinned-meta">${data.sender || 'Anon'}: ${data.message || '[Asset Attachment]'}</span>
            <button class="pin-btn unpin-indicator" data-id="${msgId}" data-pinned="true" style="background:transparent;border:none;color:var(--accent);cursor:pointer;">✕</button>
          </div>
        `;
      }

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
      
      // If referencing contextual quoted parents (Reply Engine Rendering)
      if (data.replyingToText) {
        innerContent += `
          <div class="quoted-context-bubble" style="background:rgba(255,255,255,0.04); border-left:3px solid ${customUserColor}; padding:4px 8px; margin-bottom:4px; border-radius:4px; font-size:12px; opacity:0.8;">
            <div style="font-weight:bold; font-size:10px; color:${customUserColor};">Quoting ${data.replyingToUser || 'Anonymous'}</div>
            <div>${data.replyingToText}</div>
          </div>
        `;
      }

      if (data.image) innerContent += `<img src="${data.image}" class="chat-img" alt="Shared Asset">`;
      
      if (data.message) {
        const editedTag = data.isEdited ? ` <span class="edited-label" style="font-size:10px; opacity:0.5; font-style:italic;">(edited)</span>` : "";
        innerContent += `<div class="bubble" style="${isMe ? `background:${customUserColor};color:#111;` : ''}">${data.message}${editedTag}</div>`;
      }
      
      // Reaction Engine Presentation Layout Matrix
      let reactionChips = "";
      if (data.reactions) {
        Object.entries(data.reactions).forEach(([emoji, count]) => {
          if (count > 0) {
            reactionChips += `<span class="reaction-chip" style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:8px; font-size:11px; margin-right:4px;">${emoji} ${count}</span>`;
          }
        });
      }

      innerContent += `
          <div class="reactions-wrapper-row" style="margin-top:4px; display:flex; flex-wrap:wrap;">
            ${reactionChips}
          </div>
          <div class="bubble-sub">
            <span class="timestamp">${timeString}</span>
            <div class="action-toolbar-row" style="display:inline-flex; gap:8px; margin-left:8px; opacity:0.7;">
              <span class="reaction-trigger" data-id="${msgId}" data-emoji="👍" style="cursor:pointer;" title="React 👍">👍</span>
              <span class="reaction-trigger" data-id="${msgId}" data-emoji="🔥" style="cursor:pointer;" title="React 🔥">🔥</span>
              <span class="reply-btn" data-id="${msgId}" data-sender="${data.sender || 'Anonymous'}" data-text="${data.message || ''}" style="cursor:pointer;" title="Quote Reply">↩️</span>
              <span class="forward-btn" data-id="${msgId}" data-text="${data.message || ''}" data-img="${data.image || ''}" style="cursor:pointer;" title="Forward message">➡️</span>
              ${isMe ? `<span class="edit-btn" data-id="${msgId}" data-text="${data.message || ''}" style="cursor:pointer;" title="Edit Packet">✏️</span>` : ''}
              <span class="pin-btn" data-id="${msgId}" data-pinned="${data.isPinned ? 'true' : 'false'}" style="cursor:pointer;" title="Toggle Pin">${data.isPinned ? '📌' : '📍'}</span>
              <span class="delete-single-btn" data-id="${msgId}" style="cursor:pointer;" title="Purge Log">🗑️</span>
            </div>
          </div>
        </div>
      `;
      msgElement.innerHTML = innerContent;
      chatHistory.appendChild(msgElement);
    });

    // Toggle Visibility of Pinned Matrix Modules dynamically
    if (pinnedMessagesContainer && pinnedMessagesList) {
      if (hasPins) {
        pinnedMessagesList.innerHTML = activePinnedItemsHtml;
        pinnedMessagesContainer.classList.remove("hidden");
      } else {
        pinnedMessagesContainer.classList.add("hidden");
      }
    }

    // Apply local query constraints dynamically if filters are preset
    if (searchQueryStr) triggerLocalFiltering();

    // Mobile safe scroll tracking updates
    setTimeout(() => {
      if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
    }, 50);
  });

  // Handle Mobile Virtual Keyboard Resize Calculations
  window.visualViewport?.addEventListener("resize", () => {
     setTimeout(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; }, 100);
  });

  // Active Terminal Directory Synchronizer with "Last seen at..." support
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
      const timeDiff = Date.now() - (data.lastSeen || 0);
      const isRecent = timeDiff < 120000;
      
      if (data.username !== "AI Bot") {
        const firstLetter = data.username ? data.username.charAt(0).toUpperCase() : "?";
        const adminTag = checkAdminStatus(data.username) ? "👑 " : "";
        const userRow = document.createElement("div");
        userRow.className = "online-user-item";
        
        // Dynamic construction of real-time offline markers ("Last seen at...")
        let statusMetadataStr = "Offline";
        if (data.isOnline && isRecent) {
          statusMetadataStr = "Active Matrix Now";
        } else if (data.lastSeen) {
          statusMetadataStr = `Seen ${new Date(data.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }

        userRow.innerHTML = `
          <div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div>
          <div style="display:flex; flex-direction:column;">
            <span style="font-weight:600;">${adminTag}${data.username}</span>
            <span style="font-size:9px; opacity:0.6;">${statusMetadataStr}</span>
          </div>
        `;
        onlineUsersList.appendChild(userRow);

        if (data.isOnline && isRecent && data.isTyping && data.username !== currentUsername) {
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

  // Advanced Multi-turn Intelligent Conversational Assistant Pipeline
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

      // Check if updating an existing message signature (Message Editing)
      if (editingMessageId) {
        await updateDoc(doc(db, "messages", editingMessageId), {
          message: text,
          isEdited: true
        });
        editingMessageId = null;
        sendBtn.title = "Broadcast Data Signature Packet";
      } else {
        // Compose standard or reply transmission packet signatures
        let packetPayload = {
          sender: currentUsername || "Anonymous",
          senderColor: currentUserColor,
          message: text,
          image: selectedImageBase64,
          time: Date.now()
        };

        if (replyingToId) {
          packetPayload.replyingToId = replyingToId;
          packetPayload.replyingToUser = replyUserLabel.textContent.replace("Replying to ", "");
          packetPayload.replyingToText = replyTextLabel.textContent;
        }

        await addDoc(messagesCollection, packetPayload);
      }

      messageArea.value = "";
      localStorage.removeItem("chat_draft");
      selectedImageBase64 = "";
      clearReplyContext();
      
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

  // Configuration Panels Actions Hookups
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

  // Floating Navigation Action Attachment
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
