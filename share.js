let chatHistory = [];
let incomingFileBuffers = new Map(); // { bufferKey: { meta, chunks, receivedBytes } }

let wbCtx, wbIsDrawing = false, wbLastX, wbLastY;
let currentWbTool = 'pen';
let wbShapeStartX, wbShapeStartY;
let whiteboardHistory = [];
let wbZoomLevel = 1.0;
let wbPanX = 0;
let wbPanY = 0;
const WB_MIN_ZOOM = 0.2;
const WB_MAX_ZOOM = 5.0;
const WB_ZOOM_STEP = 0.2;

let kanbanData = { columns: [] };
let draggedCardElement = null;
let draggedCardData = null;
let kanbanCurrentlyAddingCardToColumnId = null; // For new add card UI

let documents = [];
let currentActiveDocumentId = null;

let channels = []; // For chat channels
let currentActiveChannelId = null; // ID of the active channel

// --- Dependencies from main.js (will be set in initShareFeatures) ---
let sendChatMessageDep, sendPrivateMessageDep, sendFileMetaDep, sendFileChunkDep;
let sendDrawCommandDep, sendInitialWhiteboardDep, sendKanbanUpdateDep, sendInitialKanbanDep;
let sendChatHistoryDep, sendInitialDocumentsDep, sendCreateDocumentDep, sendRenameDocumentDep;
let sendDeleteDocumentDep, sendDocumentContentUpdateDep;
let sendCreateChannelDep, onCreateChannelDep;
let sendInitialChannelsDep, onInitialChannelsDep;


let logStatusDep, showNotificationDep;
let localGeneratedPeerIdDep;
let getPeerNicknamesDep, getIsHostDep, getLocalNicknameDep, findPeerIdByNicknameDepFnc;
let currentRoomIdDep;

// --- DOM Elements (selected within this module) ---
let chatArea, messageInput, sendMessageBtn, emojiIcon, emojiPickerPopup, triggerFileInput, chatFileInput;
let channelListDiv, newChannelNameInput, addChannelBtn; // For channels

let whiteboardCanvas, wbColorPicker, wbLineWidth, wbClearBtn, wbLineWidthValue, wbToolPalette, wbZoomOutBtn, wbZoomLevelDisplay, wbZoomInBtn;
let kanbanBoard, newColumnNameInput, addColumnBtn;
let documentsSection, documentListDiv, newDocBtn, renameDocBtn, deleteDocBtn, collaborativeEditor;
let docBoldBtn, docItalicBtn, docUnderlineBtn, docUlBtn, docOlBtn, downloadTxtBtn;


function selectShareDomElements() {
    chatArea = document.getElementById('chatArea');
    messageInput = document.getElementById('messageInput');
    sendMessageBtn = document.getElementById('sendMessageBtn');
    emojiIcon = document.querySelector('.emoji-icon');
    emojiPickerPopup = document.getElementById('emojiPickerPopup');
    triggerFileInput = document.getElementById('triggerFileInput');
    chatFileInput = document.getElementById('chatFileInput');

    // For channels
    channelListDiv = document.getElementById('channelList');
    newChannelNameInput = document.getElementById('newChannelNameInput');
    addChannelBtn = document.getElementById('addChannelBtn');

    whiteboardCanvas = document.getElementById('whiteboardCanvas');
    wbColorPicker = document.getElementById('wbColorPicker');
    wbLineWidth = document.getElementById('wbLineWidth');
    wbClearBtn = document.getElementById('wbClearBtn');
    wbLineWidthValue = document.getElementById('wbLineWidthValue');
    wbToolPalette = document.querySelector('.wb-tool-palette');
    wbZoomOutBtn = document.getElementById('wbZoomOutBtn');
    wbZoomLevelDisplay = document.getElementById('wbZoomLevelDisplay');
    wbZoomInBtn = document.getElementById('wbZoomInBtn');
    
    kanbanBoard = document.getElementById('kanbanBoard');
    newColumnNameInput = document.getElementById('newColumnNameInput');
    addColumnBtn = document.getElementById('addColumnBtn');

    documentsSection = document.getElementById('documentsSection');
    documentListDiv = document.getElementById('documentList');
    newDocBtn = document.getElementById('newDocBtn');
    renameDocBtn = document.getElementById('renameDocBtn');
    deleteDocBtn = document.getElementById('deleteDocBtn');
    collaborativeEditor = document.getElementById('collaborativeEditor');
    docBoldBtn = document.getElementById('docBoldBtn');
    docItalicBtn = document.getElementById('docItalicBtn');
    docUnderlineBtn = document.getElementById('docUnderlineBtn');
    docUlBtn = document.getElementById('docUlBtn');
    docOlBtn = document.getElementById('docOlBtn');
    downloadTxtBtn = document.getElementById('downloadTxtBtn');
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

export function initShareFeatures(dependencies) {
    selectShareDomElements();

    sendChatMessageDep = dependencies.sendChatMessage;
    sendPrivateMessageDep = dependencies.sendPrivateMessage;
    sendFileMetaDep = dependencies.sendFileMeta;
    sendFileChunkDep = dependencies.sendFileChunk;
    sendDrawCommandDep = dependencies.sendDrawCommand;
    sendInitialWhiteboardDep = dependencies.sendInitialWhiteboard;
    sendKanbanUpdateDep = dependencies.sendKanbanUpdate;
    sendInitialKanbanDep = dependencies.sendInitialKanban;
    sendChatHistoryDep = dependencies.sendChatHistory;
    sendInitialDocumentsDep = dependencies.sendInitialDocuments;
    sendCreateDocumentDep = dependencies.sendCreateDocument;
    sendRenameDocumentDep = dependencies.sendRenameDocument;
    sendDeleteDocumentDep = dependencies.sendDeleteDocument;
    sendDocumentContentUpdateDep = dependencies.sendDocumentContentUpdate;
    sendCreateChannelDep = dependencies.sendCreateChannel;
    onCreateChannelDep = dependencies.onCreateChannel;
    sendInitialChannelsDep = dependencies.sendInitialChannels;
    onInitialChannelsDep = dependencies.onInitialChannels;


    logStatusDep = dependencies.logStatus;
    showNotificationDep = dependencies.showNotification;
    localGeneratedPeerIdDep = dependencies.localGeneratedPeerId;
    getPeerNicknamesDep = dependencies.getPeerNicknames;
    getIsHostDep = dependencies.getIsHost;
    getLocalNicknameDep = dependencies.getLocalNickname;
    findPeerIdByNicknameDepFnc = dependencies.findPeerIdByNicknameFnc;
    currentRoomIdDep = dependencies.currentRoomId;

    initChat();
    initWhiteboardInternal();
    initKanbanInternal();
    initDocumentsModuleInternal();
    
    const importedState = dependencies.getImportedWorkspaceState();
    if (importedState && getIsHostDep && getIsHostDep()) {
        loadChatHistoryFromImport(importedState.chatHistory || []);
        if (importedState.channels) {
            channels = importedState.channels;
            currentActiveChannelId = importedState.currentActiveChannelIdForImport || (channels.length > 0 ? channels[0].id : null);
        }
        loadWhiteboardHistoryFromImport(importedState.whiteboardHistory || []);
        loadKanbanDataFromImport(importedState.kanbanData || { columns: [] });
        loadDocumentsFromImport(importedState.documents || [], importedState.currentActiveDocumentId);
        if(dependencies.clearImportedWorkspaceState) dependencies.clearImportedWorkspaceState();
    }
    
    if (getIsHostDep && getIsHostDep() && channels.length === 0) {
        _createAndBroadcastChannel("#general", true);
    } else if (channels.length > 0 && !currentActiveChannelId) {
        setActiveChannel(channels[0].id, false);
    }


    renderChannelList();
    displayChatForCurrentChannel();

    return { 
        handleChatMessage, handlePrivateMessage, handleFileMeta, handleFileChunk,
        handleDrawCommand, handleInitialWhiteboard, handleKanbanUpdate, handleInitialKanban,
        handleChatHistory, 
        handleInitialDocuments, handleCreateDocument, handleRenameDocument, handleDeleteDocument, handleDocumentContentUpdate,
        sendFullStateToPeer,
        displaySystemMessage,
        updateChatMessageInputPlaceholder,
        primePrivateMessage,
        hideEmojiPicker,
        initializeEmojiPicker,
        redrawWhiteboardFromHistoryIfVisible,
        resizeWhiteboardAndRedraw,
        renderKanbanBoardIfActive,
        renderDocumentsIfActive,
        ensureDefaultDocument,
        setShareModulePeerInfo,
        handleCreateChannel, handleInitialChannels, 
    };
}

export function setShareModulePeerInfo(peerNicknames) {
    // Placeholder
}

export function handleShareModulePeerLeave(peerId) {
    const keysToDelete = [];
    for (const [key, value] of incomingFileBuffers.entries()) {
        if (key.startsWith(`${peerId}_`)) {
            const peerNickname = (getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : peerId.substring(0,6);
            if(logStatusDep) logStatusDep(`File transfer for ${value.meta.name} from departing peer ${peerNickname} cancelled.`);
            
            const safeSenderNickname = peerNickname.replace(/\W/g, '');
            const safeFileName = value.meta.name.replace(/\W/g, '');
            const progressId = `file-progress-${safeSenderNickname}-${safeFileName}`;
            const progressElem = document.getElementById(progressId);
            if (progressElem) progressElem.textContent = ` (Cancelled)`;
            keysToDelete.push(key);
        }
    }
    keysToDelete.forEach(key => incomingFileBuffers.delete(key));
}


// --- Chat Feature ---
function initChat() {
    if (!sendMessageBtn || !messageInput || !triggerFileInput || !chatFileInput || !emojiIcon || !emojiPickerPopup) return;
    if (!addChannelBtn || !newChannelNameInput || !channelListDiv) return; // Check channel elements

    sendMessageBtn.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendMessage(); });

    triggerFileInput.addEventListener('click', () => chatFileInput.click());
    chatFileInput.addEventListener('change', handleChatFileSelected);

    emojiIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        const isHidden = emojiPickerPopup.classList.toggle('hidden');
        if (!isHidden && emojiPickerPopup.children.length === 0) {
            populateEmojiPicker();
        }
        messageInput.focus();
    });
    document.addEventListener('click', (event) => {
        if (emojiPickerPopup && !emojiPickerPopup.classList.contains('hidden') && !emojiPickerPopup.contains(event.target) && event.target !== emojiIcon) {
            emojiPickerPopup.classList.add('hidden');
        }
    });
    // Channel creation
    addChannelBtn.addEventListener('click', handleAddChannelUI);
}

export function initializeEmojiPicker() {
    if(emojiPickerPopup && emojiPickerPopup.children.length === 0) populateEmojiPicker();
}

function populateEmojiPicker() {
    if (!emojiPickerPopup) return;
    emojiPickerPopup.innerHTML = '';
    const emojis = ['😊', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '👋', '✅', '🤔', '😢', '😮', '😭', '😍', '💯', '🌟', '✨', '🎁', '🎈', '🎂', '🍕', '🚀', '💡', '🤷', '🤦'];
    emojis.forEach(emoji => {
        const emojiSpan = document.createElement('span');
        emojiSpan.textContent = emoji;
        emojiSpan.setAttribute('role', 'button');
        emojiSpan.title = `Insert ${emoji}`;
        emojiSpan.addEventListener('click', () => {
            insertEmojiIntoInput(emoji);
            emojiPickerPopup.classList.add('hidden');
        });
        emojiPickerPopup.appendChild(emojiSpan);
    });
}

function insertEmojiIntoInput(emoji) {
    if (!messageInput) return;
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();
    const newCursorPos = cursorPos + emoji.length;
    messageInput.setSelectionRange(newCursorPos, newCursorPos);
}

export function hideEmojiPicker() {
    if(emojiPickerPopup) emojiPickerPopup.classList.add('hidden');
}

function _createAndBroadcastChannel(channelName, isDefault = false) {
    if (!channelName || !channelName.trim()) return null;
    let saneChannelName = channelName.trim();
    if (!saneChannelName.startsWith('#')) {
        saneChannelName = '#' + saneChannelName;
    }
    saneChannelName = saneChannelName.replace(/\s+/g, '-').toLowerCase(); // Basic sanitization

    if (channels.find(ch => ch.name === saneChannelName)) {
        if(logStatusDep && !isDefault) logStatusDep(`Channel "${saneChannelName}" already exists.`, true);
        return null;
    }

    const newChannel = { id: `ch-${Date.now()}-${Math.random().toString(36).substring(2,5)}`, name: saneChannelName };
    channels.push(newChannel);
    
    if (sendCreateChannelDep) {
        sendCreateChannelDep(newChannel); // Broadcast to others
    }
    if (isDefault || channels.length === 1) { // Auto-activate if it's the first/default
        setActiveChannel(newChannel.id, false);
    }
    renderChannelList();
    return newChannel;
}


function handleAddChannelUI() {
    if (!newChannelNameInput) return;
    const channelName = newChannelNameInput.value;
    const createdChannel = _createAndBroadcastChannel(channelName);
    if (createdChannel) {
        newChannelNameInput.value = '';
        if(logStatusDep) logStatusDep(`Channel "${createdChannel.name}" created.`);
    }
}

function renderChannelList() {
    if (!channelListDiv) return;
    channelListDiv.innerHTML = '';
    channels.forEach(channel => {
        const channelItem = document.createElement('div');
        channelItem.classList.add('channel-list-item');
        channelItem.textContent = channel.name;
        channelItem.dataset.channelId = channel.id;
        if (channel.id === currentActiveChannelId) {
            channelItem.classList.add('active');
        }
        channelItem.addEventListener('click', () => setActiveChannel(channel.id));

        const notifDot = document.createElement('span');
        notifDot.classList.add('channel-notification-dot', 'hidden'); // Hidden by default
        channelItem.appendChild(notifDot);

        channelListDiv.appendChild(channelItem);
    });
}

function setActiveChannel(channelId, clearNotifications = true) {
    if (currentActiveChannelId === channelId && !clearNotifications) {
        renderChannelList(); 
        return;
    }
    currentActiveChannelId = channelId;
    renderChannelList(); 
    displayChatForCurrentChannel();

    if (clearNotifications && channelListDiv) { 
        const channelDot = channelListDiv.querySelector(`.channel-list-item[data-channel-id="${channelId}"] .channel-notification-dot`);
        if (channelDot) {
            channelDot.classList.add('hidden');
        }
    }
    if(messageInput) {
        const activeChannel = channels.find(c=>c.id === channelId);
        messageInput.placeholder = `Message ${activeChannel?.name || (currentRoomIdDep || '')}`;
    }
}

function displayChatForCurrentChannel() {
    if (!chatArea) return;
    chatArea.innerHTML = '';
    if (!currentActiveChannelId) {
        return;
    }
    const messagesForChannel = chatHistory.filter(msg => msg.channelId === currentActiveChannelId || msg.pmInfo || msg.fileMeta || msg.isSystem); // Also show global messages
    messagesForChannel.forEach(msg => {
        if ( (msg.channelId && msg.channelId === currentActiveChannelId) || msg.pmInfo || msg.fileMeta || msg.isSystem ) {
            displayMessage(msg, msg.senderPeerId === localGeneratedPeerIdDep, msg.isSystem);
        }
    });
    chatArea.scrollTop = chatArea.scrollHeight;
}


function displayMessage(msgObject, isSelf = false, isSystem = false) {
    if (!chatArea) return;
    const { senderNickname, message, pmInfo, fileMeta, timestamp } = msgObject;
    const messageDiv = document.createElement('div'); messageDiv.classList.add('message');
    const displayTimestamp = timestamp ? new Date(timestamp) : new Date();
    const hours = String(displayTimestamp.getHours()).padStart(2, '0');
    const minutes = String(displayTimestamp.getMinutes()).padStart(2, '0');
    const timestampStr = `${hours}:${minutes}`;
    const timestampSpan = document.createElement('span'); timestampSpan.classList.add('timestamp'); timestampSpan.textContent = timestampStr;

    if (isSystem) {
        messageDiv.classList.add('system-message');
        messageDiv.appendChild(document.createTextNode(message + " "));
    } else if (pmInfo) {
        messageDiv.classList.add('pm');
        messageDiv.classList.add(isSelf ? 'self' : 'other');
        const pmContextSpan = document.createElement('span');
        pmContextSpan.classList.add('pm-info');
        pmContextSpan.textContent = pmInfo.type === 'sent' ? `To ${pmInfo.recipient}:` : `From ${pmInfo.sender}:`;
        messageDiv.appendChild(pmContextSpan);
        messageDiv.appendChild(document.createTextNode(message + " "));
    } else if (fileMeta) {
        messageDiv.classList.add(isSelf ? 'self' : 'other');
        messageDiv.classList.add('file-message');
        const senderSpan = document.createElement('span'); senderSpan.classList.add('sender');
        senderSpan.textContent = isSelf ? 'You' : senderNickname;
        messageDiv.appendChild(senderSpan);
        const fileInfoSpan = document.createElement('span');
        fileInfoSpan.innerHTML = `Shared a file: <strong>${fileMeta.name}</strong> (${(fileMeta.size / 1024).toFixed(2)} KB) `;
        messageDiv.appendChild(fileInfoSpan);
        if (fileMeta.blobUrl) {
            const downloadLink = document.createElement('a');
            downloadLink.href = fileMeta.blobUrl;
            downloadLink.download = fileMeta.name;
            downloadLink.textContent = 'Download';
            messageDiv.appendChild(downloadLink);
        } else if (fileMeta.receiving) {
            const progressSpan = document.createElement('span');
            const safeSenderNickname = senderNickname ? senderNickname.replace(/\W/g, '') : 'unknownsender';
            const safeFileName = fileMeta.name ? fileMeta.name.replace(/\W/g, '') : 'unknownfile';
            progressSpan.id = `file-progress-${safeSenderNickname}-${safeFileName}`;
            progressSpan.textContent = ` (Receiving 0%)`;
            messageDiv.appendChild(progressSpan);
        }
    } else { // Regular channel message
        messageDiv.classList.add(isSelf ? 'self' : 'other');
        const senderSpan = document.createElement('span'); senderSpan.classList.add('sender');
        senderSpan.textContent = isSelf ? 'You' : senderNickname;
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(document.createTextNode(message + " "));
    }

    messageDiv.appendChild(timestampSpan);
    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function addMessageToHistoryAndDisplay(msgData, isSelf = false, isSystem = false) {
    let channelIdForMsg = msgData.channelId;
    if (isSelf && !isSystem && !msgData.pmInfo && !msgData.fileMeta && !channelIdForMsg) {
        channelIdForMsg = currentActiveChannelId;
    }

    const fullMsgObject = {
        ...msgData,
        channelId: channelIdForMsg,
        timestamp: msgData.timestamp || Date.now(),
        senderPeerId: isSelf ? localGeneratedPeerIdDep : msgData.senderPeerId
    };
    chatHistory.push(fullMsgObject);

    if ( (fullMsgObject.channelId && fullMsgObject.channelId === currentActiveChannelId) || isSystem || fullMsgObject.pmInfo || fullMsgObject.fileMeta) {
        displayMessage(fullMsgObject, isSelf, isSystem);
    }
}

function handleSendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText || !sendChatMessageDep) return;
    const timestamp = Date.now();
    const localCurrentNickname = getLocalNicknameDep ? getLocalNicknameDep() : 'You';

    if (messageText.toLowerCase().startsWith('/pm ')) {
         const parts = messageText.substring(4).split(' ');
        const targetNickname = parts.shift();
        const pmContent = parts.join(' ').trim();
        if (!targetNickname || !pmContent) {
            addMessageToHistoryAndDisplay({ message: "Usage: /pm <nickname> <message>", timestamp }, false, true); return;
        }
        if (targetNickname.toLowerCase() === localCurrentNickname.toLowerCase()) {
            addMessageToHistoryAndDisplay({ message: "You can't PM yourself.", timestamp }, false, true); return;
        }
        const targetPeerId = findPeerIdByNicknameDepFnc ? findPeerIdByNicknameDepFnc(targetNickname) : null;
        if (targetPeerId && sendPrivateMessageDep) {
            sendPrivateMessageDep({ content: pmContent, timestamp }, targetPeerId);
            addMessageToHistoryAndDisplay({ senderNickname: localCurrentNickname, message: pmContent, pmInfo: { type: 'sent', recipient: targetNickname }, timestamp }, true);
        } else {
            addMessageToHistoryAndDisplay({ message: `User "${targetNickname}" not found or PM failed.`, timestamp }, false, true);
        }
    } else { // Regular channel message
        if (!currentActiveChannelId) {
            addMessageToHistoryAndDisplay({ message: "Please select a channel to send a message.", timestamp }, false, true);
            return;
        }
        const msgData = { message: messageText, timestamp, channelId: currentActiveChannelId };
        sendChatMessageDep(msgData);
        addMessageToHistoryAndDisplay({ senderNickname: localCurrentNickname, ...msgData }, true);
    }
    messageInput.value = '';
    if (emojiPickerPopup && !emojiPickerPopup.classList.contains('hidden')) emojiPickerPopup.classList.add('hidden');
}

async function handleChatFileSelected(event) {
    const file = event.target.files[0];
    if (!file || !sendFileMetaDep || !sendFileChunkDep) return;
    const localCurrentNickname = getLocalNicknameDep ? getLocalNicknameDep() : 'You';

    if(logStatusDep) logStatusDep(`Preparing to send file: ${file.name}`);
    const fileMeta = { name: file.name, type: file.type, size: file.size, id: Date.now().toString() };
    
    addMessageToHistoryAndDisplay({ senderNickname: localCurrentNickname, fileMeta: { ...fileMeta, receiving: true } }, true);
    
    sendFileMetaDep(fileMeta); 

    const CHUNK_SIZE = 16 * 1024;
    let offset = 0;
    const reader = new FileReader();

    reader.onload = (e) => {
        const chunkData = e.target.result;
        const isFinal = (offset + chunkData.byteLength) >= file.size;
        sendFileChunkDep(chunkData, null, { fileName: fileMeta.name, fileId: fileMeta.id, final: isFinal });
        
        const safeLocalNickname = localCurrentNickname.replace(/\W/g, '');
        const safeFileName = fileMeta.name.replace(/\W/g, '');
        const progressId = `file-progress-${safeLocalNickname}-${safeFileName}`;

        const progressElem = document.getElementById(progressId);
        if (progressElem) {
            progressElem.textContent = ` (Sending ${Math.min(100, Math.round(((offset + chunkData.byteLength) / file.size) * 100))}%)`;
        }

        if (!isFinal) {
            offset += chunkData.byteLength;
            readNextChunk();
        } else {
            if(logStatusDep) logStatusDep(`File ${file.name} sent.`);
            if (progressElem) progressElem.textContent = ` (Sent 100%)`;
        }
    };
    reader.onerror = (error) => {
        if(logStatusDep) logStatusDep(`Error reading file: ${error}`, true);
        const safeLocalNickname = localCurrentNickname.replace(/\W/g, '');
        const safeFileName = fileMeta.name.replace(/\W/g, '');
        const progressId = `file-progress-${safeLocalNickname}-${safeFileName}`;
        const progressElem = document.getElementById(progressId);
        if (progressElem) progressElem.textContent = ` (Error sending)`;
    };
    function readNextChunk() {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
    }
    readNextChunk();
    chatFileInput.value = '';
}

export function handleChatMessage(msgData, peerId) {
    const senderNickname = (getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : `Peer ${peerId.substring(0, 6)}`;
    const fullMsgObject = { ...msgData, senderNickname, senderPeerId: peerId, timestamp: msgData.timestamp || Date.now() };
    
    chatHistory.push(fullMsgObject);

    if (fullMsgObject.channelId === currentActiveChannelId) {
        displayMessage(fullMsgObject, false);
    } else if (fullMsgObject.channelId && channelListDiv) { 
        const channelDot = channelListDiv.querySelector(`.channel-list-item[data-channel-id="${fullMsgObject.channelId}"] .channel-notification-dot`);
        if (channelDot) {
            channelDot.classList.remove('hidden');
        }
    }
    if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('chatSection');
}
export function handlePrivateMessage(pmData, senderPeerId) {
    const sender = (getPeerNicknamesDep && getPeerNicknamesDep()[senderPeerId]) ? getPeerNicknamesDep()[senderPeerId] : `Peer ${senderPeerId.substring(0, 6)}`;
    addMessageToHistoryAndDisplay({ senderNickname: sender, message: pmData.content, pmInfo: { type: 'received', sender: sender }, senderPeerId: senderPeerId, timestamp: pmData.timestamp || Date.now() }, false);
    if (senderPeerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('chatSection'); 
}
export function handleFileMeta(meta, peerId) {
    const senderNickname = (getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : `Peer ${peerId.substring(0, 6)}`;
    const bufferKey = `${peerId}_${meta.id}`;
    incomingFileBuffers.set(bufferKey, { meta, chunks: [], receivedBytes: 0 });
    addMessageToHistoryAndDisplay({ senderNickname, fileMeta: { ...meta, receiving: true }, senderPeerId: peerId, timestamp: Date.now() }, false);
    if(logStatusDep) logStatusDep(`${senderNickname} is sending file: ${meta.name}`);
    if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('chatSection');
}
export function handleFileChunk(chunk, peerId, chunkMeta) {
    const senderNickname = (getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : `Peer ${peerId.substring(0, 6)}`;
    const bufferKey = `${peerId}_${chunkMeta.fileId}`;
    const fileBuffer = incomingFileBuffers.get(bufferKey);

    if (fileBuffer) {
        fileBuffer.chunks.push(chunk);
        fileBuffer.receivedBytes += chunk.byteLength;
        const progress = Math.round((fileBuffer.receivedBytes / fileBuffer.meta.size) * 100);

        const safeSenderNickname = senderNickname.replace(/\W/g, '');
        const safeFileName = fileBuffer.meta.name.replace(/\W/g, '');
        const progressId = `file-progress-${safeSenderNickname}-${safeFileName}`;
        const progressElem = document.getElementById(progressId);
        if (progressElem) progressElem.textContent = ` (Receiving ${progress}%)`;

        if (chunkMeta.final || fileBuffer.receivedBytes >= fileBuffer.meta.size) {
            const completeFile = new Blob(fileBuffer.chunks, { type: fileBuffer.meta.type });
            const blobUrl = URL.createObjectURL(completeFile);

            if (chatArea) {
                chatArea.querySelectorAll('.message.other.file-message').forEach(msgDiv => {
                    const senderSpan = msgDiv.querySelector('.sender');
                    const fileInfoStrong = msgDiv.querySelector('strong');
                    if (senderSpan && senderSpan.textContent === senderNickname && fileInfoStrong && fileInfoStrong.textContent === fileBuffer.meta.name) {
                        const existingProgress = msgDiv.querySelector(`#${progressId}`);
                        if (existingProgress) existingProgress.remove();
                        let downloadLink = msgDiv.querySelector('a');
                        if (!downloadLink) {
                            downloadLink = document.createElement('a');
                            msgDiv.appendChild(document.createTextNode(" "));
                            msgDiv.appendChild(downloadLink);
                        }
                        downloadLink.href = blobUrl;
                        downloadLink.download = fileBuffer.meta.name;
                        downloadLink.textContent = 'Download';
                    }
                });
            }
            if(logStatusDep) logStatusDep(`File ${fileBuffer.meta.name} from ${senderNickname} received.`);
            incomingFileBuffers.delete(bufferKey);
        }
    } else {
        console.warn(`Received chunk for unknown file: ${chunkMeta.fileName} from ${senderNickname}`);
    }
}
export function handleChatHistory(history, peerId) {
    if (getIsHostDep && !getIsHostDep()) {
        chatHistory = history;
        if (currentActiveChannelId) {
            displayChatForCurrentChannel();
        }
        if(logStatusDep) logStatusDep(`Received chat history from ${(getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'host'}.`);
    }
}
export function updateChatMessageInputPlaceholder(roomId) {
    // This is now handled by setActiveChannel
}
export function primePrivateMessage(nickname) {
    if (messageInput) {
        messageInput.value = `/pm ${nickname} `;
        messageInput.focus();
    }
}

export function handleCreateChannel(newChannelData, peerId) {
    if (!channels.find(ch => ch.id === newChannelData.id)) {
        channels.push(newChannelData);
        renderChannelList();
        if (peerId !== localGeneratedPeerIdDep && logStatusDep) {
            const senderName = (getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'another user';
            logStatusDep(`Channel "${newChannelData.name}" created by ${senderName}.`);
        }
        if (!currentActiveChannelId && channels.length === 1) {
            setActiveChannel(newChannelData.id, false);
        }
    }
}

export function handleInitialChannels(receivedChannels, peerId) {
    if (getIsHostDep && !getIsHostDep()) {
        channels = receivedChannels || [];
        if (channels.length > 0 && !currentActiveChannelId) {
            currentActiveChannelId = channels[0].id;
        }
        renderChannelList();
        if (chatHistory.length > 0) {
             displayChatForCurrentChannel();
        }
        if(logStatusDep) logStatusDep(`Received channel list from ${(getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'host'}.`);
    }
}


// --- Whiteboard Feature ---
function initWhiteboardInternal() {
    if (!whiteboardCanvas || !wbColorPicker || !wbLineWidth || !wbClearBtn || !wbLineWidthValue || !wbToolPalette || !wbZoomOutBtn || !wbZoomLevelDisplay || !wbZoomInBtn) return;
    
    whiteboardCanvas.style.backgroundColor = '#FFFFFF'; 
    wbCtx = whiteboardCanvas.getContext('2d');
    resizeWhiteboardAndRedraw();

    wbColorPicker.addEventListener('change', (e) => { if (wbCtx) wbCtx.strokeStyle = e.target.value; });
    wbLineWidth.addEventListener('input', (e) => { 
        if (wbCtx) wbCtx.lineWidth = e.target.value; 
        if (wbLineWidthValue) wbLineWidthValue.textContent = `${e.target.value}px`;
    });
    if (wbLineWidthValue) wbLineWidthValue.textContent = `${wbLineWidth.value}px`;
    wbClearBtn.addEventListener('click', clearWhiteboardAndBroadcast);

    const toolButtons = wbToolPalette.querySelectorAll('.wb-tool-btn');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentWbTool = button.dataset.tool;
            whiteboardCanvas.style.cursor = (currentWbTool === 'pen' || currentWbTool === 'rectangle' || currentWbTool === 'circle') ? 'crosshair' 
                                         : (currentWbTool === 'eraser') ? 'grab' 
                                         : 'default';
        });
    });
    const defaultToolButton = wbToolPalette.querySelector(`.wb-tool-btn[data-tool="${currentWbTool}"]`);
    if (defaultToolButton) defaultToolButton.classList.add('active');
    whiteboardCanvas.style.cursor = 'crosshair';


    wbZoomInBtn.addEventListener('click', () => zoomWhiteboard(true));
    wbZoomOutBtn.addEventListener('click', () => zoomWhiteboard(false));
    updateZoomDisplay();

    ['mousedown', 'touchstart'].forEach(evt => whiteboardCanvas.addEventListener(evt, handleWbMouseDown, { passive: false }));
    ['mousemove', 'touchmove'].forEach(evt => whiteboardCanvas.addEventListener(evt, handleWbMouseMove, { passive: false }));
    ['mouseup', 'touchend', 'mouseout', 'touchcancel'].forEach(evt => whiteboardCanvas.addEventListener(evt, handleWbMouseUp));
    
    window.addEventListener('resize', resizeWhiteboardAndRedraw);

    if (wbCtx) {
        wbCtx.strokeStyle = wbColorPicker.value;
        wbCtx.lineWidth = wbLineWidth.value;
        wbCtx.lineCap = 'round';
        wbCtx.lineJoin = 'round';
    }
}

function updateZoomDisplay() {
    if(wbZoomLevelDisplay) wbZoomLevelDisplay.textContent = `${Math.round(wbZoomLevel * 100)}%`;
}

function zoomWhiteboard(zoomIn) {
    if (!whiteboardCanvas) return;
    const oldZoom = wbZoomLevel;
    const physCenterX = whiteboardCanvas.width / 2;
    const physCenterY = whiteboardCanvas.height / 2;

    const logCenterX_before = (physCenterX / oldZoom) + wbPanX;
    const logCenterY_before = (physCenterY / oldZoom) + wbPanY;

    if (zoomIn) {
        wbZoomLevel = Math.min(WB_MAX_ZOOM, wbZoomLevel + WB_ZOOM_STEP);
    } else {
        wbZoomLevel = Math.max(WB_MIN_ZOOM, wbZoomLevel - WB_ZOOM_STEP);
    }
    wbZoomLevel = parseFloat(wbZoomLevel.toFixed(2));

    wbPanX = logCenterX_before - (physCenterX / wbZoomLevel);
    wbPanY = logCenterY_before - (physCenterY / wbZoomLevel);
    
    updateZoomDisplay();
    redrawWhiteboardFromHistory();
}

function getWbPhysicalEventPosition(event) { 
    if (!whiteboardCanvas) return {x:0, y:0};
    const rect = whiteboardCanvas.getBoundingClientRect();
    let clientX, clientY;
    if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function getWbLogicalEventPosition(event) { 
    const physicalPos = getWbPhysicalEventPosition(event);
    return {
        x: (physicalPos.x / wbZoomLevel) + wbPanX,
        y: (physicalPos.y / wbZoomLevel) + wbPanY
    };
}

function handleWbMouseDown(e) {
    if (!wbCtx) return;
    e.preventDefault();
    const logicalPos = getWbLogicalEventPosition(e);

    wbIsDrawing = true;
    wbLastX = logicalPos.x;
    wbLastY = logicalPos.y;

    if (currentWbTool === 'rectangle' || currentWbTool === 'circle') {
        wbShapeStartX = logicalPos.x;
        wbShapeStartY = logicalPos.y;
    }
}

function handleWbMouseMove(e) {
    if (!wbIsDrawing || !wbCtx) return;
    e.preventDefault();
    const logicalPos = getWbLogicalEventPosition(e);
    const currentLogicalX = logicalPos.x;
    const currentLogicalY = logicalPos.y;

    if (currentWbTool === 'pen' || currentWbTool === 'eraser') {
        const drawCmdData = {
            type: currentWbTool,
            x0: wbLastX, y0: wbLastY,
            x1: currentLogicalX, y1: currentLogicalY,
            color: (currentWbTool === 'pen') ? wbColorPicker.value : '#FFFFFF',
            lineWidth: (currentWbTool === 'pen') ? parseFloat(wbLineWidth.value) : Math.max(10, parseFloat(wbLineWidth.value) * 1.5)
        };
        applyDrawCommand(drawCmdData);
        whiteboardHistory.push(drawCmdData);
        if (sendDrawCommandDep) sendDrawCommandDep(drawCmdData);
        if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');
    }
    
    wbLastX = currentLogicalX;
    wbLastY = currentLogicalY;
}

function handleWbMouseUp() {
    if (!wbIsDrawing || !wbCtx) return;
    
    if (currentWbTool === 'rectangle') {
        const logicalWidth = wbLastX - wbShapeStartX;
        const logicalHeight = wbLastY - wbShapeStartY;
        const rectCmd = {
            type: 'rectangle', x: wbShapeStartX, y: wbShapeStartY, width: logicalWidth, height: logicalHeight,
            color: wbColorPicker.value, lineWidth: parseFloat(wbLineWidth.value)
        };
        applyDrawCommand(rectCmd);
        whiteboardHistory.push(rectCmd);
        if (sendDrawCommandDep) sendDrawCommandDep(rectCmd);
        if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');

    } else if (currentWbTool === 'circle') {
        const dLogicalX = wbLastX - wbShapeStartX;
        const dLogicalY = wbLastY - wbShapeStartY;
        const logicalRadius = Math.sqrt(dLogicalX * dLogicalX + dLogicalY * dLogicalY);
        const circleCmd = {
            type: 'circle', cx: wbShapeStartX, cy: wbShapeStartY, radius: logicalRadius,
            color: wbColorPicker.value, lineWidth: parseFloat(wbLineWidth.value)
        };
        applyDrawCommand(circleCmd);
        whiteboardHistory.push(circleCmd);
        if (sendDrawCommandDep) sendDrawCommandDep(circleCmd);
         if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');
    }
    
    wbIsDrawing = false;
}

function applyDrawCommand(cmd) {
    if (!wbCtx || !whiteboardCanvas) return;

    const originalStrokeStyle = wbCtx.strokeStyle;
    const originalLineWidth = wbCtx.lineWidth;
    const originalFillStyle = wbCtx.fillStyle;

    const transformX = (logicalX) => (logicalX - wbPanX) * wbZoomLevel;
    const transformY = (logicalY) => (logicalY - wbPanY) * wbZoomLevel;
    const transformSize = (logicalSize) => logicalSize * wbZoomLevel;

    wbCtx.strokeStyle = cmd.color || (wbColorPicker ? wbColorPicker.value : '#000000');
    wbCtx.lineWidth = transformSize(cmd.lineWidth || (wbLineWidth ? parseFloat(wbLineWidth.value) : 3)); 

    switch (cmd.type) {
        case 'pen': case 'draw': 
            wbCtx.beginPath();
            wbCtx.moveTo(transformX(cmd.x0), transformY(cmd.y0));
            wbCtx.lineTo(transformX(cmd.x1), transformY(cmd.y1));
            wbCtx.stroke();
            wbCtx.closePath();
            break;
        case 'eraser': case 'erase':
            wbCtx.strokeStyle = '#FFFFFF';
            wbCtx.lineWidth = transformSize(cmd.lineWidth); 
            wbCtx.beginPath();
            wbCtx.moveTo(transformX(cmd.x0), transformY(cmd.y0));
            wbCtx.lineTo(transformX(cmd.x1), transformY(cmd.y1));
            wbCtx.stroke();
            wbCtx.closePath();
            break;
        case 'rectangle':
            wbCtx.beginPath();
            wbCtx.rect(transformX(cmd.x), transformY(cmd.y), transformSize(cmd.width), transformSize(cmd.height));
            wbCtx.stroke();
            wbCtx.closePath();
            break;
        case 'circle':
            wbCtx.beginPath();
            wbCtx.arc(transformX(cmd.cx), transformY(cmd.cy), transformSize(cmd.radius), 0, 2 * Math.PI);
            wbCtx.stroke();
            wbCtx.closePath();
            break;
        case 'clear':
            wbCtx.fillStyle = '#FFFFFF';
            wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
            wbPanX = 0; wbPanY = 0; wbZoomLevel = 1.0; // Reset pan and zoom on clear
            updateZoomDisplay();
            break;
        default: console.warn("Unknown draw command type:", cmd.type);
    }

    wbCtx.strokeStyle = originalStrokeStyle;
    wbCtx.lineWidth = originalLineWidth;
    wbCtx.fillStyle = originalFillStyle;
}

export function resizeWhiteboardAndRedraw() {
    if (!whiteboardCanvas || !whiteboardCanvas.offsetParent) return;
    const displayWidth = whiteboardCanvas.clientWidth;
    const displayHeight = whiteboardCanvas.clientHeight;
    if (displayWidth <= 0 || displayHeight <= 0) return;

    if (whiteboardCanvas.width !== displayWidth || whiteboardCanvas.height !== displayHeight) {
        whiteboardCanvas.width = displayWidth;
        whiteboardCanvas.height = displayHeight;
    }
    if (wbCtx) { // Ensure context exists before trying to fill
        wbCtx.fillStyle = '#FFFFFF';
        wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    }
    redrawWhiteboardFromHistory();
}

function clearWhiteboardAndBroadcast() {
    const clearCmd = { type: 'clear' };
    applyDrawCommand(clearCmd); // This will apply to local canvas and reset local pan/zoom
    whiteboardHistory = [clearCmd]; // History now only contains the clear command
    if (sendDrawCommandDep) sendDrawCommandDep(clearCmd);
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');
}

function redrawWhiteboardFromHistory() {
    if (!wbCtx || !whiteboardCanvas || whiteboardCanvas.width === 0 || whiteboardCanvas.height === 0) {
        // console.warn('redrawWhiteboardFromHistory: Ctx or canvas not ready or zero size.');
        return;
    }

    // Initial clear of the canvas before replaying any history
    wbCtx.fillStyle = '#FFFFFF';
    wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    
    // Set default drawing styles for this session.
    // applyDrawCommand will use specific styles from commands if they exist.
    wbCtx.strokeStyle = wbColorPicker ? wbColorPicker.value : '#000000'; 
    wbCtx.lineWidth = wbLineWidth ? parseFloat(wbLineWidth.value) : 3;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    
    // Apply each command from history.
    // applyDrawCommand handles 'clear' which includes resetting pan/zoom for subsequent commands.
    whiteboardHistory.forEach(cmd => {
        applyDrawCommand(cmd);
    });
}

export function redrawWhiteboardFromHistoryIfVisible(force = false) {
    if (whiteboardCanvas && (whiteboardCanvas.offsetParent || force)) {
        if (wbCtx) {
            // This initial clear might be redundant if redrawWhiteboardFromHistory also does it,
            // but it's safe.
            wbCtx.fillStyle = '#FFFFFF';
            wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
        }
        redrawWhiteboardFromHistory();
    }
}

export function handleDrawCommand(cmd, peerId) {
    applyDrawCommand(cmd); // Apply to local canvas
    if (cmd.type === 'clear') {
        whiteboardHistory = [cmd]; // Replace history with clear command
    } else if (!whiteboardHistory.find(c => JSON.stringify(c) === JSON.stringify(cmd))) { // Avoid duplicates if somehow received own echo
        whiteboardHistory.push(cmd);
    }
    if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('whiteboardSection');
}

export function handleInitialWhiteboard(history, peerId) {
    if (getIsHostDep && !getIsHostDep()) { // Only non-hosts process this
        const nickname = (getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'host';
        if(logStatusDep) logStatusDep(`Client: Received initial whiteboard history from ${nickname}, length: ${history.length}.`);
        // console.log('Client: Received whiteboard history:', JSON.stringify(history));

        whiteboardHistory = history; // Can be an empty array if host's board was empty
        wbZoomLevel = 1.0; wbPanX = 0; wbPanY = 0; // Reset client's pan/zoom to default for the received state
        updateZoomDisplay();
        redrawWhiteboardFromHistoryIfVisible(true); // Force redraw with the new history
        if(logStatusDep) logStatusDep(`Client: Whiteboard state applied from ${nickname}.`);
    }
}

// --- Kanban Feature ---
function initKanbanInternal() {
    if(!addColumnBtn || !kanbanBoard || !newColumnNameInput) return;
    addColumnBtn.addEventListener('click', handleAddKanbanColumn);
    renderKanbanBoard();
}

function renderKanbanBoard() {
    if (!kanbanBoard) return;
    kanbanBoard.innerHTML = '';
    if (!kanbanData || !kanbanData.columns) kanbanData = { columns: [] };

    kanbanData.columns.forEach(column => {
        const columnDiv = document.createElement('div');
        columnDiv.classList.add('kanban-column');
        columnDiv.dataset.columnId = column.id;
        
        let cardsHtml = (column.cards || []).map(card => {
            const cardPriority = card.priority || 1; // Default to 1 if undefined
            return `
                <div class="kanban-card priority-${cardPriority}" draggable="true" data-card-id="${card.id}" data-parent-column-id="${column.id}" data-priority="${cardPriority}">
                    <div class="kanban-card-content">
                        <p>${card.text}</p>
                        <select class="kanban-card-priority" data-card-id="${card.id}" data-column-id="${column.id}">
                            <option value="1" ${cardPriority == 1 ? 'selected' : ''}>Low</option>
                            <option value="2" ${cardPriority == 2 ? 'selected' : ''}>Medium</option>
                            <option value="3" ${cardPriority == 3 ? 'selected' : ''}>High</option>
                            <option value="4" ${cardPriority == 4 ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>
                    <button class="delete-card-btn" data-card-id="${card.id}" data-column-id="${column.id}" title="Delete card">❌</button>
                </div>`;
        }).join('');

        let addCardSectionHtml = '';
        if (column.id === kanbanCurrentlyAddingCardToColumnId) {
            addCardSectionHtml = `
                <div class="add-card-form">
                    <textarea class="new-card-text-input" placeholder="Enter card text..."></textarea>
                    <div class="add-card-form-actions">
                        <button class="save-new-card-btn" data-column-id="${column.id}">Save Card</button>
                        <button class="cancel-add-card-btn" data-column-id="${column.id}">Cancel</button>
                    </div>
                </div>`;
        } else {
            addCardSectionHtml = `<button class="add-card-btn" data-column-id="${column.id}">+ Add Card</button>`;
        }

        columnDiv.innerHTML = `
            <h3>${column.title}<button class="delete-column-btn" data-column-id="${column.id}" title="Delete column">🗑️</button></h3>
            <div class="kanban-cards">${cardsHtml}</div>
            ${addCardSectionHtml}`;
        kanbanBoard.appendChild(columnDiv);
    });

    // Event Listeners
    kanbanBoard.querySelectorAll('.add-card-btn').forEach(btn => btn.addEventListener('click', () => handleShowAddCardForm(btn.dataset.columnId)));
    kanbanBoard.querySelectorAll('.save-new-card-btn').forEach(btn => btn.addEventListener('click', () => handleSaveNewCard(btn.dataset.columnId)));
    kanbanBoard.querySelectorAll('.cancel-add-card-btn').forEach(btn => btn.addEventListener('click', () => handleCancelAddCard()));
    
    kanbanBoard.querySelectorAll('.delete-column-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteKanbanColumn(btn.dataset.columnId)));
    kanbanBoard.querySelectorAll('.delete-card-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteKanbanCard(btn.dataset.columnId, btn.dataset.cardId)));
    
    kanbanBoard.querySelectorAll('.kanban-card-priority').forEach(selectEl => {
        selectEl.addEventListener('change', (e) => handleUpdateCardPriority(e.target.dataset.columnId, e.target.dataset.cardId, e.target.value));
    });

    kanbanBoard.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('dragstart', handleKanbanDragStart);
        card.addEventListener('dragend', handleKanbanDragEnd);
    });
    kanbanBoard.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', handleKanbanDragOver);
        col.addEventListener('dragleave', handleKanbanDragLeave);
        col.addEventListener('drop', handleKanbanDrop);
    });

    // Focus textarea if a form is active
    if (kanbanCurrentlyAddingCardToColumnId) {
        const activeFormTextarea = kanbanBoard.querySelector(`.kanban-column[data-column-id="${kanbanCurrentlyAddingCardToColumnId}"] .new-card-text-input`);
        if (activeFormTextarea) activeFormTextarea.focus();
    }
}

export function renderKanbanBoardIfActive(force = false) {
    const kanbanSectionEl = document.getElementById('kanbanSection');
    if (kanbanBoard && ( (kanbanSectionEl && !kanbanSectionEl.classList.contains('hidden')) || force)) {
        renderKanbanBoard();
    }
}

function handleKanbanDragStart(e) {
    draggedCardElement = e.target;
    const cardPriority = e.target.dataset.priority || 1;
    draggedCardData = {
        id: e.target.dataset.cardId,
        originalColumnId: e.target.dataset.parentColumnId,
        text: e.target.querySelector('.kanban-card-content p') ? e.target.querySelector('.kanban-card-content p').textContent : '',
        priority: parseInt(cardPriority)
    };
    e.dataTransfer.setData('text/plain', e.target.dataset.cardId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if(draggedCardElement) draggedCardElement.classList.add('dragging'); }, 0);
}
function handleKanbanDragEnd(e) {
    if(draggedCardElement) draggedCardElement.classList.remove('dragging');
    draggedCardElement = null; draggedCardData = null;
    if(kanbanBoard) kanbanBoard.querySelectorAll('.kanban-column.drag-over').forEach(col => col.classList.remove('drag-over'));
}
function handleKanbanDragOver(e) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const column = e.target.closest('.kanban-column');
    if (column && kanbanBoard) {
        kanbanBoard.querySelectorAll('.kanban-column.drag-over').forEach(col => col.classList.remove('drag-over'));
        column.classList.add('drag-over');
    }
}
function handleKanbanDragLeave(e) {
    const column = e.target.closest('.kanban-column');
    if (column && !column.contains(e.relatedTarget)) column.classList.remove('drag-over');
}
function handleKanbanDrop(e) {
    e.preventDefault(); if (!draggedCardData) return;
    const targetColumnDiv = e.target.closest('.kanban-column');
    if (!targetColumnDiv) return;
    targetColumnDiv.classList.remove('drag-over');
    const targetColumnId = targetColumnDiv.dataset.columnId;

    if (draggedCardData.originalColumnId !== targetColumnId) {
        const sourceCol = kanbanData.columns.find(c => c.id === draggedCardData.originalColumnId);
        const targetCol = kanbanData.columns.find(c => c.id === targetColumnId);
        if (sourceCol && targetCol) {
            if (!sourceCol.cards) sourceCol.cards = [];
            const cardIndex = sourceCol.cards.findIndex(card => card.id === draggedCardData.id);
            if (cardIndex > -1) {
                const [movedCard] = sourceCol.cards.splice(cardIndex, 1);
                if (!targetCol.cards) targetCol.cards = [];
                targetCol.cards.push(movedCard); // movedCard already has its priority
                const update = { type: 'moveCard', cardId: draggedCardData.id, fromColumnId: draggedCardData.originalColumnId, toColumnId: targetColumnId, cardData: movedCard };
                if (sendKanbanUpdateDep) sendKanbanUpdateDep(update);
                renderKanbanBoard();
                if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('kanbanSection');
            }
        }
    }
    draggedCardElement = null; draggedCardData = null;
}

function handleAddKanbanColumn() {
    if(!newColumnNameInput) return;
    const columnName = newColumnNameInput.value.trim(); if (!columnName) return;
    const newColumn = { id: `col-${Date.now()}`, title: columnName, cards: [] };
    if (!kanbanData.columns) kanbanData.columns = [];
    kanbanData.columns.push(newColumn);
    if (sendKanbanUpdateDep) sendKanbanUpdateDep({ type: 'addColumn', column: newColumn });
    renderKanbanBoard(); newColumnNameInput.value = '';
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('kanbanSection');
}

function handleShowAddCardForm(columnId) {
    kanbanCurrentlyAddingCardToColumnId = columnId;
    renderKanbanBoard();
}

function handleSaveNewCard(columnId) {
    const columnDiv = kanbanBoard.querySelector(`.kanban-column[data-column-id="${columnId}"]`);
    if (!columnDiv) return;
    const textarea = columnDiv.querySelector('.new-card-text-input');
    if (!textarea) return;

    const cardText = textarea.value.trim();
    if (!cardText) {
        if (logStatusDep) logStatusDep("Card text cannot be empty.", true);
        textarea.focus();
        return;
    }

    const column = kanbanData.columns.find(col => col.id === columnId);
    if (column) {
        const newCard = { 
            id: `card-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, 
            text: cardText,
            priority: 1 // Default priority
        };
        if (!column.cards) column.cards = [];
        column.cards.push(newCard);
        
        if (sendKanbanUpdateDep) sendKanbanUpdateDep({ type: 'addCard', columnId, card: newCard });
        
        kanbanCurrentlyAddingCardToColumnId = null; // Reset state
        renderKanbanBoard(); // Re-render to show new card and remove form
        if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('kanbanSection');
    }
}

function handleCancelAddCard() {
    kanbanCurrentlyAddingCardToColumnId = null;
    renderKanbanBoard();
}

function handleUpdateCardPriority(columnId, cardId, newPriorityStr) {
    const newPriority = parseInt(newPriorityStr);
    const column = kanbanData.columns.find(c => c.id === columnId);
    if (column && column.cards) {
        const card = column.cards.find(c => c.id === cardId);
        if (card) {
            card.priority = newPriority;
            if (sendKanbanUpdateDep) sendKanbanUpdateDep({ type: 'updateCardPriority', columnId, cardId, priority: newPriority });
            renderKanbanBoard(); // Re-render to show style change
            if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('kanbanSection');
        }
    }
}


function handleDeleteKanbanColumn(columnId) {
    if (!confirm("Delete column and all cards?")) return;
    kanbanData.columns = kanbanData.columns.filter(col => col.id !== columnId);
    if (sendKanbanUpdateDep) sendKanbanUpdateDep({ type: 'deleteColumn', columnId });
    renderKanbanBoard();
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('kanbanSection');
}
function handleDeleteKanbanCard(columnId, cardId) {
    if (!confirm("Delete card?")) return;
    const column = kanbanData.columns.find(col => col.id === columnId);
    if (column && column.cards) {
        column.cards = column.cards.filter(card => card.id !== cardId);
        if (sendKanbanUpdateDep) sendKanbanUpdateDep({ type: 'deleteCard', columnId, cardId });
        renderKanbanBoard();
        if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('kanbanSection');
    }
}

export function handleKanbanUpdate(update, peerId) {
    let needsRender = true;
    if (!kanbanData.columns) kanbanData.columns = [];
    switch (update.type) {
        case 'fullState': 
            kanbanData = update.data;
            if (kanbanData && kanbanData.columns) {
                kanbanData.columns.forEach(column => {
                    if (column.cards) {
                        column.cards.forEach(card => card.priority = card.priority || 1);
                    }
                });
            }
            break;
        case 'addColumn': 
            if (!kanbanData.columns.find(c => c.id === update.column.id)) {
                kanbanData.columns.push(update.column);
            } else {
                needsRender = false;
            }
            break;
        case 'addCard': { 
            const col = kanbanData.columns.find(c => c.id === update.columnId); 
            if (col) { 
                if (!col.cards) col.cards = []; 
                const existingCardIndex = col.cards.findIndex(c => c.id === update.card.id);
                const cardData = { ...update.card, priority: update.card.priority || 1 };

                if (existingCardIndex > -1) { // Card exists, update it
                    col.cards[existingCardIndex] = { ...col.cards[existingCardIndex], ...cardData };
                } else { // New card
                    col.cards.push(cardData);
                }
            } else { needsRender = false; } 
            break; 
        }
        case 'deleteColumn': 
            kanbanData.columns = kanbanData.columns.filter(c => c.id !== update.columnId); 
            break;
        case 'deleteCard': { 
            const col = kanbanData.columns.find(c => c.id === update.columnId); 
            if (col && col.cards) {
                col.cards = col.cards.filter(card => card.id !== update.cardId);
            } else {
                needsRender = false;
            }
            break; 
        }
        case 'moveCard': { 
            const sCol = kanbanData.columns.find(c => c.id === update.fromColumnId); 
            const tCol = kanbanData.columns.find(c => c.id === update.toColumnId); 
            if (sCol && tCol) { 
                if(!sCol.cards) sCol.cards =[]; 
                const idx = sCol.cards.findIndex(c => c.id === update.cardId); 
                if (idx > -1) { 
                    const [mCard] = sCol.cards.splice(idx, 1); 
                    const movedCardWithPriority = { ...mCard, ...(update.cardData || {}), priority: (update.cardData?.priority || mCard.priority || 1) };
                    if (!tCol.cards) tCol.cards = []; 
                    tCol.cards.push(movedCardWithPriority); 
                } else { needsRender = false; } 
            } else { needsRender = false; } 
            break; 
        }
        case 'updateCardPriority': {
            const col = kanbanData.columns.find(c => c.id === update.columnId);
            if (col && col.cards) {
                const card = col.cards.find(c => c.id === update.cardId);
                if (card) {
                    card.priority = update.priority;
                } else { needsRender = false; }
            } else { needsRender = false; }
            break;
        }
        default: 
            console.warn("Unknown Kanban update type:", update.type); 
            needsRender = false;
    }
    if (needsRender) {
        renderKanbanBoard();
        if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('kanbanSection');
    }
}
export function handleInitialKanban(initialData, peerId) {
    if (getIsHostDep && !getIsHostDep()) {
        kanbanData = initialData;
         if (kanbanData && kanbanData.columns) {
            kanbanData.columns.forEach(column => {
                if (column.cards) {
                    column.cards.forEach(card => card.priority = card.priority || 1);
                }
            });
        }
        renderKanbanBoardIfActive(true);
        if(logStatusDep) logStatusDep(`Received Kanban state from ${(getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'host'}.`);
    }
}


// --- Documents Feature ---
const debouncedSendActiveDocumentContentUpdate = debounce(() => {
    if (sendDocumentContentUpdateDep && currentActiveDocumentId && collaborativeEditor) {
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (activeDoc && collaborativeEditor.innerHTML !== activeDoc.htmlContent) {
            activeDoc.htmlContent = collaborativeEditor.innerHTML;
            sendDocumentContentUpdateDep({ documentId: currentActiveDocumentId, htmlContent: activeDoc.htmlContent });
            if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('documentsSection');
        }
    }
}, 750);

function initDocumentsModuleInternal() {
    if (!collaborativeEditor || !newDocBtn || !renameDocBtn || !deleteDocBtn || !docBoldBtn || !downloadTxtBtn || !documentListDiv) return;

    collaborativeEditor.addEventListener('input', debouncedSendActiveDocumentContentUpdate);
    const execFormatCommand = (command) => { document.execCommand(command, false, null); collaborativeEditor.focus(); debouncedSendActiveDocumentContentUpdate(); };
    if(docBoldBtn) docBoldBtn.addEventListener('click', () => execFormatCommand('bold'));
    if(docItalicBtn) docItalicBtn.addEventListener('click', () => execFormatCommand('italic'));
    if(docUnderlineBtn) docUnderlineBtn.addEventListener('click', () => execFormatCommand('underline'));
    if(docUlBtn) docUlBtn.addEventListener('click', () => execFormatCommand('insertUnorderedList'));
    if(docOlBtn) docOlBtn.addEventListener('click', () => execFormatCommand('insertOrderedList'));
    if(downloadTxtBtn) downloadTxtBtn.addEventListener('click', () => {
        if (!currentActiveDocumentId) { if(logStatusDep) logStatusDep("No active document to download.", true); return; }
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (!activeDoc) { if(logStatusDep) logStatusDep("Active document not found.", true); return; }
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = activeDoc.htmlContent;
        const text = tempDiv.innerText || tempDiv.textContent || ""; tempDiv.remove();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const filename = `${activeDoc.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
    });

    newDocBtn.addEventListener('click', () => uiActionCreateNewDocument());
    renameDocBtn.addEventListener('click', uiActionRenameDocument);
    deleteDocBtn.addEventListener('click', uiActionDeleteDocument);

    renderDocumentList(); loadActiveDocumentContent();
}
export function renderDocumentsIfActive(force = false) {
     if (documentsSection && ( (!documentsSection.classList.contains('hidden')) || force)) {
        renderDocumentList(); loadActiveDocumentContent();
    }
}

function renderDocumentList() {
    if (!documentListDiv) return;
    documentListDiv.innerHTML = '';
    if (documents.length === 0 && getIsHostDep && getIsHostDep() && sendCreateDocumentDep) {
        uiActionCreateNewDocument("Default Document", "<p>Welcome to your new document!</p>", false); return;
    }
    documents.forEach(doc => {
        const docItem = document.createElement('span');
        docItem.classList.add('document-list-item'); docItem.textContent = doc.name; docItem.dataset.documentId = doc.id;
        if (doc.id === currentActiveDocumentId) docItem.classList.add('active');
        docItem.addEventListener('click', () => setActiveDocument(doc.id));
        documentListDiv.appendChild(docItem);
    });
    if (collaborativeEditor) {
        if (!currentActiveDocumentId || !documents.find(d => d.id === currentActiveDocumentId)) {
            collaborativeEditor.innerHTML = '<p>Select or create a document.</p>'; collaborativeEditor.contentEditable = "false";
        } else collaborativeEditor.contentEditable = "true";
    }
}
function loadActiveDocumentContent() {
    if (!collaborativeEditor) return;
    if (!currentActiveDocumentId && documents.length > 0) currentActiveDocumentId = documents[0].id;
    const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
    if (activeDoc) {
        if (collaborativeEditor.innerHTML !== activeDoc.htmlContent) collaborativeEditor.innerHTML = activeDoc.htmlContent;
        collaborativeEditor.contentEditable = "true";
    } else if (documents.length > 0) {
        currentActiveDocumentId = documents[0].id;
        if (collaborativeEditor.innerHTML !== documents[0].htmlContent) collaborativeEditor.innerHTML = documents[0].htmlContent;
        collaborativeEditor.contentEditable = "true";
    } else {
        collaborativeEditor.innerHTML = '<p>Select or create a document to start editing.</p>';
        collaborativeEditor.contentEditable = "false";
    }
    renderDocumentList();
}
function setActiveDocument(documentId) {
    if (currentActiveDocumentId && collaborativeEditor) {
        const currentDocObj = documents.find(d => d.id === currentActiveDocumentId);
        if (currentDocObj && collaborativeEditor.innerHTML !== currentDocObj.htmlContent) currentDocObj.htmlContent = collaborativeEditor.innerHTML;
    }
    currentActiveDocumentId = documentId; loadActiveDocumentContent();
}

function uiActionCreateNewDocument(defaultName = null, defaultContent = null, broadcast = true) {
    const docName = defaultName || prompt("Enter name for the new document:", `Document ${documents.length + 1}`);
    if (!docName) return;
    const newDoc = { id: `doc-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, name: docName, htmlContent: defaultContent || '<p>Start typing...</p>' };
    documents.push(newDoc); setActiveDocument(newDoc.id);
    if (broadcast && sendCreateDocumentDep) {
        sendCreateDocumentDep(newDoc);
        if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('documentsSection');
    }
}
export function ensureDefaultDocument() {
    if (getIsHostDep && getIsHostDep() && documents.length === 0) {
        uiActionCreateNewDocument("Shared Notes", "<p>Welcome!</p>", true);
    }
}
function uiActionRenameDocument() {
    if (!currentActiveDocumentId) { if(logStatusDep) logStatusDep("No doc selected.", true); return; }
    const docToRename = documents.find(d => d.id === currentActiveDocumentId);
    if (!docToRename) { if(logStatusDep) logStatusDep("Doc not found.", true); return; }
    const newName = prompt("New name:", docToRename.name);
    if (newName && newName.trim() && newName !== docToRename.name) {
        docToRename.name = newName.trim(); renderDocumentList();
        if (sendRenameDocumentDep) {
            sendRenameDocumentDep({ documentId: currentActiveDocumentId, newName: docToRename.name });
            if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('documentsSection');
        }
    }
}
function uiActionDeleteDocument() {
    if (!currentActiveDocumentId) { if(logStatusDep) logStatusDep("No doc selected.", true); return; }
    const docToDelete = documents.find(d => d.id === currentActiveDocumentId);
    if (!docToDelete) { if(logStatusDep) logStatusDep("Doc not found.", true); return; }
    if (!confirm(`Delete "${docToDelete.name}"?`)) return;
    const deletedDocId = currentActiveDocumentId;
    documents = documents.filter(doc => doc.id !== deletedDocId);
    if (sendDeleteDocumentDep) sendDeleteDocumentDep({ documentId: deletedDocId });
    currentActiveDocumentId = null;
    if (documents.length > 0) setActiveDocument(documents[0].id);
    else { if (getIsHostDep && getIsHostDep()) uiActionCreateNewDocument("Default", "<p>Empty.</p>", true); else { if(collaborativeEditor) { collaborativeEditor.innerHTML = '<p>No docs.</p>'; collaborativeEditor.contentEditable = "false"; } renderDocumentList(); }}
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && deletedDocId && showNotificationDep) showNotificationDep('documentsSection');
}

export function handleInitialDocuments(data, peerId) {
    if (getIsHostDep && !getIsHostDep()) {
        documents = data.docs || [];
        currentActiveDocumentId = data.activeId || (documents.length > 0 ? documents[0].id : null);
        renderDocumentList(); loadActiveDocumentContent();
        if(logStatusDep) logStatusDep(`Received docs state from ${(getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'host'}.`);
    }
}
export function handleCreateDocument(newDocData, peerId) {
    if (!documents.find(d => d.id === newDocData.id)) {
        documents.push(newDocData); renderDocumentList();
        if (documents.length === 1 && !currentActiveDocumentId) setActiveDocument(newDocData.id);
        if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');
    }
}
export function handleRenameDocument(renameData, peerId) {
    const doc = documents.find(d => d.id === renameData.documentId);
    if (doc) { doc.name = renameData.newName; renderDocumentList(); if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');}
}
export function handleDeleteDocument(deleteData, peerId) {
    documents = documents.filter(d => d.id !== deleteData.documentId);
    if (currentActiveDocumentId === deleteData.documentId) { currentActiveDocumentId = documents.length > 0 ? documents[0].id : null; loadActiveDocumentContent(); }
    renderDocumentList(); if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');
}
export function handleDocumentContentUpdate(data, peerId) {
    const doc = documents.find(d => d.id === data.documentId);
    if (doc && collaborativeEditor) {
        doc.htmlContent = data.htmlContent;
        if (currentActiveDocumentId === data.documentId && collaborativeEditor.innerHTML !== data.htmlContent) collaborativeEditor.innerHTML = data.htmlContent;
        if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');
    }
}


// --- Data Export/Import/Sync ---
export function getShareableData() {
    if (currentActiveDocumentId && collaborativeEditor) {
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (activeDoc && collaborativeEditor.innerHTML !== activeDoc.htmlContent) activeDoc.htmlContent = activeDoc.innerHTML;
    }
    return { chatHistory, whiteboardHistory, kanbanData, documents, currentActiveDocumentId, channels, currentActiveChannelIdForImport: currentActiveChannelId };
}
export function loadShareableData(data) { 
    chatHistory = data.chatHistory || [];
    whiteboardHistory = data.whiteboardHistory || [];
    kanbanData = data.kanbanData || { columns: [] };
    documents = data.documents || [];
    currentActiveDocumentId = data.currentActiveDocumentId || null;
    channels = data.channels || [];
    currentActiveChannelId = data.currentActiveChannelIdForImport || (channels.length > 0 ? channels[0].id : null);

    if (kanbanData && kanbanData.columns) {
        kanbanData.columns.forEach(column => {
            if (column.cards) {
                column.cards.forEach(card => card.priority = card.priority || 1);
            }
        });
    }
}
function loadChatHistoryFromImport(importedHistory) { chatHistory = importedHistory; }
function loadWhiteboardHistoryFromImport(importedHistory) { whiteboardHistory = importedHistory; wbZoomLevel = 1.0; wbPanX = 0; wbPanY = 0; updateZoomDisplay(); }
function loadKanbanDataFromImport(importedData) { 
    kanbanData = importedData; 
    if (kanbanData && kanbanData.columns) {
        kanbanData.columns.forEach(column => {
            if (column.cards) {
                column.cards.forEach(card => card.priority = card.priority || 1);
            }
        });
    }
}
function loadDocumentsFromImport(importedDocs, activeId) {
    documents = importedDocs; currentActiveDocumentId = activeId;
    if (documents.length > 0 && (!currentActiveDocumentId || !documents.find(d => d.id === currentActiveDocumentId))) currentActiveDocumentId = documents[0].id;
}

export function sendFullStateToPeer(peerId) {
    if (getIsHostDep && getIsHostDep()) {
        if (sendInitialChannelsDep) sendInitialChannelsDep(channels, peerId);
        
        if (sendChatHistoryDep && chatHistory.length > 0) sendChatHistoryDep(chatHistory, peerId);
        
        // For whiteboard, send history if it exists, or an empty array to signal initial state.
        if (sendInitialWhiteboardDep) {
            if (whiteboardHistory.length > 0) {
                if(logStatusDep) logStatusDep(`Host: Sending whiteboard history to peer ${peerId.substring(0,6)}, length: ${whiteboardHistory.length}`);
                sendInitialWhiteboardDep(whiteboardHistory, peerId);
            } else {
                if(logStatusDep) logStatusDep(`Host: Sending EMPTY whiteboard history to peer ${peerId.substring(0,6)}`);
                sendInitialWhiteboardDep([], peerId); // Send empty array to trigger client-side reset
            }
        }
        
        if (sendInitialKanbanDep && (kanbanData.columns && kanbanData.columns.length > 0)) sendInitialKanbanDep(kanbanData, peerId);
        if (sendInitialDocumentsDep) sendInitialDocumentsDep({ docs: documents, activeId: currentActiveDocumentId }, peerId);
    }
}

export function displaySystemMessage(message) {
    const channelIdForSystem = currentActiveChannelId || 'system-global';
    addMessageToHistoryAndDisplay({ message, timestamp: Date.now(), channelId: channelIdForSystem }, false, true);
}

export function resetShareModuleStates(isCreatingHost = false) {
    chatHistory = [];
    if (chatArea) chatArea.innerHTML = '';
    if (messageInput) messageInput.value = '';
    incomingFileBuffers.clear();

    channels = [];
    currentActiveChannelId = null;
    if(channelListDiv) channelListDiv.innerHTML = '';
    if(newChannelNameInput) newChannelNameInput.value = '';


    whiteboardHistory = []; wbZoomLevel = 1.0; wbPanX = 0; wbPanY = 0;
    if(wbZoomLevelDisplay) updateZoomDisplay();
    if (wbCtx && whiteboardCanvas ) { 
         wbCtx.fillStyle = '#FFFFFF';
         wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    }

    kanbanData = { columns: [] }; 
    kanbanCurrentlyAddingCardToColumnId = null; 
    if (kanbanBoard) kanbanBoard.innerHTML = '';
    
    documents = []; currentActiveDocumentId = null;
    if (documentListDiv) documentListDiv.innerHTML = '';
    if (collaborativeEditor) { collaborativeEditor.innerHTML = '<p>Select or create a document.</p>'; collaborativeEditor.contentEditable = "false"; }
    
}