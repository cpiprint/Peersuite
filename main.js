import { joinRoom, selfId as localGeneratedPeerId } from './trystero-torrent.min.js';
import { 
    initShareFeatures, 
    getShareableData, 
    loadShareableData, 
    resetShareModuleStates, 
    setShareModulePeerInfo, 
    handleShareModulePeerLeave 
} from './share.js'; // Updated path, share.js is now the coordinator
import { initMediaFeatures, handleMediaPeerStream, stopAllLocalMedia, setupMediaForNewPeer, cleanupMediaForPeer } from './media.js';

const APP_ID = 'PeerSuite-0.0.9-newpaint-channels'; // Updated APP_ID

const wordList = [
    "able", "acid", "army", "away", "baby", "back", "ball", "band", "bank", "base",
    "bath", "bean", "bear", "beat", "bell", "bird", "blow", "blue", "boat", "body",
    "bone", "book", "boss", "busy", "cake", "call", "calm", "camp", "card", "care",
    "case", "cash", "chat", "city", "club", "coal", "coat", "code", "cold", "cook",
    "cool", "cope", "copy", "core", "cost", "crew", "crop", "dark", "data", "date",
    "deal", "deep", "deer", "desk", "disc", "disk", "door", "dose", "down", "draw",
    "dream", "drug", "drum", "duck", "duke", "dust", "duty", "earn", "east", "easy",
    "edge", "face", "fact", "fail", "fair", "fall", "farm", "fast", "fate", "fear",
    "feed", "feel", "file", "fill", "film", "find", "fine", "fire", "firm", "fish",
    "five", "flag", "flat", "flow", "food", "foot", "ford", "form", "fort", "four"
];

// DOM Elements for main.js
const setupSection = document.getElementById('setupSection');
const inRoomInterface = document.getElementById('inRoomInterface');
const nicknameInput = document.getElementById('nicknameInput');
const roomIdInput = document.getElementById('roomIdInput');
const roomPasswordInput = document.getElementById('roomPasswordInput');
const createPartyBtn = document.getElementById('createPartyBtn');
const joinWorkspaceBtn = document.getElementById('joinWorkspaceBtn');
const createWorkspaceFields = document.getElementById('createWorkspaceFields');
const joinWorkspaceFields = document.getElementById('joinWorkspaceFields');
const confirmCreateBtn = document.getElementById('confirmCreateBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const confirmJoinBtn = document.getElementById('confirmJoinBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const joinPasswordInput = document.getElementById('joinPasswordInput');
const statusDiv = document.getElementById('status');
const importWorkspaceBtn = document.getElementById('importWorkspaceBtn');
const importFilePicker = document.getElementById('importFilePicker');
const exportWorkspaceBtnSidebar = document.getElementById('exportWorkspaceBtnSidebar');

const currentRoomCodeSpan = document.getElementById('currentRoomCodeSpan');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const currentNicknameSpan = document.getElementById('currentNicknameSpan');
const themeToggle = document.getElementById('themeToggle');
const sidebarButtons = document.querySelectorAll('.sidebar-button');
const contentSections = document.querySelectorAll('.content-section');
const userCountSpan = document.getElementById('userCountSpan'); 
const userListUl = document.getElementById('userList'); 

// Global State for main.js
let roomApi;
let localNickname = '';
let currentRoomId = '';
let currentActiveSection = 'chatSection'; 
let peerNicknames = {}; // { peerId: nickname }
let isHost = false;
let importedWorkspaceState = null;

// Trystero action send/receive function pairs
let sendChatMessage, onChatMessage, sendNickname, onNickname, sendPrivateMessage, onPrivateMessage;
let sendFileMeta, onFileMeta, sendFileChunk, onFileChunk;
let sendDrawCommand, onDrawCommand, sendInitialWhiteboard, onInitialWhiteboard;
let sendKanbanUpdate, onKanbanUpdate, sendInitialKanban, onInitialKanban;
let sendChatHistory, onChatHistory;
let sendInitialDocuments, onInitialDocuments;
let sendCreateDocument, onCreateDocument;
let sendRenameDocument, onRenameDocument;
let sendDeleteDocument, onDeleteDocument;
let sendDocumentContentUpdate, onDocumentContentUpdate;
let sendCreateChannel, onCreateChannel; 
let sendInitialChannels, onInitialChannels; 

const CRYPTO_ALGO = 'AES-GCM';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// --- Theme ---
function initTheme() {
    const savedTheme = localStorage.getItem('viewPartyTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeToggle) themeToggle.checked = savedTheme === 'dark';

    // Whiteboard redraw on theme change is now handled slightly differently
    // because shareModuleRef might point to the coordinator, not directly to whiteboard functions.
    // The coordinator (share.js) will expose redrawWhiteboardFromHistoryIfVisible.
    const shareModule = window.shareModuleRef; 
    if (shareModule && shareModule.redrawWhiteboardFromHistoryIfVisible) {
        shareModule.redrawWhiteboardFromHistoryIfVisible();
    }
}
if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('viewPartyTheme', newTheme);
        const shareModule = window.shareModuleRef;
        if (shareModule && shareModule.redrawWhiteboardFromHistoryIfVisible) {
            shareModule.redrawWhiteboardFromHistoryIfVisible();
        }
    });
}
initTheme();

// --- Sidebar Navigation ---
sidebarButtons.forEach(button => {
    if (button.id === 'exportWorkspaceBtnSidebar') return;
    button.addEventListener('click', () => {
        const targetSectionId = button.getAttribute('data-section');
        const targetSectionElement = document.getElementById(targetSectionId);
        if (currentActiveSection === targetSectionId && targetSectionElement && !targetSectionElement.classList.contains('hidden')) {
            return;
        }
        sidebarButtons.forEach(btn => { if (btn.id !== 'exportWorkspaceBtnSidebar') btn.classList.remove('active'); });
        button.classList.add('active');
        currentActiveSection = targetSectionId;
        contentSections.forEach(section => {
            section.classList.toggle('hidden', section.id !== targetSectionId);
        });
        clearNotification(targetSectionId);

        const shareModule = window.shareModuleRef;
        if (shareModule) {
            if (targetSectionId === 'whiteboardSection' && shareModule.resizeWhiteboardAndRedraw) {
                 shareModule.resizeWhiteboardAndRedraw();
            }
            if (targetSectionId === 'kanbanSection' && shareModule.renderKanbanBoardIfActive) {
                shareModule.renderKanbanBoardIfActive();
            }
            if (targetSectionId === 'documentsSection' && shareModule.renderDocumentsIfActive) {
                 shareModule.renderDocumentsIfActive();
            }
        }
    });
});

function showNotification(sectionId) {
    const targetSectionElement = document.getElementById(sectionId);
    if (sectionId === currentActiveSection && targetSectionElement && !targetSectionElement.classList.contains('hidden')) {
        return; 
    }
    const dot = document.querySelector(`.notification-dot[data-notification-for="${sectionId}"]`);
    if (dot) dot.classList.remove('hidden');
}

function clearNotification(sectionId) {
    const dot = document.querySelector(`.notification-dot[data-notification-for="${sectionId}"]`);
    if (dot) dot.classList.add('hidden');
}

// --- Utility Functions ---
function logStatus(message, isError = false) {
    console.log(message);
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? 'var(--danger-color)' : 'var(--text-primary)';
    }
}

function generateMemorableRoomCode() {
    const selectedWords = [];
    for (let i = 0; i < 4; i++) {
        selectedWords.push(wordList[Math.floor(Math.random() * wordList.length)]);
    }
    return selectedWords.join('-');
}

function updateUserList() {
    if (!userListUl) return;
    userListUl.innerHTML = '';
    let count = 0;

    const selfLi = document.createElement('li');
    selfLi.innerHTML = `<span class="status-badge"></span> ${localNickname} (You)${isHost ? ' (Host)' : ''}`;
    userListUl.appendChild(selfLi);
    count++;

    for (const peerId in peerNicknames) {
        const nickname = peerNicknames[peerId];
        const li = document.createElement('li');
        li.innerHTML = `<span class="status-badge"></span> ${nickname}`;
        li.classList.add('peer-name');
        li.title = `Click to private message ${nickname}`;
        li.dataset.peerId = peerId;
        li.addEventListener('click', () => {
            const shareModule = window.shareModuleRef;
            if(shareModule && shareModule.primePrivateMessage) { // primePrivateMessage is in share.js
                shareModule.primePrivateMessage(nickname);
            }
        });
        userListUl.appendChild(li);
        count++;
    }
    if (userCountSpan) userCountSpan.textContent = count;
}

function findPeerIdByNickname(nickname) {
    for (const id in peerNicknames) {
        if (peerNicknames[id].toLowerCase() === nickname.toLowerCase()) {
            return id;
        }
    }
    return null;
}

// --- Import/Export ---
async function deriveKeyFromPassword_ImportExport(password, salt) {
    const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: CRYPTO_ALGO, length: 256 }, true, ["encrypt", "decrypt"]);
}

if (exportWorkspaceBtnSidebar) {
    exportWorkspaceBtnSidebar.addEventListener('click', async () => {
        if (!roomApi) { logStatus("You must be in a workspace to export.", true); return; }
        const password = prompt("Enter a password to encrypt the workspace data (this is for the file, not the workspace access password):");
        if (!password) { logStatus("Export cancelled: No password provided.", true); return; }

        try {
            logStatus("Exporting workspace...");
            const shareData = getShareableData(); // This now calls the coordinator in share.js

            const workspaceState = {
                ...shareData, // shareData now includes kanban, whiteboard, documents from their respective modules via share.js
                roomId: currentRoomId,
                version: APP_ID 
            };
            const serializedState = JSON.stringify(workspaceState);
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const derivedKey = await deriveKeyFromPassword_ImportExport(password, salt);
            const encryptedData = await crypto.subtle.encrypt({ name: CRYPTO_ALGO, iv: iv }, derivedKey, textEncoder.encode(serializedState));
            const combinedBuffer = new Uint8Array(salt.byteLength + iv.byteLength + encryptedData.byteLength);
            combinedBuffer.set(salt, 0); combinedBuffer.set(iv, salt.byteLength); combinedBuffer.set(new Uint8Array(encryptedData), salt.byteLength + iv.byteLength);
            const blob = new Blob([combinedBuffer], { type: "application/octet-stream" });
            const fileName = `PeerSuite_Workspace_${currentRoomId || 'backup'}_${new Date().toISOString().slice(0, 10)}.peersuite_encrypted`;
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileName;
            document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
            logStatus(`Workspace exported successfully as ${fileName}.`);
        } catch (error) { console.error("Error exporting workspace:", error); logStatus("Error exporting workspace: " + error.message, true); }
    });
}

if (importWorkspaceBtn) {
    importWorkspaceBtn.addEventListener('click', () => { if(importFilePicker) importFilePicker.click(); });
}
if (importFilePicker) {
    importFilePicker.addEventListener('change', async (event) => {
        const file = event.target.files[0]; if (!file) return;
        const password = prompt(`Enter password for workspace file "${file.name}" (this decrypts the file content):`);
        if (!password) { logStatus("Import cancelled: No password provided.", true); importFilePicker.value = ''; return; }
        logStatus(`Importing workspace from ${file.name}...`);
        try {
            const fileBuffer = await file.arrayBuffer();
            const salt = new Uint8Array(fileBuffer, 0, 16); const iv = new Uint8Array(fileBuffer, 16, 12); const encryptedPayload = fileBuffer.slice(16 + 12);
            const derivedKey = await deriveKeyFromPassword_ImportExport(password, salt);
            const decryptedBuffer = await crypto.subtle.decrypt({ name: CRYPTO_ALGO, iv: iv }, derivedKey, encryptedPayload);
            const decryptedStateString = textDecoder.decode(decryptedBuffer);
            importedWorkspaceState = JSON.parse(decryptedStateString);

            // Check for presence of new top-level keys expected from the refactored structure
            if (!importedWorkspaceState ||
                typeof importedWorkspaceState.kanbanData === 'undefined' || 
                typeof importedWorkspaceState.whiteboardHistory === 'undefined' ||
                typeof importedWorkspaceState.documents === 'undefined' || 
                typeof importedWorkspaceState.currentActiveDocumentId === 'undefined' ||
                typeof importedWorkspaceState.channels === 'undefined' || // chatHistory is also implicitly checked by structure
                typeof importedWorkspaceState.chatHistory === 'undefined' 
            ) {
                throw new Error("Invalid or incomplete workspace file structure (post-refactor).");
            }
            if (importedWorkspaceState.roomId && roomIdInput && !roomIdInput.value) { roomIdInput.value = importedWorkspaceState.roomId; }
            logStatus(`Workspace "${file.name}" decrypted and ready. Enter workspace password and create/join to apply.`);
            if(statusDiv) statusDiv.textContent += ` (Imported ${importedWorkspaceState.roomId || 'workspace data'})`;
        } catch (error) { console.error("Error importing workspace:", error); logStatus("Error importing: " + (error.message.includes("decrypt") ? "Incorrect password or corrupted file." : error.message), true); importedWorkspaceState = null;
        } finally { importFilePicker.value = ''; }
    });
}


// --- Room Lifecycle & P2P Setup ---
async function joinRoomAndSetup() {
    localNickname = nicknameInput.value.trim();
    if (!localNickname) {
        logStatus("Please enter a nickname.", true);
        return;
    }

    const roomPassword = roomPasswordInput.value;
    if (!roomPassword) {
        logStatus("Workspace password is required.", true);
        if(createPartyBtn) createPartyBtn.disabled = false;
        if(joinWorkspaceBtn) joinWorkspaceBtn.disabled = false;
        if(nicknameInput) nicknameInput.disabled = false;
        if(roomIdInput) roomIdInput.disabled = false;
        if(roomPasswordInput) roomPasswordInput.disabled = false;
        if(joinPasswordInput) joinPasswordInput.disabled = false;
        if(importWorkspaceBtn) importWorkspaceBtn.disabled = false;
        return;
    }

    let roomIdToJoin = roomIdInput.value.trim();

    if (isHost) {
        if (!roomIdToJoin) {
             if (importedWorkspaceState && importedWorkspaceState.roomId) {
                roomIdToJoin = importedWorkspaceState.roomId;
            } else {
                roomIdToJoin = generateMemorableRoomCode();
            }
        }
        if(roomIdInput) roomIdInput.value = roomIdToJoin;
    } else {
        if (!roomIdToJoin) {
            logStatus("Room Code is required to join a workspace.", true);
            if(createPartyBtn) createPartyBtn.disabled = false;
            if(joinWorkspaceBtn) joinWorkspaceBtn.disabled = false;
            if(nicknameInput) nicknameInput.disabled = false;
            if(roomIdInput) roomIdInput.disabled = false;
            if(roomPasswordInput) roomPasswordInput.disabled = false;
            if(joinPasswordInput) joinPasswordInput.disabled = false;
            if(importWorkspaceBtn) importWorkspaceBtn.disabled = false;
            return;
        }
    }

    const sanitizedRoomId = roomIdToJoin.toLowerCase().replace(/[\s,]+/g, '-');
    if (roomIdToJoin !== sanitizedRoomId) {
        logStatus(`Using sanitized Room Code: ${sanitizedRoomId}`);
        if(roomIdInput) roomIdInput.value = sanitizedRoomId;
    }
    currentRoomId = sanitizedRoomId;

    logStatus(`Connecting to Workspace: ${currentRoomId} as ${localNickname}...`);
    if(confirmCreateBtn) confirmCreateBtn.disabled = true;
    if(confirmJoinBtn) confirmJoinBtn.disabled = true;
    if(createPartyBtn) createPartyBtn.disabled = true;
    if(joinWorkspaceBtn) joinWorkspaceBtn.disabled = true;
    if(nicknameInput) nicknameInput.disabled = true;
    if(roomIdInput) roomIdInput.disabled = true;
    if(roomPasswordInput) roomPasswordInput.disabled = true;
    if(joinPasswordInput) joinPasswordInput.disabled = true;
    if(importWorkspaceBtn) importWorkspaceBtn.disabled = true;

    try {
        const config = { appId: APP_ID, password: roomPassword };
        roomApi = await joinRoom(config, currentRoomId);
        logStatus(`Joined workspace: ${currentRoomId}. My Peer ID: ${localGeneratedPeerId.substring(0, 8)}`);

        // Initialize Trystero actions
        [sendChatMessage, onChatMessage] = roomApi.makeAction('chatMsg');
        [sendNickname, onNickname] = roomApi.makeAction('nick');
        [sendPrivateMessage, onPrivateMessage] = roomApi.makeAction('privMsg');
        [sendFileMeta, onFileMeta] = roomApi.makeAction('fileMeta');
        [sendFileChunk, onFileChunk] = roomApi.makeAction('fileChunk', true);
        [sendDrawCommand, onDrawCommand] = roomApi.makeAction('drawCmd');
        [sendInitialWhiteboard, onInitialWhiteboard] = roomApi.makeAction('initWb');
        [sendKanbanUpdate, onKanbanUpdate] = roomApi.makeAction('kanbanUpd');
        [sendInitialKanban, onInitialKanban] = roomApi.makeAction('initKb');
        [sendChatHistory, onChatHistory] = roomApi.makeAction('chatHist');
        [sendInitialDocuments, onInitialDocuments] = roomApi.makeAction('initDocs');
        [sendCreateDocument, onCreateDocument] = roomApi.makeAction('newDoc');
        [sendRenameDocument, onRenameDocument] = roomApi.makeAction('renDoc');
        [sendDeleteDocument, onDeleteDocument] = roomApi.makeAction('delDoc');
        [sendDocumentContentUpdate, onDocumentContentUpdate] = roomApi.makeAction('docUpd');
        [sendCreateChannel, onCreateChannel] = roomApi.makeAction('createChan'); 
        [sendInitialChannels, onInitialChannels] = roomApi.makeAction('initChans'); 

        const shareModuleDeps = {
            // Chat, File, Channel related actions (managed by share.js)
            sendChatMessage, sendPrivateMessage, sendFileMeta, sendFileChunk,
            sendChatHistory, sendCreateChannel, sendInitialChannels,
            // Actions for sub-modules (passed through share.js to them)
            sendDrawCommand, sendInitialWhiteboard, 
            sendKanbanUpdate, sendInitialKanban,
            sendInitialDocuments, sendCreateDocument, sendRenameDocument,
            sendDeleteDocument, sendDocumentContentUpdate,
            // General dependencies
            logStatus, showNotification,
            localGeneratedPeerId,
            getPeerNicknames: () => peerNicknames,
            getIsHost: () => isHost,
            getLocalNickname: () => localNickname,
            findPeerIdByNicknameFnc: findPeerIdByNickname,
            getImportedWorkspaceState: () => importedWorkspaceState, // For initial load in share.js
            clearImportedWorkspaceState: () => { importedWorkspaceState = null; },
            currentRoomId: currentRoomId,
        };
        window.shareModuleRef = initShareFeatures(shareModuleDeps); // This now initializes sub-modules too
        
        const mediaModuleDeps = {
            roomApi, logStatus, showNotification,
            localGeneratedPeerId,
            getPeerNicknames: () => peerNicknames,
        };
        window.mediaModuleRef = initMediaFeatures(mediaModuleDeps);

        // Loading imported state is now handled within initShareFeatures
        if (importedWorkspaceState && isHost) {
            // loadShareableData will be called inside initShareFeatures if importedWorkspaceState is present.
            // The log message here might be slightly different from the one in initShareFeatures.
            logStatus("Imported workspace state is being applied by the share module for hosting.");
            // importedWorkspaceState is cleared by initShareFeatures after use.
        } else if (isHost && window.shareModuleRef.ensureDefaultDocument) {
            // ensureDefaultDocument is now a method on the document module, exposed via shareModuleRef
            window.shareModuleRef.ensureDefaultDocument();
        }
        
        // Setup Trystero listeners - Callbacks now refer to methods on shareModuleRef,
        // which internally delegate to sub-modules if necessary.
        onChatMessage((data, peerId) => window.shareModuleRef.handleChatMessage(data, peerId));
        onPrivateMessage((data, peerId) => window.shareModuleRef.handlePrivateMessage(data, peerId));
        onFileMeta((data, peerId) => window.shareModuleRef.handleFileMeta(data, peerId));
        onFileChunk((data, peerId, chunkMeta) => window.shareModuleRef.handleFileChunk(data, peerId, chunkMeta));
        
        onDrawCommand((data, peerId) => window.shareModuleRef.handleDrawCommand(data, peerId));
        onInitialWhiteboard((data, peerId) => window.shareModuleRef.handleInitialWhiteboard(data, peerId));
        onKanbanUpdate((data, peerId) => window.shareModuleRef.handleKanbanUpdate(data, peerId));
        onInitialKanban((data, peerId) => window.shareModuleRef.handleInitialKanban(data, peerId));
        
        onChatHistory((data, peerId) => window.shareModuleRef.handleChatHistory(data, peerId));
        onInitialDocuments((data, peerId) => window.shareModuleRef.handleInitialDocuments(data, peerId));
        onCreateDocument((data, peerId) => window.shareModuleRef.handleCreateDocument(data, peerId));
        onRenameDocument((data, peerId) => window.shareModuleRef.handleRenameDocument(data, peerId));
        onDeleteDocument((data, peerId) => window.shareModuleRef.handleDeleteDocument(data, peerId));
        onDocumentContentUpdate((data, peerId) => window.shareModuleRef.handleDocumentContentUpdate(data, peerId));
        
        onCreateChannel((data, peerId) => window.shareModuleRef.handleCreateChannel(data, peerId)); 
        onInitialChannels((data, peerId) => window.shareModuleRef.handleInitialChannels(data, peerId)); 

        onNickname(async (nicknameData, peerId) => {
            const { nickname, initialJoin, isHost: peerIsHost } = nicknameData;
            const oldNickname = peerNicknames[peerId];
            peerNicknames[peerId] = nickname;
            // setShareModulePeerInfo is a general function in share.js, doesn't need specific sub-module info here.
            if(window.shareModuleRef && setShareModulePeerInfo) setShareModulePeerInfo(peerNicknames);

            if (initialJoin && oldNickname !== nickname) {
                if(window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`${nickname}${peerIsHost ? ' (Host)' : ''} has joined.`);
                if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: false, isHost: isHost }, peerId);
            } else if (oldNickname && oldNickname !== nickname) {
                 if(window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`${oldNickname} is now known as ${nickname}.`);
            }
            updateUserList();
             if (window.mediaModuleRef && window.mediaModuleRef.updatePeerNicknameInUI) {
                window.mediaModuleRef.updatePeerNicknameInUI(peerId, nickname);
            }
        });

        roomApi.onPeerJoin(async (joinedPeerId) => {
            logStatus(`Peer ${joinedPeerId.substring(0, 8)}... joined.`);
            if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: true, isHost: isHost }, joinedPeerId);
            
            if (window.mediaModuleRef && typeof setupMediaForNewPeer === 'function') setupMediaForNewPeer(joinedPeerId);

            if (isHost && window.shareModuleRef && window.shareModuleRef.sendFullStateToPeer) { 
                 window.shareModuleRef.sendFullStateToPeer(joinedPeerId); // This now sends state from all sub-modules
            }
        });

        roomApi.onPeerLeave(leftPeerId => {
            const departedUser = peerNicknames[leftPeerId] || `Peer ${leftPeerId.substring(0, 6)}`;
            if(window.shareModuleRef && window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`${departedUser} has left.`);
            delete peerNicknames[leftPeerId];
            updateUserList();
            if(window.shareModuleRef && typeof setShareModulePeerInfo === 'function') setShareModulePeerInfo(peerNicknames);
            // handleShareModulePeerLeave in share.js handles general cleanup (like file transfers)
            if(typeof handleShareModulePeerLeave === 'function') handleShareModulePeerLeave(leftPeerId); 
            if (window.mediaModuleRef && typeof cleanupMediaForPeer === 'function') cleanupMediaForPeer(leftPeerId);
        });

        roomApi.onPeerStream((stream, peerId, metadata) => {
            if (window.mediaModuleRef && typeof handleMediaPeerStream === 'function') handleMediaPeerStream(stream, peerId, metadata);
        });

        if(setupSection) setupSection.classList.add('hidden');
        if(statusDiv) statusDiv.classList.add('hidden');
        if(inRoomInterface) inRoomInterface.classList.remove('hidden');
        if(currentRoomCodeSpan) currentRoomCodeSpan.textContent = currentRoomId;
        if(currentNicknameSpan) currentNicknameSpan.textContent = localNickname;
        
        // updateChatMessageInputPlaceholder is handled by share.js internally via setActiveChannel

        if (window.mediaModuleRef && window.mediaModuleRef.enableMediaButtons) window.mediaModuleRef.enableMediaButtons();

        if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: true, isHost: isHost }, Object.keys(roomApi.getPeers()).filter(p => p !== localGeneratedPeerId));
        updateUserList();
        if(window.shareModuleRef && typeof setShareModulePeerInfo === 'function') setShareModulePeerInfo(peerNicknames);

        if(window.shareModuleRef && window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`You joined workspace: ${currentRoomId} as ${localNickname}${isHost ? ' (Host)' : ''}.`);

        const shareModule = window.shareModuleRef;
        if (shareModule) { 
            // These calls will now be delegated by share.js to the respective modules
            if (currentActiveSection === 'whiteboardSection' && shareModule.resizeWhiteboardAndRedraw) {
                 shareModule.resizeWhiteboardAndRedraw();
            } else if (shareModule.redrawWhiteboardFromHistoryIfVisible) { 
                shareModule.redrawWhiteboardFromHistoryIfVisible(true); 
            }

            if (currentActiveSection === 'kanbanSection' && shareModule.renderKanbanBoardIfActive) {
                shareModule.renderKanbanBoardIfActive();
            } else if (shareModule.renderKanbanBoardIfActive) { // Check if method exists before calling
                 shareModule.renderKanbanBoardIfActive(true); 
            }
            if (currentActiveSection === 'documentsSection' && shareModule.renderDocumentsIfActive) {
                 shareModule.renderDocumentsIfActive();
            } else if (shareModule.renderDocumentsIfActive) {
                shareModule.renderDocumentsIfActive(true); 
            }
        }

    } catch (error) {
        console.error("Error during room join or Trystero setup:", error);
        logStatus(`Error: ${error.message}. Could be incorrect password or network issue. Please try again.`, true);
        resetToSetupState();
    }
}

async function leaveRoomAndCleanup() {
    logStatus("Leaving workspace...");
    if (window.mediaModuleRef && typeof stopAllLocalMedia === 'function') await stopAllLocalMedia(false);

    if (roomApi) {
        try { await roomApi.leave(); logStatus("Left workspace successfully."); } 
        catch (e) { console.warn("Error leaving room:", e); }
    }
    roomApi = null;
    // Nullify all Trystero actions
    sendChatMessage = onChatMessage = sendNickname = onNickname = sendPrivateMessage = onPrivateMessage = null;
    sendFileMeta = onFileMeta = sendFileChunk = onFileChunk = null;
    sendDrawCommand = onDrawCommand = sendInitialWhiteboard = onInitialWhiteboard = null;
    sendKanbanUpdate = onKanbanUpdate = sendInitialKanban = onInitialKanban = null;
    sendChatHistory = onChatHistory = null;
    sendInitialDocuments = onInitialDocuments = sendCreateDocument = onCreateDocument = null;
    sendRenameDocument = onRenameDocument = sendDeleteDocument = onDeleteDocument = null;
    sendDocumentContentUpdate = onDocumentContentUpdate = null;
    sendCreateChannel = onCreateChannel = null; 
    sendInitialChannels = onInitialChannels = null; 

    resetToSetupState();
}

function resetToSetupState() {
    if(inRoomInterface) inRoomInterface.classList.add('hidden');
    if(setupSection) setupSection.classList.remove('hidden');
    if(statusDiv) statusDiv.classList.remove('hidden');

    // Reset main buttons
    if(createPartyBtn) createPartyBtn.disabled = false;
    if(joinWorkspaceBtn) joinWorkspaceBtn.disabled = false;
    if(importWorkspaceBtn) importWorkspaceBtn.disabled = false;
    
    // Reset and hide the conditional fields
    if(createWorkspaceFields) createWorkspaceFields.classList.add('hidden');
    if(joinWorkspaceFields) joinWorkspaceFields.classList.add('hidden');
    
    // Reset all form fields
    if(nicknameInput) nicknameInput.disabled = false;
    if(roomIdInput) { roomIdInput.disabled = false; roomIdInput.value = ''; }
    if(roomPasswordInput) { roomPasswordInput.disabled = false; roomPasswordInput.value = ''; }
    if(joinPasswordInput) { joinPasswordInput.disabled = false; joinPasswordInput.value = ''; }

    if (window.mediaModuleRef && window.mediaModuleRef.resetMediaUIAndState) window.mediaModuleRef.resetMediaUIAndState();
    
    // resetShareModuleStates in share.js now calls reset functions for each sub-module
    if (window.shareModuleRef && typeof resetShareModuleStates === 'function') {
        resetShareModuleStates(); 
        if (window.shareModuleRef.hideEmojiPicker) window.shareModuleRef.hideEmojiPicker(); // Emoji picker is chat-specific
    }

    if(userListUl) userListUl.innerHTML = '';
    if (userCountSpan) userCountSpan.textContent = '0';

    logStatus('Enter username and choose an action: Create, Join, or Import a workspace.');

    sidebarButtons.forEach(btn => {
        if (btn.id !== 'exportWorkspaceBtnSidebar') btn.classList.remove('active');
        clearNotification(btn.dataset.section);
    });
    contentSections.forEach(section => section.classList.add('hidden'));

    const defaultSectionButton = document.querySelector('.sidebar-button[data-section="chatSection"]');
    const defaultSection = document.getElementById('chatSection');
    if (defaultSectionButton) defaultSectionButton.classList.add('active');
    if (defaultSection) defaultSection.classList.remove('hidden');
    currentActiveSection = 'chatSection';

    peerNicknames = {};
    isHost = false;
    currentRoomId = '';
    importedWorkspaceState = null; // Ensure this is cleared
}

// --- Event Listeners for Main Controls ---
if (createPartyBtn) {
    createPartyBtn.addEventListener('click', () => {
        // Hide join fields if visible
        if (joinWorkspaceFields) joinWorkspaceFields.classList.add('hidden');
        // Show create fields
        if (createWorkspaceFields) createWorkspaceFields.classList.remove('hidden');
        // Focus password field
        if (roomPasswordInput) roomPasswordInput.focus();
    });
}

if (joinWorkspaceBtn) {
    joinWorkspaceBtn.addEventListener('click', () => {
        // Hide create fields if visible
        if (createWorkspaceFields) createWorkspaceFields.classList.add('hidden');
        // Show join fields
        if (joinWorkspaceFields) joinWorkspaceFields.classList.remove('hidden');
        // Focus room code field
        if (roomIdInput) roomIdInput.focus();
    });
}

if (confirmCreateBtn) {
    confirmCreateBtn.addEventListener('click', () => {
        isHost = true;
        joinRoomAndSetup();
    });
}

if (confirmJoinBtn) {
    confirmJoinBtn.addEventListener('click', () => {
        isHost = false;
        // Copy join password to main password field for compatibility
        if (joinPasswordInput && roomPasswordInput) {
            roomPasswordInput.value = joinPasswordInput.value;
        }
        joinRoomAndSetup();
    });
}

if (cancelCreateBtn) {
    cancelCreateBtn.addEventListener('click', () => {
        if (createWorkspaceFields) createWorkspaceFields.classList.add('hidden');
        if (roomPasswordInput) roomPasswordInput.value = '';
    });
}

if (cancelJoinBtn) {
    cancelJoinBtn.addEventListener('click', () => {
        if (joinWorkspaceFields) joinWorkspaceFields.classList.add('hidden');
        if (roomIdInput) roomIdInput.value = '';
        if (joinPasswordInput) joinPasswordInput.value = '';
    });
}

if (copyRoomCodeBtn) {
    copyRoomCodeBtn.addEventListener('click', () => {
        if (currentRoomId) {
            navigator.clipboard.writeText(currentRoomId)
                .then(() => {
                    const originalText = copyRoomCodeBtn.textContent;
                    copyRoomCodeBtn.textContent = '✅';
                    copyRoomCodeBtn.title = 'Copied!';
                    setTimeout(() => {
                        copyRoomCodeBtn.textContent = '📋';
                        copyRoomCodeBtn.title = 'Copy Room Code';
                    }, 1500);
                })
                .catch(err => {
                    logStatus('Failed to copy room code.', true);
                });
        }
    });
}

const savedNickname = localStorage.getItem('viewPartyNickname');
if (savedNickname && nicknameInput) nicknameInput.value = savedNickname;
if (nicknameInput) {
    nicknameInput.addEventListener('input', () => {
        localStorage.setItem('viewPartyNickname', nicknameInput.value.trim());
    });
}

// Check browser capabilities
if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    console.warn("Screen sharing not supported by your browser.");
}
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn("Video/Audio capture not supported by your browser.");
}

// Initial state
resetToSetupState(); // This also handles UI for initial setup.
// initializeEmojiPicker is called within share.js's initChat if emoji elements are present.