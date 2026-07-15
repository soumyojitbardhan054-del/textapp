/**
 * Core Application State
 */
const AppState = {
    // Current user local session details
    currentUser: {
        id: null, // Generated unique persistent ID
        name: 'Ace',
        color: '#ff6b6b'
    },
    // Registry of active users to prevent duplicate "ghost" users on name changes
    // Structured as: { [userId]: { id, name, color, isOnline } }
    activeUsers: {},
    
    // UI Layout Configuration variables
    currentFontSize: 14, // Default chat message size
    zoomScale: 1.0,      // Image lightbox scale factor
    
    // Message transaction contexts
    replyTargetMessage: null,
    editTargetMessage: null,
    attachedImageBase64: null
};

// --- DOM ELEMENT REFERENCES ---
const appSidebar = document.getElementById('appSidebar');
const menuToggleBtn = document.getElementById('menuToggleBtn');
const currentUserDisplay = document.getElementById('currentUserDisplay');
const onlineUsersList = document.getElementById('onlineUsersList');

const decFontBtn = document.getElementById('decFontBtn');
const incFontBtn = document.getElementById('incFontBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

const chatHistory = document.getElementById('chatHistory');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
const typingBanner = document.getElementById('typingBanner');

const replyContextOverlay = document.getElementById('replyContextOverlay');
const replyTargetUser = document.getElementById('replyTargetUser');
const replyTargetText = document.getElementById('replyTargetText');
const cancelReplyBtn = document.getElementById('cancelReplyBtn');

const editContextOverlay = document.getElementById('editContextOverlay');
const editTargetText = document.getElementById('editTargetText');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const cancelImageBtn = document.getElementById('cancelImage');
const imageUploadInput = document.getElementById('imageUpload');

const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');

const identityModal = document.getElementById('identityModal');
const usernameInput = document.getElementById('usernameInput');
const colorDots = document.querySelectorAll('.color-dot');
const saveIdentityBtn = document.getElementById('saveIdentityBtn');

const pinnedShelf = document.getElementById('pinnedShelf');
const pinnedContentPlaceholder = document.getElementById('pinnedContentPlaceholder');
const unpinShelfBtn = document.getElementById('unpinShelfBtn');

const imageZoomModal = document.getElementById('imageZoomModal');
const zoomedImage = document.getElementById('zoomedImage');
const closeZoomBtn = document.getElementById('closeZoomBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');


/**
 * 1. INITIALIZATION & IDENTITY PERSISTENCE
 */
window.addEventListener('DOMContentLoaded', () => {
    initUserIdentity();
    setupEventListeners();
    setupDemoMockData(); // Pre-populates clean chat elements to test with
});

function initUserIdentity() {
    // Generate or load unique ID so the user is always tracked consistently
    let storedId = localStorage.getItem('chat_user_id');
    if (!storedId) {
        storedId = 'usr_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chat_user_id', storedId);
    }
    AppState.currentUser.id = storedId;

    // Load saved nickname and color preferences
    const storedName = localStorage.getItem('chat_username');
    const storedColor = localStorage.getItem('chat_color');

    if (storedName) {
        AppState.currentUser.name = storedName;
        AppState.currentUser.color = storedColor || '#ff6b6b';
        
        // Skip setup modal if details exist
        identityModal.classList.add('hidden-modal');
        updateCurrentUserUI();
        syncUserSessionToNetwork();
    } else {
        // Open setup modal
        identityModal.classList.remove('hidden-modal');
    }
}

// Re-renders the main UI self card
function updateCurrentUserUI() {
    currentUserDisplay.textContent = AppState.currentUser.name;
    const selfCard = document.querySelector('.user-card');
    if (selfCard) {
        selfCard.style.borderLeft = `4px solid ${AppState.currentUser.color}`;
    }
}


/**
 * 2. RESOLVING THE NAME-CHANGE & ACTIVE LIST DUPLICATION
 * Tracking users by their exact "id" guarantees name changes work perfectly.
 */
function updateActiveUserRegistry(userId, name, color, isOnline = true) {
    // If user changes their name/color, it overwrites the existing ID keys cleanly!
    AppState.activeUsers[userId] = {
        id: userId,
        name: name,
        color: color,
        isOnline: isOnline
    };

    renderActiveUsersList();
}

function renderActiveUsersList() {
    // Completely clear the list to prevent ghosts, and reconstruct
    onlineUsersList.innerHTML = '';

    Object.values(AppState.activeUsers).forEach(user => {
        // Only show users who are active
        if (!user.isOnline) return;

        const userItem = document.createElement('div');
        userItem.className = 'online-user-item active-online';
        userItem.setAttribute('data-user-id', user.id);

        // Get initials for the avatar
        const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';

        userItem.innerHTML = `
            <div class="mini-avatar" style="background-color: ${user.color || '#2b313f'}">
                ${initial}
            </div>
            <div class="user-item-details">
                <span class="user-item-handle">${user.name}</span>
                <span class="user-item-status-label">Online</span>
            </div>
        `;
        onlineUsersList.appendChild(userItem);
    });
}

// Simulated Network Synchronization Broadcast
function syncUserSessionToNetwork() {
    // Update local registry copy for self
    updateActiveUserRegistry(
        AppState.currentUser.id,
        AppState.currentUser.name,
        AppState.currentUser.color,
        true
    );

    /* BACKEND INTEGRATION HOOK (e.g., Socket.io):
       if (socket && socket.connected) {
           socket.emit('user:update_identity', AppState.currentUser);
       }
    */
}


/**
 * 3. EVENT LISTENERS MANAGEMENT
 */
function setupEventListeners() {
    // --- Mobile Drawer Toggle Events ---
    menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        appSidebar.classList.toggle('open');
    });

    // Tap chat viewport to close open mobile sidebar automatically
    chatHistory.addEventListener('click', () => {
        if (appSidebar.classList.contains('open')) {
            appSidebar.classList.remove('open');
        }
    });

    // --- Profile Editing Feature ---
    // Users can click on their self-card in the sidebar to modify their name/color!
    const userCard = document.querySelector('.user-card');
    if (userCard) {
        userCard.style.cursor = 'pointer';
        userCard.addEventListener('click', () => {
            usernameInput.value = AppState.currentUser.name;
            // Highlight saved color dot
            colorDots.forEach(dot => {
                if (dot.getAttribute('data-color') === AppState.currentUser.color) {
                    dot.classList.add('selected');
                } else {
                    dot.classList.remove('selected');
                }
            });
            identityModal.classList.remove('hidden-modal');
        });
    }

    // --- Identity Modal Setup ---
    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('selected'));
            dot.classList.add('selected');
            AppState.currentUser.color = dot.getAttribute('data-color');
        });
    });

    saveIdentityBtn.addEventListener('click', () => {
        const inputVal = usernameInput.value.trim();
        if (!inputVal) return;

        AppState.currentUser.name = inputVal;
        
        // Save preferences to LocalStorage
        localStorage.setItem('chat_username', AppState.currentUser.name);
        localStorage.setItem('chat_color', AppState.currentUser.color);

        updateCurrentUserUI();
        syncUserSessionToNetwork();

        identityModal.classList.add('hidden-modal');
    });

    // --- Font Scaling Options ---
    incFontBtn.addEventListener('click', () => changeFontSize(2));
    decFontBtn.addEventListener('click', () => changeFontSize(-2));

    // --- Image Zoom / Lightbox Options ---
    closeZoomBtn.addEventListener('click', closeLightbox);
    zoomInBtn.addEventListener('click', () => adjustZoom(0.2));
    zoomOutBtn.addEventListener('click', () => adjustZoom(-0.2));
    imageZoomModal.addEventListener('click', (e) => {
        if (e.target === imageZoomModal) closeLightbox();
    });

    // --- Media Input Mechanics ---
    imageUploadInput.addEventListener('change', handleImageAttachment);
    cancelImageBtn.addEventListener('click', clearImageAttachment);

    // --- Send Actions ---
    sendBtn.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // --- Overlays & Shelf ---
    cancelReplyBtn.addEventListener('click', clearReplyContext);
    cancelEditBtn.addEventListener('click', clearEditContext);
    unpinShelfBtn.addEventListener('click', closePinnedShelf);

    // --- Clear Chat Canvas Option ---
    clearChatBtn.addEventListener('click', () => {
        chatHistory.innerHTML = '<div class="system-msg">Canvas cleared by user</div>';
        closePinnedShelf();
    });

    // --- Auto-scroll Bot Sensor ---
    chatHistory.addEventListener('scroll', toggleScrollBottomBtn);
    scrollBottomBtn.addEventListener('click', scrollToBottom);
}


/**
 * 4. REAL-TIME CHAT ACTIONS & SEND ENGINE
 */
function handleSendMessage() {
    const text = messageInput.value.trim();
    
    // Validate we have payload content
    if (!text && !AppState.attachedImageBase64) return;

    if (AppState.editTargetMessage) {
        // Complete Edit Action
        applyMessageEdit(AppState.editTargetMessage, text);
    } else {
        // Build New Message Object
        const messageObj = {
            id: 'msg_' + Date.now(),
            senderId: AppState.currentUser.id,
            senderName: AppState.currentUser.name,
            senderColor: AppState.currentUser.color,
            text: text,
            image: AppState.attachedImageBase64,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            replyTo: AppState.replyTargetMessage ? {
                sender: AppState.replyTargetMessage.senderName,
                text: AppState.replyTargetMessage.text || 'Image'
            } : null
        };

        appendMessageToDOM(messageObj, true);
        
        /* BACKEND INTEGRATION HOOK:
           if (socket) socket.emit('chat:message', messageObj);
        */
    }

    // Reset Context states
    messageInput.value = '';
    clearImageAttachment();
    clearReplyContext();
    clearEditContext();
    scrollToBottom();
}

function appendMessageToDOM(msg, isSelfGenerated = false) {
    const isMe = msg.senderId === AppState.currentUser.id;
    
    const wrapper = document.createElement('div');
    wrapper.id = msg.id;
    wrapper.className = `message-wrapper ${isMe ? 'me' : 'them'}`;
    wrapper.setAttribute('data-text', msg.text || '');

    // Profile Context Block
    const metaMarkup = isMe ? '' : `
        <div class="message-meta">
            <div class="user-avatar-circle" style="background-color: ${msg.senderColor}">
                ${msg.senderName.charAt(0).toUpperCase()}
            </div>
            <span class="sender-name">${msg.senderName}</span>
        </div>
    `;

    // Reply Markup Context Preview
    let replyMarkup = '';
    if (msg.replyTo) {
        replyMarkup = `
            <div class="quote-snippet-preview">
                <div class="quote-snippet-bar" style="background-color: ${isMe ? '#222938' : 'var(--accent)'}"></div>
                <div class="quote-snippet-details">
                    <span class="quote-snippet-sender">${msg.replyTo.sender}</span>
                    <span class="quote-snippet-text">${msg.replyTo.text}</span>
                </div>
            </div>
        `;
    }

    // Attached Image Markup Block
    let imageMarkup = '';
    if (msg.image) {
        imageMarkup = `<img src="${msg.image}" class="chat-img" alt="Uploaded Attachment">`;
    }

    // Combine into full layout
    wrapper.innerHTML = `
        ${metaMarkup}
        
        <div class="hover-reactions-quick-bar">
            <button class="quick-emoji" onclick="addReactionToMessage('${msg.id}', '❤️')">❤️</button>
            <button class="quick-emoji" onclick="addReactionToMessage('${msg.id}', '👍')">👍</button>
            <button class="quick-emoji" onclick="addReactionToMessage('${msg.id}', '🔥')">🔥</button>
            <button class="quick-emoji" onclick="addReactionToMessage('${msg.id}', '😂')">😂</button>
        </div>

        <div class="bubble-layout">
            ${replyMarkup}
            <div class="bubble">
                <span class="bubble-content-span">${msg.text}</span>
            </div>
            ${imageMarkup}

            <div class="bubble-sub">
                <span class="timestamp">${msg.timestamp}</span>
                <span class="action-trigger" onclick="setupReplyTo('${msg.id}')">Reply</span>
                ${isMe ? `<span class="action-trigger" onclick="setupEditOf('${msg.id}')">Edit</span>` : ''}
                <span class="action-trigger" onclick="pinMessage('${msg.id}')">Pin</span>
                <span class="action-trigger" style="color:#ff6b6b;" onclick="deleteMessage('${msg.id}')">Delete</span>
            </div>

            <div class="active-reactions-pills-row" id="reactions-${msg.id}"></div>
        </div>
    `;

    // Bind Image Lightbox Click Listeners
    const appendedImg = wrapper.querySelector('.chat-img');
    if (appendedImg) {
        appendedImg.addEventListener('click', () => openLightbox(msg.image));
    }

    chatHistory.appendChild(wrapper);
}


/**
 * 5. INTERACTIVE FEATURE ACTIONS
 */

// --- Inline Messaging Editing ---
function setupEditOf(msgId) {
    const wrapper = document.getElementById(msgId);
    if (!wrapper) return;

    clearReplyContext(); // Edit and reply modes are mutually exclusive
    
    const textSpan = wrapper.querySelector('.bubble-content-span');
    AppState.editTargetMessage = {
        id: msgId,
        originalText: textSpan.textContent
    };

    messageInput.value = textSpan.textContent;
    editTargetText.textContent = textSpan.textContent;
    editContextOverlay.classList.remove('hidden');
    messageInput.focus();
}

function applyMessageEdit(editContext, newText) {
    const wrapper = document.getElementById(editContext.id);
    if (wrapper && newText) {
        const textSpan = wrapper.querySelector('.bubble-content-span');
        if (textSpan) {
            textSpan.textContent = newText;
            
            // Append visual tag indicating message has been modified
            if (!wrapper.querySelector('.edited-annotation-tag')) {
                const editedTag = document.createElement('span');
                editedTag.className = 'edited-annotation-tag';
                editedTag.textContent = ' (edited)';
                textSpan.appendChild(editedTag);
            }
        }
    }
}

function clearEditContext() {
    AppState.editTargetMessage = null;
    editContextOverlay.classList.add('hidden');
}

// --- Inline Replying ---
function setupReplyTo(msgId) {
    const wrapper = document.getElementById(msgId);
    if (!wrapper) return;

    clearEditContext();

    const textSpan = wrapper.querySelector('.bubble-content-span');
    const senderElement = wrapper.querySelector('.sender-name');
    const senderName = senderElement ? senderElement.textContent : 'Me';

    AppState.replyTargetMessage = {
        id: msgId,
        senderName: senderName,
        text: textSpan ? textSpan.textContent : 'Image'
    };

    replyTargetUser.textContent = senderName;
    replyTargetText.textContent = AppState.replyTargetMessage.text;
    replyContextOverlay.classList.remove('hidden');
    messageInput.focus();
}

function clearReplyContext() {
    AppState.replyTargetMessage = null;
    replyContextOverlay.classList.add('hidden');
}

// --- Pinning System Shelf ---
function pinMessage(msgId) {
    const wrapper = document.getElementById(msgId);
    if (!wrapper) return;

    const contentText = wrapper.querySelector('.bubble-content-span').textContent;
    pinnedContentPlaceholder.textContent = contentText;
    
    // Dynamic click to jump back to pinned item location
    pinnedContentPlaceholder.onclick = () => {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wrapper.classList.add('flash-highlight-active');
        setTimeout(() => wrapper.classList.remove('flash-highlight-active'), 1600);
    };

    pinnedShelf.classList.remove('hidden');
}

function closePinnedShelf() {
    pinnedShelf.classList.add('hidden');
}

// --- Manual Deletion Option ---
function deleteMessage(msgId) {
    const wrapper = document.getElementById(msgId);
    if (wrapper) {
        wrapper.remove();
    }
}

// --- Dynamic Emoji Reactions ---
window.addReactionToMessage = function(msgId, emoji) {
    const pillsRow = document.getElementById(`reactions-${msgId}`);
    if (!pillsRow) return;

    // Search for existing pill for this emoji inside the targeted message
    let existingPill = Array.from(pillsRow.children).find(pill => 
        pill.getAttribute('data-emoji') === emoji
    );

    if (existingPill) {
        // Toggle user reaction state and count modifiers
        const countSpan = existingPill.querySelector('.react-counter');
        let count = parseInt(countSpan.textContent, 10);
        
        if (existingPill.classList.contains('user-reacted')) {
            existingPill.classList.remove('user-reacted');
            count--;
        } else {
            existingPill.classList.add('user-reacted');
            count++;
        }

        if (count <= 0) {
            existingPill.remove();
        } else {
            countSpan.textContent = count;
        }
    } else {
        // Create new element pill capsule
        const newPill = document.createElement('button');
        newPill.className = 'emoji-pill-btn user-reacted';
        newPill.setAttribute('data-emoji', emoji);
        newPill.onclick = () => addReactionToMessage(msgId, emoji);
        newPill.innerHTML = `<span>${emoji}</span> <span class="react-counter">1</span>`;
        pillsRow.appendChild(newPill);
    }
};


/**
 * 6. ASYNC IMAGE ATTACHMENT AND LIGHTBOX MECHANICS
 */
function handleImageAttachment(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        AppState.attachedImageBase64 = event.target.result;
        imagePreview.src = event.target.result;
        imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearImageAttachment() {
    AppState.attachedImageBase64 = null;
    imageUploadInput.value = '';
    imagePreviewContainer.classList.add('hidden');
    imagePreview.src = '';
}

function openLightbox(imgSrc) {
    AppState.zoomScale = 1.0;
    zoomedImage.style.transform = 'scale(1.0)';
    zoomedImage.src = imgSrc;
    imageZoomModal.classList.remove('hidden');
}

function closeLightbox() {
    imageZoomModal.classList.add('hidden');
    zoomedImage.src = '';
}

function adjustZoom(factor) {
    AppState.zoomScale = Math.max(0.5, Math.min(AppState.zoomScale + factor, 3.0));
    zoomedImage.style.transform = `scale(${AppState.zoomScale})`;
}


/**
 * 7. INTERACTIVE ACCESSIBILITY SCALER
 */
function changeFontSize(delta) {
    AppState.currentFontSize = Math.max(12, Math.min(AppState.currentFontSize + delta, 24));
    document.documentElement.style.setProperty('--chat-font-size', `${AppState.currentFontSize}px`);
}


/**
 * 8. SMOOTH VIEWPORT CANVAS NAVIGATION
 */
function scrollToBottom() {
    chatHistory.scrollTo({
        top: chatHistory.scrollHeight,
        behavior: 'smooth'
    });
}

function toggleScrollBottomBtn() {
    const scrollPositionThreshold = chatHistory.scrollHeight - chatHistory.clientHeight - 200;
    if (chatHistory.scrollTop < scrollPositionThreshold) {
        scrollBottomBtn.style.display = 'flex';
    } else {
        scrollBottomBtn.style.display = 'none';
    }
}


/**
 * 9. SELF-CONTAINED LOCAL DEMO BUILD
 * Pre-populates clean static user nodes to demonstrate state resolution flawlessly.
 */
function setupDemoMockData() {
    // Adds pre-defined active users cleanly mapped by their Unique IDs
    updateActiveUserRegistry('usr_bob', 'Bob', '#10ac84');
    updateActiveUserRegistry('usr_jane', 'Jane', '#54a0ff');

    // Generate mock conversation history logs
    const mockMsgs = [
        {
            id: 'demo_1',
            senderId: 'usr_bob',
            senderName: 'Bob',
            senderColor: '#10ac84',
            text: "Hey! Welcome to the new mobile and laptop layouts.",
            image: null,
            timestamp: '01:22 PM'
        },
        {
            id: 'demo_2',
            senderId: 'usr_jane',
            senderName: 'Jane',
            senderColor: '#54a0ff',
            text: "Look! No search bar on top and zero annoying timer deletion scripts! Everything is clean.",
            image: null,
            timestamp: '01:23 PM'
        }
    ];

    mockMsgs.forEach(msg => appendMessageToDOM(msg, false));
    scrollToBottom();
}
