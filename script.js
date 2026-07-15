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
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================================
// 01. FIREBASE CORE MAIN CONSOLE CONFIGURATION
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

// Local Session Variables
let currentUsername = localStorage.getItem("chat_username") || "";
let currentUserColor = localStorage.getItem("chat_user_color") || "#00d2d3";
let selectedImageBase64 = "";
let typingTimeout = null;
let currentScale = 1;

// Active Theme Settings Array
const themes = ["#1e2330", "#2c1a30", "#1a2e26", "#301a1a"];
let currentThemeIndex = parseInt(localStorage.getItem("chat_theme_index")) || 0;

// Dynamic Font Scaling limits
let currentFontSize = parseInt(localStorage.getItem('chatFontSize')) || 14; 
const minFontSize = 8;   // Microscopic mode
const maxFontSize = 32;  // High-legibility mode

// God Mode Control Metrics
let targetEndTimestamp = 0;
let godIsActive = true;
let currentAnswer = null;
let warningTwoMinSent = false;

// Contextual Interaction Anchors
let activeReplyTo = null; // Holds { id, sender, text, color }
let activeEditMsgId = null; // Holds ID of message being modified

// Screen-space optimized strings
let globalTimerDisplayString = "";
let globalTypingDisplayString = "";

// ==========================================================================
// 02. HELPER FUNCTIONS & FORMATTING UTILITIES
// ==========================================================================

// Apply the dynamic styling across bubbles and input cards instantly
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

// Low footprint, high relative performance last-seen compiler
function formatLastSeen(timestamp) {
  if (!timestamp) return "Offline";
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (seconds < 15) return "Active now";
  if (seconds < 60) return "Active < 1m";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ==========================================================================
// 03. DOM COMPILER ENGINE DIRECT LOADING HANDLER
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Apply fonts immediately
  applyChatFontSize(currentFontSize);

  // Selector mappings
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
  const presencePanel = document.getElementById("presencePanel");
  const togglePresenceBtn = document.getElementById("togglePresenceBtn");

  // Search references
  const chatSearchInput = document.getElementById("chatSearchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");

  // Pinned Messages references
  const pinnedShelf = document.getElementById("pinnedShelf");
  const pinnedTextScroller = document.getElementById("pinnedTextScroller");
  const unpinShelfBtn = document.getElementById("unpinShelfBtn");

  // Overlay anchors
  const replyContextOverlay = document.getElementById("replyContextOverlay");
  const replyTargetUser = document.getElementById("replyTargetUser");
  const replyTargetText = document.getElementById("replyTargetText");
  const closeReplyContextBtn = document.getElementById("closeReplyContextBtn");

  const editContextOverlay = document.getElementById("editContextOverlay");
  const editTargetText = document.getElementById("editTargetText");
  const closeEditContextBtn = document.getElementById("closeEditContextBtn");

  // Reset zoom module layout anomalies
  if (zoomModal) {
    zoomModal.classList.add("hidden");
  }

  // Pre-load saved UI preferences
  if (chatContainer) chatContainer.style.backgroundColor = themes[currentThemeIndex];
  if (messageArea) messageArea.value = localStorage.getItem("chat_draft") || "";

  // Dynamic avatar registration
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

  // Collapsible Online Presence directory click handler
  if (togglePresenceBtn && presencePanel) {
    togglePresenceBtn.addEventListener("click", () => {
      presencePanel.classList.toggle("minimized");
    });
  }

  // ==========================================================================
  // 04. PRESENCE CONTROL LAYER & RELATIVE LIFESPAN TIMESTAMPS
  // ==========================================================================
  async function updatePresence(isOnline, isTyping = false, oldName = "") {
    if (!currentUsername) return;

    if (oldName && oldName.toLowerCase() !== currentUsername.toLowerCase()) {
      const oldDocRef = doc(statusCollection, oldName.toLowerCase().replace(/\s+/g, '_'));
      await deleteDoc(oldDocRef).catch(err => console.error("Identity clean error:", err));
    }

    const userDocRef = doc(statusCollection, currentUsername.toLowerCase().replace(/\s+/g, '_'));
    await setDoc(userDocRef, {
      username: currentUsername,
      color: currentUserColor,
      isOnline: isOnline,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true }).catch(err => console.error("Presence execution failure:", err));
  }

  async function updateAiPresence(isTyping) {
    const aiDocRef = doc(statusCollection, "ai_bot");
    await setDoc(aiDocRef, {
      username: "AI Bot",
      color: "#ff9f43",
      isOnline: true,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true }).catch(err => console.error("AI Presence failed:", err));
  }

  function updateIdentityDisplays() {
    if (!nameModal) return;
    if (currentUsername) {
      if (currentUserDisplay) currentUserDisplay.textContent = `${currentUsername}`;
      if (mobileUserDisplay) mobileUserDisplay.textContent = `@${currentUsername}`;
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
  }

  if (changeNameBtn && usernameInput && nameModal) {
    const openModal = () => {
      usernameInput.value = currentUsername;
      nameModal.classList.remove("hidden-modal");
    };
    changeNameBtn.addEventListener("click", openModal);
  }

  // ==========================================================================
  // 05. CORE SEARCH MATRIX & FILTERING SYSTEM
  // ==========================================================================
  if (chatSearchInput) {
    chatSearchInput.addEventListener("input", () => {
      const queryText = chatSearchInput.value.toLowerCase().trim();
      
      if (queryText) {
        clearSearchBtn.classList.remove("hidden");
      } else {
        clearSearchBtn.classList.add("hidden");
      }

      // Live client-side rendering evaluation
      const wrappers = chatHistory.querySelectorAll(".message-wrapper");
      wrappers.forEach(wrapper => {
        const textBubble = wrapper.querySelector(".bubble");
        const sender = wrapper.querySelector(".sender-name");
        
        const bubbleText = textBubble ? textBubble.textContent.toLowerCase() : "";
        const senderText = sender ? sender.textContent.toLowerCase() : "";

        if (bubbleText.includes(queryText) || senderText.includes(queryText)) {
          wrapper.style.display = "";
        } else {
          wrapper.style.display = "none";
        }
      });
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      chatSearchInput.value = "";
      clearSearchBtn.classList.add("hidden");
      const wrappers = chatHistory.querySelectorAll(".message-wrapper");
      wrappers.forEach(wrapper => {
        wrapper.style.display = "";
      });
    });
  }

  // ==========================================================================
  // 06. COMPACT ACTIVE PRESENCE ENGINE AND TIMESTAMPS
  // ==========================================================================
  onSnapshot(statusCollection, (snapshot) => {
    if (!onlineUsersList) return;
    onlineUsersList.innerHTML = "";

    // Render Compact Bots First
    const aiRow = document.createElement("div");
    aiRow.className = "online-user-item active-online";
    aiRow.innerHTML = `
      <div class="mini-avatar" style="background:#ff9f43">🤖</div>
      <div class="user-item-details">
        <span class="user-item-handle">AI Bot</span>
        <span class="user-item-status-label">Ready</span>
      </div>
    `;
    onlineUsersList.appendChild(aiRow);

    const godRow = document.createElement("div");
    godRow.className = `online-user-item ${godIsActive ? "active-online" : "active-offline"}`;
    godRow.innerHTML = `
      <div class="mini-avatar" style="background:#ff4757">👁️</div>
      <div class="user-item-details">
        <span class="user-item-handle">GOD</span>
        <span class="user-item-status-label">${godIsActive ? "Active" : "Silenced"}</span>
      </div>
    `;
    onlineUsersList.appendChild(godRow);

    let typingUsers = [];

    // Parse dynamic users instantly with relative-time formulas
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const isRecent = (Date.now() - data.lastSeen) < 120000; // Active within 2 minutes

      if (data.username !== "AI Bot" && data.username !== "GOD" && data.username !== currentUsername) {
        const firstLetter = data.username ? data.username.charAt(0).toUpperCase() : "?";
        const isUserOnline = data.isOnline && isRecent;
        
        const userRow = document.createElement("div");
        userRow.className = `online-user-item ${isUserOnline ? "active-online" : "active-offline"}`;
        
        const statusLabelText = isUserOnline ? "Active now" : formatLastSeen(data.lastSeen);

        userRow.innerHTML = `
          <div class="mini-avatar" style="background:${data.color || 'var(--accent)'}">${firstLetter}</div>
          <div class="user-item-details">
            <span class="user-item-handle">${data.username}</span>
            <span class="user-item-status-label">${statusLabelText}</span>
          </div>
        `;
        onlineUsersList.appendChild(userRow);

        if (data.isTyping && isUserOnline) {
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

  // ==========================================================================
  // 07. INTERACTIVE MESSAGE PINNING SYSTEM
  // ==========================================================================
  async function pinMessage(msgId, sender, text) {
    await setDoc(doc(db, "status", "pinned_state"), {
      pinnedBy: currentUsername,
      sender: sender,
      text: text,
      messageId: msgId,
      time: Date.now()
    }).catch(err => console.error("Pin request rejected:", err));
  }

  async function unpinMessage() {
    await deleteDoc(doc(db, "status", "pinned_state")).catch(err => console.error("Unpin failed:", err));
  }

  if (unpinShelfBtn) {
    unpinShelfBtn.addEventListener("click", unpinMessage);
  }

  // Scroll and highlight dynamic pins
  if (pinnedTextScroller) {
    pinnedTextScroller.addEventListener("click", () => {
      const targetId = pinnedTextScroller.getAttribute("data-target-id");
      if (targetId) {
        const targetEl = document.getElementById(`msg-${targetId}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
          targetEl.classList.add("flash-highlight-active");
          setTimeout(() => {
            targetEl.classList.remove("flash-highlight-active");
          }, 1500);
        }
      }
    });
  }

  // Subscribe to pin matrix snap
  onSnapshot(doc(db, "status", "pinned_state"), (docSnap) => {
    if (!pinnedShelf || !pinnedTextScroller) return;
    if (docSnap.exists()) {
      const data = docSnap.data();
      pinnedShelf.classList.remove("hidden");
      pinnedTextScroller.innerHTML = `📌 Pinned Parameter: <b>${data.sender}</b>: "${data.text}"`;
      pinnedTextScroller.setAttribute("data-target-id", data.messageId || "");
    } else {
      pinnedShelf.classList.add("hidden");
    }
  });

  // ==========================================================================
  // 08. MESSAGES RENDERING LAYOUT & REACTION ACTIONS
  // ==========================================================================
  const qMessages = query(messagesCollection, orderBy("time", "asc"));
  onSnapshot(qMessages, (snapshot) => {
    if (!chatHistory) return;
    chatHistory.innerHTML = "";

    if (snapshot.empty) {
      chatHistory.innerHTML = `<div class="system-msg">Session empty and logs cleared.</div>`;
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

      // Wrap identifier in ID block for reply highlight functionality
      msgElement.id = `msg-${msgId}`;
      msgElement.className = `message-wrapper ${isMe ? "me" : "them"} ${isConsecutive ? "consecutive" : ""}`;

      const timeString = data.time 
        ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : "";

      const customUserColor = data.senderColor || "var(--accent)";
      const firstInitial = data.sender ? data.sender.charAt(0).toUpperCase() : "?";

      let cleanedMessage = data.message || "";
      
      // Inline Math expressions parse
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

      // Append Hover Reactions Bar dynamically to each message
      innerContent += `
        <div class="hover-reactions-quick-bar">
          <button class="quick-emoji" data-id="${msgId}" data-emoji="👍">👍</button>
          <button class="quick-emoji" data-id="${msgId}" data-emoji="❤️">❤️</button>
          <button class="quick-emoji" data-id="${msgId}" data-emoji="🔥">🔥</button>
          <button class="quick-emoji" data-id="${msgId}" data-emoji="😂">😂</button>
          <button class="quick-emoji" data-id="${msgId}" data-emoji="😮">😮</button>
        </div>
      `;

      if (!isConsecutive) {
        innerContent += `<div class="message-meta">
          <div class="user-avatar-circle" style="background:${customUserColor}">${firstInitial}</div>
          <span class="sender-name" style="color:${customUserColor}">${data.sender}</span>
        </div>`;
      }
      
      innerContent += `<div class="bubble-layout">`;

      // Render referenced reply quotes inside the message bubble
      if (data.replyToSender && data.replyToText) {
        innerContent += `
          <div class="quote-snippet-preview" data-target-id="${data.replyToId || ''}">
            <div class="quote-snippet-bar" style="background:${data.replyToColor || 'var(--accent)'}"></div>
            <div class="quote-snippet-details">
              <span class="quote-snippet-sender" style="color:${data.replyToColor || 'var(--accent)'}">${data.replyToSender}</span>
              <span class="quote-snippet-text">${data.replyToText}</span>
            </div>
          </div>
        `;
      }

      if (data.image) {
        innerContent += `<img src="${data.image}" class="chat-img" alt="shared photo">`;
      }
      if (cleanedMessage) {
        const editedTag = data.edited ? `<span class="edited-annotation-tag">(edited)</span>` : "";
        innerContent += `<div class="bubble" style="${isMe ? `background:${customUserColor};color:#111;` : ''}">${cleanedMessage} ${editedTag}</div>`;
      }

      // Render reaction pills inside message block
      let reactionPillsHtml = "";
      if (data.reactions && Object.keys(data.reactions).length > 0) {
        reactionPillsHtml += `<div class="active-reactions-pills-row">`;
        for (const [emoji, users] of Object.entries(data.reactions)) {
          if (users && users.length > 0) {
            const userReacted = users.includes(currentUsername);
            reactionPillsHtml += `
              <button class="emoji-pill-btn ${userReacted ? 'user-reacted' : ''}" data-id="${msgId}" data-emoji="${emoji}">
                <span>${emoji}</span>
                <span class="react-counter">${users.length}</span>
              </button>
            `;
          }
        }
        reactionPillsHtml += `</div>`;
      }
      innerContent += reactionPillsHtml;
      
      // Control Action elements
      const pinTriggerHtml = `<span class="pin-msg-btn action-trigger" data-id="${msgId}" data-sender="${data.sender}" data-text="${cleanedMessage}" title="Pin Parameter">📌</span>`;
      const replyTriggerHtml = `<span class="reply-msg-btn action-trigger" data-id="${msgId}" data-sender="${data.sender}" data-text="${cleanedMessage}" data-color="${customUserColor}" title="Quote Reply">↩️</span>`;
      const editTriggerHtml = isMe ? `<span class="edit-msg-btn action-trigger" data-id="${msgId}" data-text="${cleanedMessage}" title="Edit Data">✏️</span>` : "";
      const deleteTriggerHtml = `<span class="delete-single-btn action-trigger" data-id="${msgId}" title="Purge Log ID">🗑️</span>`;

      innerContent += `
          <div class="bubble-sub">
            <span class="timestamp">${timeString}</span>
            ${replyTriggerHtml}
            ${pinTriggerHtml}
            ${editTriggerHtml}
            ${deleteTriggerHtml}
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
  });

  // ==========================================================================
  // 09. REPLIES, EDITS AND REACTION EVENT ROUTER
  // ==========================================================================
  if (chatHistory) {
    chatHistory.addEventListener("click", async (e) => {
      // 1. Delete Trigger Handler
      if (e.target.classList.contains("delete-single-btn")) {
        const idToDelete = e.target.getAttribute("data-id");
        if (idToDelete && confirm("Completely purge this transmission reference?")) {
          await deleteDoc(doc(db, "messages", idToDelete)).catch(err => console.error(err));
        }
      }

      // 2. Reply Quote Context Selector
      if (e.target.classList.contains("reply-msg-btn")) {
        const mid = e.target.getAttribute("data-id");
        const sender = e.target.getAttribute("data-sender");
        const rawText = e.target.getAttribute("data-text");
        const color = e.target.getAttribute("data-color");

        activeReplyTo = { id: mid, sender, text: rawText, color };
        activeEditMsgId = null; // Clear conflicting edit states

        if (editContextOverlay) editContextOverlay.classList.add("hidden");
        if (replyContextOverlay) {
          replyTargetUser.textContent = sender;
          replyTargetText.textContent = rawText;
          replyContextOverlay.classList.remove("hidden");
        }
        if (messageArea) messageArea.focus();
      }

      // 3. Edit Message Context Selector
      if (e.target.classList.contains("edit-msg-btn")) {
        const mid = e.target.getAttribute("data-id");
        const rawText = e.target.getAttribute("data-text");

        activeEditMsgId = mid;
        activeReplyTo = null; // Clear conflicting reply states

        if (replyContextOverlay) replyContextOverlay.classList.add("hidden");
        if (editContextOverlay) {
          editTargetText.textContent = rawText;
          editContextOverlay.classList.remove("hidden");
        }
        if (messageArea) {
          messageArea.value = rawText;
          messageArea.focus();
        }
      }

      // 4. Pin Message Quick Request
      if (e.target.classList.contains("pin-msg-btn")) {
        const mid = e.target.getAttribute("data-id");
        const sender = e.target.getAttribute("data-sender");
        const text = e.target.getAttribute("data-text");
        if (mid) await pinMessage(mid, sender, text);
      }

      // 5. Expand Lightbox on media click
      if (e.target.classList.contains("chat-img")) {
        if (zoomedImage && zoomModal) {
          zoomedImage.src = e.target.src;
          currentScale = 1;
          zoomedImage.style.transform = `scale(${currentScale})`;
          zoomModal.classList.remove("hidden");
        }
      }

      // 6. Navigation focus via Quote Snippet Preview
      const quoteBlock = e.target.closest(".quote-snippet-preview");
      if (quoteBlock) {
        const targetId = quoteBlock.getAttribute("data-target-id");
        const targetEl = document.getElementById(`msg-${targetId}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
          targetEl.classList.add("flash-highlight-active");
          setTimeout(() => {
            targetEl.classList.remove("flash-highlight-active");
          }, 1500);
        }
      }

      // 7. Hover/Pill Reactions Router
      const isEmojiPill = e.target.closest(".emoji-pill-btn");
      const isQuickEmoji = e.target.closest(".quick-emoji");
      const reactionTarget = isEmojiPill || isQuickEmoji;

      if (reactionTarget) {
        const mid = reactionTarget.getAttribute("data-id");
        const emoji = reactionTarget.getAttribute("data-emoji");
        if (mid && emoji) {
          await submitEmojiReaction(mid, emoji);
        }
      }
    });
  }

  // Submit and update reaction payload over Firestore
  async function submitEmojiReaction(messageId, emoji) {
    if (!currentUsername) return;
    const msgRef = doc(db, "messages", messageId);
    
    try {
      const snap = await getDocs(query(messagesCollection));
      const currentDoc = snap.docs.find(d => d.id === messageId);
      if (!currentDoc) return;

      const data = currentDoc.data();
      let reactions = data.reactions || {};
      let usersList = reactions[emoji] || [];

      if (usersList.includes(currentUsername)) {
        // Remove reaction if already submitted
        usersList = usersList.filter(u => u !== currentUsername);
      } else {
        usersList.push(currentUsername);
      }

      reactions[emoji] = usersList;
      await updateDoc(msgRef, { reactions });
    } catch (err) {
      console.error("Reaction matrix post failed:", err);
    }
  }

  // Cancel reply context trigger
  if (closeReplyContextBtn) {
    closeReplyContextBtn.addEventListener("click", () => {
      activeReplyTo = null;
      if (replyContextOverlay) replyContextOverlay.classList.add("hidden");
    });
  }

  // Cancel edit context trigger
  if (closeEditContextBtn) {
    closeEditContextBtn.addEventListener("click", () => {
      activeEditMsgId = null;
      if (editContextOverlay) editContextOverlay.classList.add("hidden");
      if (messageArea) messageArea.value = "";
    });
  }

  // ==========================================================================
  // 10. GOD INSTANCE AUTOMATION INTERACTION OVERLAYS
  // ==========================================================================
  async function purgeChatRoomLogs() {
    try {
      const querySnapshot = await getDocs(messagesCollection);
      if (querySnapshot.empty) return;
      
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Wipe command terminal failure:", err);
    }
  }

  async function sendGodSms(textPayload) {
    await addDoc(messagesCollection, {
      sender: "GOD",
      senderColor: "#ff4757",
      message: textPayload,
      time: Date.now()
    }).catch(err => console.error("God broadcast failure:", err));
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

    globalTimerDisplayString = `Purge: ${minutesLeft}m ${secondsLeft}s [God Mode: ${godIsActive ? "ACTIVE" : "MUTED"}]`;
    combineFooterDisplays();

    if (godIsActive && remainingSeconds === 120 && !warningTwoMinSent) {
      warningTwoMinSent = true;
      sendGodSms("⚠️ TWO MINUTES REMAINING. Purge matrix initiated.");
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

  // ==========================================================================
  // 11. MEDIA AND FILE COMPRESSION CONVERTER ENGINE
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

  // ==========================================================================
  // 12. TEXT MESSAGING COMPILATION AND TRANSMISSION DISPATCH
  // ==========================================================================
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
      
      await addDoc(messagesCollection, {
        sender: "AI Bot",
        senderColor: "#ff9f43",
        message: replyText ? replyText.trim() : "Transmission timeout. Resubmit parameter query.",
        time: Date.now()
      });
    } catch (err) {
      console.error("AI Node failed to compile reply:", err);
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

      // God Mode Math lock checker
      if (godIsActive && currentAnswer !== null) {
        if (parseInt(text) === currentAnswer) {
          godIsActive = false;
          currentAnswer = null;
          messageArea.value = "";
          await sendGodSms("❌ Direct interface command approved. Muted until next purge cycle.");
          return;
        } else {
          messageArea.value = "";
          await sendGodSms("❌ INCORRECT command string. Resolve challenge parameters.");
          return;
        }
      }

      // God removal system command intercept
      if (text.toLowerCase() === "/removegod") {
        messageArea.value = "";
        if (!godIsActive) {
          await sendGodSms("GOD node already silenced in active buffer.");
          return;
        }
        const mathQuestion = makeHardQuestion();
        await sendGodSms(`⚡ CORE CHALLENGE DETECTED: ${mathQuestion}`);
        return;
      }

      // 1. Context check: Is Edit mode active?
      if (activeEditMsgId) {
        const editDocRef = doc(db, "messages", activeEditMsgId);
        await updateDoc(editDocRef, {
          message: text,
          edited: true
        }).catch(err => console.error("Update payload error:", err));

        activeEditMsgId = null;
        if (editContextOverlay) editContextOverlay.classList.add("hidden");
      } 
      // 2. Default: Send regular (or Replied) Message
      else {
        let messagePayload = {
          sender: currentUsername || "Anonymous",
          senderColor: currentUserColor,
          message: text,
          image: selectedImageBase64,
          time: Date.now()
        };

        // Attach quote indexes if reply active
        if (activeReplyTo) {
          messagePayload.replyToId = activeReplyTo.id;
          messagePayload.replyToSender = activeReplyTo.sender;
          messagePayload.replyToText = activeReplyTo.text;
          messagePayload.replyToColor = activeReplyTo.color;

          activeReplyTo = null;
          if (replyContextOverlay) replyContextOverlay.classList.add("hidden");
        }

        await addDoc(messagesCollection, messagePayload).catch(err => console.error("Transmission upload aborted:", err));
      }

      // Reset values post-dispatch
      messageArea.value = "";
      localStorage.removeItem("chat_draft");
      selectedImageBase64 = "";
      if (imageInput) imageInput.value = "";
      if (cameraInput) cameraInput.value = "";
      if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
      
      clearTimeout(typingTimeout);
      updatePresence(true, false);

      // AI mainframe trigger hook
      if (text.toLowerCase().startsWith("@ai")) {
        const cleanedPrompt = text.replace(/^@ai\s*/i, "").trim();
        
        if (cleanedPrompt) {
          fetchAiReply(cleanedPrompt);
        } else {
          await addDoc(messagesCollection, {
            sender: "AI Bot",
            senderColor: "#ff9f43",
            message: "🤖 Listening... Input command query trailing '@ai' tag.",
            time: Date.now()
          });
        }
      }
    });
  }

  // ==========================================================================
  // 13. UI CONTROLS & PALETTE SHIFT MATRIX
  // ==========================================================================
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

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", async () => {
      if (confirm("Perform absolute emergency purge of all mainframe logs?")) {
        await purgeChatRoomLogs();
      }
    });
  }

  // ==========================================================================
  // 14. LIGHTBOX EXPANDED PAYLOAD ENHANCEMENTS
  // ==========================================================================
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

  // Dynamic viewport-fit sizing adjustments
  window.visualViewport?.addEventListener("resize", () => {
     setTimeout(() => {
       if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
     }, 100);
  });

  // Dynamic auto-scrolling control button
  const scrollBtn = document.createElement("button");
  scrollBtn.id = "scrollBottomBtn";
  scrollBtn.type = "button";
  scrollBtn.textContent = "⬇";
  scrollBtn.title = "Scroll to bottom";
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
