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

// Firebase Configuration Link
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

// App Operational Context State Panels
let currentUsername = localStorage.getItem("chat_username") || "";
let currentUserColor = localStorage.getItem("chat_user_color") || "#00d2d3";
let selectedImageBase64 = "";
let typingTimeout = null;
let currentFontSize = parseInt(localStorage.getItem("chat_font_size") || "15", 10);
let globalTypingDisplayString = "";

// Chatbot Context History Arrays
let aiConversationHistory = [
  { role: "system", content: "You are a ultra-responsive conversational AI module integrated inside a developer cyberpunk grid hub." }
];

// Document Object UI Selectors
const nameModal = document.getElementById("nameModal");
const usernameInput = document.getElementById("usernameInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const colorDots = document.querySelectorAll(".color-dot");
const chatHistory = document.getElementById("chatHistory");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const userList = document.getElementById("userList");
const typingIndicator = document.getElementById("typingIndicator");
const imageUploadInput = document.getElementById("imageUploadInput");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const cancelImageBtn = document.getElementById("cancelImageBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const incFontBtn = document.getElementById("incFontBtn");
const decFontBtn = document.getElementById("decFontBtn");

// Image Inspector Modal Hooks
const zoomModal = document.getElementById("zoomModal");
const zoomedImage = document.getElementById("zoomedImage");
const closeZoom = document.getElementById("closeZoom");

// Swipe Geometry State Management Vectors
let touchStartX = 0;
let touchEndX = 0;

// Dynamic Application Styling Sheets Initialization
const dynamicStyleNode = document.createElement("style");
dynamicStyleNode.id = "dynamic-font-overrides";
document.head.appendChild(dynamicStyleNode);

function applyGlobalFontSize(size) {
  currentFontSize = Math.max(8, Math.min(size, 46));
  localStorage.setItem("chat_font_size", currentFontSize);
  dynamicStyleNode.innerHTML = `.bubble-content, #messageInput { font-size: ${currentFontSize}px !important; }`;
}
applyGlobalFontSize(currentFontSize);

// Backdrops Theme Array Cycles
const cryptThemes = [
  "#1e2330", "#0f111a", "#1a1c23", "#12131a", "#1c1e24", "#0d0e15"
];
let coreThemeIndex = 0;

// App Execution Entry Points
window.addEventListener("DOMContentLoaded", () => {
  setupProfileModalSystem();
  initializeDatabaseListeners();
  bindUserEventHandlers();
  updateIdentityDisplays();
});

// User Identity & Colors Configuration System
function setupProfileModalSystem() {
  if (!currentUsername) {
    nameModal.classList.remove("hidden");
    nameModal.style.display = "flex";
  } else {
    nameModal.classList.add("hidden");
    nameModal.style.display = "none";
    updatePresence(true);
  }

  colorDots.forEach(dot => {
    dot.addEventListener("click", () => {
      colorDots.forEach(d => d.classList.remove("active"));
      dot.classList.add("active");
      currentUserColor = dot.getAttribute("data-color") || "#00d2d3";
    });
  });

  saveProfileBtn.addEventListener("click", handleUserSetupSave);
}

async function handleUserSetupSave() {
  const newName = usernameInput.value.trim();
  if (!newName) {
    alert("Specify an interface account signature identifier.");
    return;
  }

  const identityToken = newName.toLowerCase().replace(/\s+/g, '_');
  const systemReservedNames = ["system", "ai bot", "god", "admin", "null", "ghostchat", "broadcast"];
  
  if (systemReservedNames.includes(newName.toLowerCase())) {
    alert("This designation handles is reserved by server root network nodes.");
    return;
  }

  try {
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Validating Handle uniqueness...";

    // Query active operators on the network to enforce unique usernames
    const currentUsersSnap = await getDocs(query(statusCollection));
    let isHandleInUse = false;

    currentUsersSnap.forEach((docRecord) => {
      const liveData = docRecord.data();
      if (docRecord.id === identityToken && liveData.isOnline === true) {
        isHandleInUse = true;
      }
    });

    if (isHandleInUse) {
      alert("Identity handle is assigned to an online terminal connection. Pick another signature.");
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = "Connect Interface";
      return;
    }

    currentUsername = newName;
    localStorage.setItem("chat_username", currentUsername);
    localStorage.setItem("chat_user_color", currentUserColor);

    nameModal.classList.add("hidden");
    nameModal.style.display = "none";

    updateIdentityDisplays();
    await updatePresence(true);
  } catch (error) {
    console.error("Presence check system pipeline block:", error);
    alert("Network sync fault. Retry profile handshake verification.");
  } finally {
    saveProfileBtn.disabled = false;
  }
}

function updateIdentityDisplays() {
  const customAccentColor = currentUserColor || "#00d2d3";
  document.documentElement.style.setProperty('--accent', customAccentColor);
  document.documentElement.style.setProperty('--bubble-me', customAccentColor);
}

// Presence Network Signaling Loops
async function updatePresence(isOnline, isTyping = false, explicitName = "") {
  const nameToRegister = explicitName || currentUsername;
  if (!nameToRegister) return;
  const userNodeId = nameToRegister.toLowerCase().replace(/\s+/g, '_');
  try {
    await setDoc(doc(statusCollection, userNodeId), {
      username: nameToRegister,
      color: currentUserColor || "#00d2d3",
      isOnline: isOnline,
      isTyping: isTyping,
      lastSeen: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error("Presence transmission tracking dropped:", err);
  }
}

// Global Remote Collection Synced Listeners
function initializeDatabaseListeners() {
  const qMessages = query(messagesCollection, orderBy("time", "asc"));

  // Batch-driven rendering logic using fragments and RAF loops for layout optimization
  onSnapshot(qMessages, (snapshot) => {
    if (!chatHistory) return;

    window.requestAnimationFrame(() => {
      chatHistory.innerHTML = "";
      if (snapshot.empty) {
        chatHistory.innerHTML = `<div class="system-msg">Grid messaging databanks clear. Connection established.</div>`;
        return;
      }

      const renderingFragment = document.createDocumentFragment();
      let lastSender = "";

      snapshot.forEach((snapshotDoc) => {
        const msgData = snapshotDoc.data();
        const msgElement = document.createElement("div");
        msgElement.className = "message-row animate-fade-in";

        const isMe = msgData.sender === currentUsername;
        if (isMe) msgElement.classList.add("me");

        const hasMedia = !!msgData.imageUrl;
        const textValue = msgData.message || "";
        const isConsecutive = lastSender === msgData.sender;
        lastSender = msgData.sender;

        let contentPayload = "";
        if (!isConsecutive) {
          const userAvatarInitial = msgData.sender ? msgData.sender.charAt(0).toUpperCase() : "?";
          const resolvedAccentColor = msgData.senderColor || "var(--accent)";
          
          // Append unique badge tags dynamically for admin level operators
          let adminBadgeElement = "";
          const downcasedSender = (msgData.sender || "").toLowerCase().trim();
          if (downcasedSender === "ace" || downcasedSender === "ghost") {
            adminBadgeElement = `<span class="admin-badge" style="background:linear-gradient(135deg,#ff4757,#ff6b6b);color:#fff;font-size:8px;font-weight:800;padding:1px 5px;border-radius:4px;margin-left:5px;box-shadow:0 0 8px rgba(255,71,87,0.4);">⚡ ADMIN</span>`;
          }

          contentPayload += `
            <div class="message-meta">
              <div class="user-avatar-circle" style="background:${resolvedAccentColor}">${userAvatarInitial}</div>
              <span class="sender-name" style="color:${resolvedAccentColor}">${msgData.sender}</span>
              ${adminBadgeElement}
            </div>`;
        }

        const parseCleanString = cleanLatexTags(textValue);
        let bubbleRenderBlock = "";
        if (hasMedia) {
          bubbleRenderBlock = `
            <div class="bubble visual-bubble">
              <div class="bubble-image-wrap">
                <img src="${msgData.imageUrl}" class="chat-attached-image lazy-trigger" alt="Decrypted Transmitted Payload Visual">
                <div class="img-overlay-specs">INSPECT VIEWPORT</div>
              </div>
              ${parseCleanString ? `<div class="bubble-content image-caption-spacing">${parseCleanString}</div>` : ""}
            </div>`;
        } else {
          bubbleRenderBlock = `
            <div class="bubble">
              <div class="bubble-content">${parseCleanString}</div>
            </div>`;
        }

        contentPayload += `
          <div class="message-wrapper">
            ${bubbleRenderBlock}
            <span class="message-timestamp">${formatDisplayTime(msgData.time)}</span>
          </div>`;

        msgElement.innerHTML = contentPayload;

        // Image Click Modal Triggers
        if (hasMedia) {
          const targetImg = msgElement.querySelector(".chat-attached-image");
          targetImg?.addEventListener("click", () => {
            if (zoomModal && zoomedImage) {
              zoomedImage.src = msgData.imageUrl;
              zoomModal.classList.remove("hidden");
            }
          });
        }

        renderingFragment.appendChild(msgElement);
      });

      chatHistory.appendChild(renderingFragment);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    });
  });

  // Operators List Layout Synced Snapshot Loop
  onSnapshot(query(statusCollection), (snapshot) => {
    if (!userList) return;
    window.requestAnimationFrame(() => {
      userList.innerHTML = "";
      const currentEpoch = Date.now();

      snapshot.forEach((userDoc) => {
        const profile = userDoc.data();
        const isStale = (currentEpoch - (profile.lastSeen || 0)) > 60000;
        if (!profile.isOnline || isStale) return;

        const onlineUserRow = document.createElement("div");
        onlineUserRow.className = "user-card";
        
        let indicatorStyleClass = "user-status-dot online";
        if (profile.isTyping) indicatorStyleClass = "user-status-dot typing-pulse-dot";

        onlineUserRow.innerHTML = `
          <div class="user-card-avatar" style="border-color:${profile.color || 'var(--accent)'}">
            ${(profile.username || "X").charAt(0).toUpperCase()}
          </div>
          <span class="user-card-name">${profile.username}</span>
          <div class="${indicatorStyleClass}"></div>
        `;
        userList.appendChild(onlineUserRow);
      });
    });
  });

  // Typing Matrix Multi-Operator Listening Node
  onSnapshot(query(statusCollection), (snapshot) => {
    let typingOperators = [];
    snapshot.forEach((uDoc) => {
      const uData = uDoc.data();
      if (uData.isTyping && uData.username !== currentUsername && (Date.now() - (uData.lastSeen || 0)) < 15000) {
        typingOperators.push(uData.username);
      }
    });

    if (typingOperators.length > 0) {
      globalTypingDisplayString = `📡 ${typingOperators.join(", ")} formatting data packets...`;
    } else {
      globalTypingDisplayString = "";
    }
    syncHeaderInformationOutput();
  });
}

function syncHeaderInformationOutput() {
  if (!typingIndicator) return;
  if (globalTypingDisplayString) {
    typingIndicator.innerHTML = globalTypingDisplayString;
    typingIndicator.classList.remove("hidden");
  } else {
    typingIndicator.classList.add("hidden");
  }
}

// User Action Trigger Handlers Bindings
function bindUserEventHandlers() {
  // Primary Text Dispatch Key triggers
  sendBtn?.addEventListener("click", dispatchDataPacket);
  messageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      dispatchDataPacket();
    }
  });

  // Keypress Typing Status Triggers
  messageInput?.addEventListener("input", () => {
    updatePresence(true, true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      updatePresence(true, false);
    }, 4000);
  });

  // Image Import Actions Hookup
  imageUploadInput?.addEventListener("change", handleFileImportSelection);
  cancelImageBtn?.addEventListener("click", resetVisualBufferInput);

  // Layout View Interface Modifiers
  themeToggleBtn?.addEventListener("click", () => {
    coreThemeIndex = (coreThemeIndex + 1) % cryptThemes.length;
    document.documentElement.style.setProperty('--bg-chat', cryptThemes[coreThemeIndex]);
  });

  clearChatBtn?.addEventListener("click", async () => {
    if (confirm("Confirm full purge of shared visual message data?")) {
      await purgeChatRoomLogs();
    }
  });

  incFontBtn?.addEventListener("click", () => applyGlobalFontSize(currentFontSize + 2));
  decFontBtn?.addEventListener("click", () => applyGlobalFontSize(currentFontSize - 2));

  // Refactored Zoom Modal Close Interactions via Touch Gestures
  if (closeZoom && zoomModal) {
    closeZoom.addEventListener("click", () => zoomModal.classList.add("hidden"));
  }

  if (zoomModal) {
    zoomModal.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    zoomModal.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      evaluateLightboxGestures();
    }, { passive: true });
  }

  // Floating Navigation Action Attachment Routine
  const scrollBottomTrigger = document.createElement("button");
  scrollBottomTrigger.id = "scrollBottomBtn";
  scrollBottomTrigger.type = "button";
  scrollBottomTrigger.textContent = "⬇";
  scrollBottomTrigger.title = "Scroll to latest message";
  document.querySelector(".chat-container")?.appendChild(scrollBottomTrigger);

  const jumpToBottomBounds = () => {
    if (!chatHistory) return;
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: "smooth" });
  };

  scrollBottomTrigger.addEventListener("click", jumpToBottomBounds);
  chatHistory?.addEventListener("scroll", () => {
    const fromBottomThreshold = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight;
    if (fromBottomThreshold > 400) {
      scrollBottomTrigger.classList.add("visible");
    } else {
      scrollBottomTrigger.classList.remove("visible");
    }
  });
}

function evaluateLightboxGestures() {
  const horizontalSwipeLimit = 80;
  if (Math.abs(touchEndX - touchStartX) > horizontalSwipeLimit) {
    zoomModal.classList.add("hidden");
  }
}

// Data Serialization Sending Blocks
async function dispatchDataPacket() {
  const messageString = messageInput.value.trim();
  if (!messageString && !selectedImageBase64) return;

  const currentPayloadMessage = messageString;
  const currentPayloadImage = selectedImageBase64;

  // Clear tracking references instantaneously
  messageInput.value = "";
  resetVisualBufferInput();
  if (typingTimeout) clearTimeout(typingTimeout);
  updatePresence(true, false);

  try {
    // Process command routines matching deep AI bot calls
    if (currentPayloadMessage.startsWith("/ai ")) {
      const isolatedPrompt = currentPayloadMessage.substring(4).trim();
      
      // Post user's initial command prompt entry immediately to history stack
      await addDoc(messagesCollection, {
        sender: currentUsername,
        senderColor: currentUserColor || "#00d2d3",
        message: currentPayloadMessage,
        imageUrl: currentPayloadImage || null,
        time: Date.now()
      });

      if (isolatedPrompt) {
        await executeAiConversationLoop(isolatedPrompt);
      }
      return;
    }

    // Default processing track routing
    await addDoc(messagesCollection, {
      sender: currentUsername,
      senderColor: currentUserColor || "#00d2d3",
      message: currentPayloadMessage,
      imageUrl: currentPayloadImage || null,
      time: Date.now()
    });

  } catch (err) {
    console.error("Packet database record drop failure:", err);
  }
}

// Context History AI Response Operations Engine
async function executeAiConversationLoop(promptText) {
  try {
    updateAiModuleState(true);

    // Append user sequence string context directly onto the rolling history chain array
    aiConversationHistory.push({ role: "user", content: promptText });

    // Limit active chat history limits to 12 items to preserve mobile device performance metrics
    if (aiConversationHistory.length > 13) {
      aiConversationHistory = [aiConversationHistory[0], ...aiConversationHistory.slice(-12)];
    }

    const outputResponse = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: aiConversationHistory })
    });

    const outputText = await outputResponse.text();
    const cleanSystemReply = outputText ? outputText.trim() : "Core inference engine returned an empty operational packet response.";

    // Insert assistant response statement vector into tracking context
    aiConversationHistory.push({ role: "assistant", content: cleanSystemReply });

    await addDoc(messagesCollection, {
      sender: "AI Bot",
      senderColor: "#ff9f43",
      message: cleanSystemReply,
      imageUrl: null,
      time: Date.now()
    });

  } catch (error) {
    console.error("AI Network engine communication error:", error);
  } finally {
    updateAiModuleState(false);
  }
}

async function updateAiModuleState(isProcessing) {
  try {
    await setDoc(doc(statusCollection, "ai_bot_presence_node"), {
      username: "AI Bot",
      color: "#ff9f43",
      isOnline: true,
      isTyping: isProcessing,
      lastSeen: Date.now()
    }, { merge: true });
  } catch (e) {
    console.error("AI node tracking update blocked:", e);
  }
}

// Media Compression Handlers Pipeline
function handleFileImportSelection(event) {
  const fileTarget = event.target.files?.[0];
  if (!fileTarget) return;

  const objectReader = new FileReader();
  objectReader.onload = function(e) {
    const structuralImg = new Image();
    structuralImg.onload = function() {
      // Offscreen HTML5 canvas compression framework implementation
      const offscreenCanvas = document.createElement("canvas");
      let computedWidth = structuralImg.width;
      let computedHeight = structuralImg.height;
      const dimensionsLimitBound = 600;

      if (computedWidth > dimensionsLimitBound || computedHeight > dimensionsLimitBound) {
        if (computedWidth > computedHeight) {
          computedHeight = Math.round((computedHeight * dimensionsLimitBound) / computedWidth);
          computedWidth = dimensionsLimitBound;
        } else {
          computedWidth = Math.round((computedWidth * dimensionsLimitBound) / computedHeight);
          computedHeight = dimensionsLimitBound;
        }
      }

      offscreenCanvas.width = computedWidth;
      offscreenCanvas.height = computedHeight;
      const renderContext2d = offscreenCanvas.getContext("2d");
      renderContext2d?.drawImage(structuralImg, 0, 0, computedWidth, computedHeight);

      selectedImageBase64 = offscreenCanvas.toDataURL("image/jpeg", 0.6);
      
      if (imagePreview && imagePreviewContainer) {
        imagePreview.src = selectedImageBase64;
        imagePreviewContainer.classList.remove("hidden");
      }
    };
    structuralImg.src = e.target?.result;
  };
  objectReader.readAsDataURL(fileTarget);
}

function resetVisualBufferInput() {
  selectedImageBase64 = "";
  if (imageUploadInput) imageUploadInput.value = "";
  imagePreviewContainer?.classList.add("hidden");
  if (imagePreview) imagePreview.src = "";
}

// Remote Clean Up Routine Operations
async function purgeChatRoomLogs() {
  try {
    const recordsSnapshot = await getDocs(messagesCollection);
    const databaseBatchInstance = writeBatch(db);
    recordsSnapshot.forEach((docRecord) => {
      databaseBatchInstance.delete(docRecord.ref);
    });
    await databaseBatchInstance.commit();
  } catch (err) {
    console.error("System storage clear execution interrupted:", err);
  }
}

// Data Presentation Utility Handlers
function cleanLatexTags(inputString) {
  if (!inputString) return "";
  return inputString
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\([a-zA-Z]+)/g, '');
}

function formatDisplayTime(unixMillis) {
  if (!unixMillis) return "";
  const dateObj = new Date(unixMillis);
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Auto Unload Cleanup Callbacks
window.addEventListener("beforeunload", () => {
  updatePresence(false);
});
