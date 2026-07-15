/**
 * Core Application State
 */
const AppState = {
    currentUser: {
        id: null, // Generated persistent ID
        name: 'Ace',
        color: '#ff6b6b'
    },
    // Registry structured as: { [userId]: { id, name, color, isOnline } }
    activeUsers: {},
    currentFontSize: 14,
    zoomScale: 1.0,
    replyTargetMessage: null,
    editTargetMessage: null,
    attachedImageBase64: null
};

// Defensive execution helper to safely handle potential missing elements
function safeBind(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, callback);
    }
}

function safeQueryAndBind(selector, event, callback) {
    const el = document.querySelector(selector);
    if (el) {
        el.addEventListener(event, callback);
    }
}

/**
 * 1. INITIALIZATION & IDENTITY PERSISTENCE
 */
window.addEventListener('DOMContentLoaded', () => {
    initUserIdentity();
    setupEventListeners();
    setupDemoMockData();
});

function initUserIdentity() {
    let storedId = localStorage.getItem('chat_user_id');
    if (!storedId) {
        storedId = 'usr_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chat_user_id', storedId);
    }
    AppState.currentUser.id = storedId;

    const storedName = localStorage.getItem('chat_username');
    const storedColor = localStorage.getItem('chat_color');

    const identityModal = document.getElementById('identityModal');
    
    if (storedName) {
        AppState.currentUser.name = storedName;
        AppState.currentUser.color = storedColor || '#ff6b6b';
        
        if (identityModal) {
            identityModal.classList.add('hidden-modal');
            identityModal.style.display = 'none'; // Fallback force hide
        }
        updateCurrentUserUI();
        syncUserSessionToNetwork();
    } else {
        if (identityModal) {
            identityModal.classList.remove('hidden-modal');
            identityModal.style.display = 'flex'; // Fallback force show
        }
    }
}

function updateCurrentUserUI() {
    const currentUserDisplay = document.getElementById('currentUserDisplay');
    if (currentUserDisplay) {
        currentUserDisplay.textContent = AppState.currentUser.name;
    }
    
    const selfCard = document.getElementById('userSelfCard');
    if (selfCard) {
        selfCard.style.borderLeft = `4px solid ${AppState.currentUser.color}`;
    }
}

/**
 * 2. RESOLVING NAME-CHANGE & DUPLICATION BUGS
 */
function updateActiveUserRegistry(userId, name, color, isOnline = true) {
    // Storing users using their explicit ID keys guarantees overwriting instead of duplicates!
    AppState.activeUsers[userId] = {
        id: userId,
        name: name,
        color: color,
        isOnline: isOnline
    };
    renderActiveUsersList();
}

function renderActiveUsersList() {
    const onlineUsersList = document.getElementById('onlineUsersList');
    if (!onlineUsersList) return;

    onlineUsersList.innerHTML = '';

    Object.values(AppState.activeUsers).forEach(user => {
        if (!user.isOnline) return;

        const userItem = document.createElement('div');
        userItem.className = 'online-user-item';
        userItem.setAttribute('data-user-id', user.id);

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

function syncUserSessionToNetwork() {
    updateActiveUserRegistry(
        AppState.currentUser.id,
        AppState.currentUser.name,
        AppState.currentUser.color,
        true
    );
}

/**
 * 3. EVENT LISTENERS MANAGEMENT (DEFENSIVELY BOUND)
 */
function setupEventListeners() {
    // --- Mobile Drawer Toggles ---
    safeBind('menuToggleBtn', 'click', (e) => {
        e.stopPropagation();
        const appSidebar = document.getElementById('appSidebar');
        if (appSidebar) appSidebar.classList.toggle('open');
    });

    safeBind('chatHistory', 'click', () => {
        const appSidebar = document.getElementById('appSidebar');
        if (appSidebar && appSidebar.classList.contains('open')) {
            appSidebar.classList.remove('open');
        }
    });

    // --- Profile Modal Actions ---
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('selected'));
            dot.classList.add('selected');
            AppState.currentUser.color = dot.getAttribute('data-color') || '#ff6b6b';
        });
    });

    // --- RE-OPEN PROFILE SETUP VIA CLICK ON SELF-CARD ---
    safeBind('userSelfCard', 'click', () => {
        const identityModal = document.getElementById('identityModal');
        const usernameInput = document.getElementById('usernameInput');
        if (identityModal && usernameInput) {
            usernameInput.value = AppState.currentUser.name;
            colorDots.forEach(dot => {
                if (dot.getAttribute('data-color') === AppState.currentUser.color) {
                    dot.classList.add('selected');
                } else {
                    dot.classList.remove('selected');
                }
            });
            identityModal.classList.remove('hidden-modal');
            identityModal.style.display = 'flex';
        }
    });

    // --- SAVE PROFILE & JOIN ---
    safeBind('saveIdentityBtn', 'click', () => {
        const usernameInput = document.getElementById('usernameInput');
        if (!usernameInput) return;

        const inputVal = usernameInput.value.trim();
        if (!inputVal) return; // Prevent joining with a blank name

        AppState.currentUser.name = inputVal;
        
        localStorage.setItem('chat_username', AppState.currentUser.name);
        localStorage.setItem('chat_color', AppState.currentUser.color);

        updateCurrentUserUI();
        syncUserSessionToNetwork();

        const identityModal = document.getElementById('identityModal');
        if (identityModal) {
            identityModal.classList.add('hidden-modal');
            identityModal.style.display = 'none'; // Fallback force hide
        }
    });

    // --- Font Controllers ---
    safeBind('incFontBtn', 'click', () => changeFontSize(2));
    safeBind('decFontBtn', 'click', () => changeFontSize(-2));

    // --- Clear Canvas ---
    safeBind('clearChatBtn', 'click', () => {
        const chatHistory = document.getElementById('chatHistory');
        if (chatHistory) chatHistory.innerHTML = '<div class="system-msg">Canvas cleared by user</div>';
        closePinnedShelf();
    });

    // --- Input & Media Submissions ---
    safeBind('imageUpload', 'change', handleImageAttachment);
    safeBind('cancelImage', 'click', clearImageAttachment);
    safeBind('sendBtn', 'click', handleSendMessage);

    const messageInput = document.getElementById('message');
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
    }

    // --- Dynamic Overlays & Lightbox ---
    safeBind('cancelReplyBtn', 'click', clearReplyContext);
    safeBind('cancelEditBtn', 'click', clearEditContext);
    safeBind('unpinShelfBtn', 'click', closePinnedShelf);
    safeBind('closeZoomBtn', 'click', closeLightbox);
    safeBind('zoomInBtn', 'click', () => adjustZoom(0.2));
    safeBind('zoomOutBtn', 'click', () => adjustZoom(-0.2));

    safeBind('imageZoomModal', 'click', (e) => {
        const imageZoomModal = document.getElementById('imageZoomModal');
        if (e.target === imageZoomModal) closeLightbox();
    });

    // --- Scrolling Engines ---
    const chatHistory = document.getElementById('chatHistory');
    if (chatHistory) {
        chatHistory.addEventListener('scroll', toggleScrollBottomBtn);
    }
    safeBind('scrollBottomBtn', 'click', scrollToBottom);
}

/**
 * 4. REAL-TIME CHAT ACTIONS & SEND ENGINE
 */
function handleSendMessage() {
    const messageInput = document.getElementById('message');
    if (!messageInput) return;

    const text = messageInput.value.trim();
    if (!text && !AppState.attachedImageBase64) return;

    if (AppState.editTargetMessage) {
        applyMessageEdit(AppState.editTargetMessage, text);
    } else {
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

        appendMessageToDOM(messageObj);
    }

    messageInput.value = '';
    clearImageAttachment();
    clearReplyContext();
    clearEditContext();
    scrollToBottom();
}

function appendMessageToDOM(msg) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return;

    const isMe = msg.senderId === AppState.currentUser.id;
    
    const wrapper = document.createElement('div');
    wrapper.id = msg.id;
    wrapper.className = `message-wrapper ${isMe ? 'me' : 'them'}`;
    wrapper.setAttribute('data-text', msg.text || '');

    const metaMarkup = isMe ? '' : `
        <div class="message-meta">
            <div class="user-avatar-circle" style="background-color: ${msg.senderColor}">
                ${msg.senderName.charAt(0).toUpperCase()}
            </div>
            <span class="sender-name">${msg.senderName}</span>
        </div>
    `;

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

    let imageMarkup = '';
    if (msg.image) {
        imageMarkup = `<img src="${msg.image}" class="chat-img" alt="Uploaded Attachment">`;
    }

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

    const appendedImg = wrapper.querySelector('.chat-img');
    if (appendedImg) {
        appendedImg.addEventListener('click', () => openLightbox(msg.image));
    }

    chatHistory.appendChild(wrapper);
}

/**
 * 5. INTERACTIVE FEATURE ACTIONS
 */
function setupEditOf(msgId) {
    const wrapper = document.getElementById(msgId);
    if (!wrapper) return;

    clearReplyContext();
    
    const textSpan = wrapper.querySelector('.bubble-content-span');
    AppState.editTargetMessage = {
        id: msgId,
        originalText: textSpan ? textSpan.textContent : ''
    };

    const messageInput = document.getElementById('message');
    const editTargetText = document.getElementById('editTargetText');
    const editContextOverlay = document.getElementById('editContextOverlay');

    if (messageInput) messageInput.value = AppState.editTargetMessage.originalText;
    if (editTargetText) editTargetText.textContent = AppState.editTargetMessage.originalText;
    if (editContextOverlay) editContextOverlay.classList.remove('hidden');
    if (messageInput) messageInput.focus();
}

function applyMessageEdit(editContext, newText) {
    const wrapper = document.getElementById(editContext.id);
    if (wrapper && newText) {
        const textSpan = wrapper.querySelector('.bubble-content-span');
        if (textSpan) {
            textSpan.textContent = newText;
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
    const editContextOverlay = document.getElementById('editContextOverlay');
    if (editContextOverlay) editContextOverlay.classList.add('hidden');
}

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

    const replyTargetUser = document.getElementById('replyTargetUser');
    const replyTargetText = document.getElementById('replyTargetText');
    const replyContextOverlay = document.getElementById('replyContextOverlay');
    const messageInput = document.getElementById('message');

    if (replyTargetUser) replyTargetUser.textContent = senderName;
    if (replyTargetText) replyTargetText.textContent = AppState.replyTargetMessage.text;
    if (replyContextOverlay) replyContextOverlay.classList.remove('hidden');
    if (messageInput) messageInput.focus();
}

function clearReplyContext() {
    AppState.replyTargetMessage = null;
    const replyContextOverlay = document.getElementById('replyContextOverlay');
    if (replyContextOverlay) replyContextOverlay.classList.add('hidden');
}

function pinMessage(msgId) {
    const wrapper = document.getElementById(msgId);
    if (!wrapper) return;

    const textSpan = wrapper.querySelector('.bubble-content-span');
    const contentText = textSpan ? textSpan.textContent : 'Image';
    
    const pinnedContentPlaceholder = document.getElementById('pinnedContentPlaceholder');
    const pinnedShelf = document.getElementById('pinnedShelf');

    if (pinnedContentPlaceholder) {
        pinnedContentPlaceholder.textContent = contentText;
        pinnedContentPlaceholder.onclick = () => {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
    }
    if (pinnedShelf) pinnedShelf.classList.remove('hidden');
}

function closePinnedShelf() {
    const pinnedShelf = document.getElementById('pinnedShelf');
    if (pinnedShelf) pinnedShelf.classList.add('hidden');
}

function deleteMessage(msgId) {
    const wrapper = document.getElementById(msgId);
    if (wrapper) wrapper.remove();
}

window.addReactionToMessage = function(msgId, emoji) {
    const pillsRow = document.getElementById(`reactions-${msgId}`);
    if (!pillsRow) return;

    let existingPill = Array.from(pillsRow.children).find(pill => 
        pill.getAttribute('data-emoji') === emoji
    );

    if (existingPill) {
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
        const newPill = document.createElement('button');
        newPill.className = 'emoji-pill-btn user-reacted';
        newPill.setAttribute('data-emoji', emoji);
        newPill.onclick = () => addReactionToMessage(msgId, emoji);
        newPill.innerHTML = `<span>${emoji}</span> <span class="react-counter">1</span>`;
        pillsRow.appendChild(newPill);
    }
};

/**
 * 6. MEDIA ATTACHMENTS & LIGHTBOXES
 */
function handleImageAttachment(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        AppState.attachedImageBase64 = event.target.result;
        
        const imagePreview = document.getElementById('imagePreview');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        
        if (imagePreview) imagePreview.src = event.target.result;
        if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearImageAttachment() {
    AppState.attachedImageBase64 = null;
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

    if (imageUpload) imageUpload.value = '';
    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
    if (imagePreview) imagePreview.src = '';
}

function openLightbox(imgSrc) {
    AppState.zoomScale = 1.0;
    
    const zoomedImage = document.getElementById('zoomedImage');
    const imageZoomModal = document.getElementById('imageZoomModal');

    if (zoomedImage) {
        zoomedImage.style.transform = 'scale(1.0)';
        zoomedImage.src = imgSrc;
    }
    if (imageZoomModal) imageZoomModal.classList.remove('hidden');
}

function closeLightbox() {
    const imageZoomModal = document.getElementById('imageZoomModal');
    const zoomedImage = document.getElementById('zoomedImage');

    if (imageZoomModal) imageZoomModal.classList.add('hidden');
    if (zoomedImage) zoomedImage.src = '';
}

function adjustZoom(factor) {
    AppState.zoomScale = Math.max(0.5, Math.min(AppState.zoomScale + factor, 3.0));
    const zoomedImage = document.getElementById('zoomedImage');
    if (zoomedImage) {
        zoomedImage.style.transform = `scale(${AppState.zoomScale})`;
    }
}

/**
 * 7. UTILITIES
 */
function changeFontSize(delta) {
    AppState.currentFontSize = Math.max(12, Math.min(AppState.currentFontSize + delta, 24));
    document.documentElement.style.setProperty('--chat-font-size', `${AppState.currentFontSize}px`);
}

function scrollToBottom() {
    const chatHistory = document.getElementById('chatHistory');
    if (chatHistory) {
        chatHistory.scrollTo({
            top: chatHistory.scrollHeight,
            behavior: 'smooth'
        });
    }
}

function toggleScrollBottomBtn() {
    const chatHistory = document.getElementById('chatHistory');
    const scrollBottomBtn = document.getElementById('scrollBottomBtn');
    if (!chatHistory || !scrollBottomBtn) return;

    const threshold = chatHistory.scrollHeight - chatHistory.clientHeight - 200;
    if (chatHistory.scrollTop < threshold) {
        scrollBottomBtn.style.display = 'flex';
    } else {
        scrollBottomBtn.style.display = 'none';
    }
}

function setupDemoMockData() {
    updateActiveUserRegistry('usr_bob', 'Bob', '#10ac84');
    updateActiveUserRegistry('usr_jane', 'Jane', '#54a0ff');

    const mockMsgs = [
        {
            id: 'demo_1',
            senderId: 'usr_bob',
            senderName: 'Bob',
            senderColor: '#10ac84',
            text: "Hey! Welcome back. Give that username form a spin!",
            image: null,
            timestamp: '01:22 PM'
        }
    ];

    mockMsgs.forEach(msg => appendMessageToDOM(msg));
    scrollToBottom();
}
