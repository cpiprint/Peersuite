import { joinRoom, selfId as localGeneratedPeerId } from './trystero-torrent.min.js';

const APP_ID = 'PeerSuite-0.0.8-multidocfix';

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

// DOM Elements
const setupSection = document.getElementById('setupSection');
const inRoomInterface = document.getElementById('inRoomInterface');
const nicknameInput = document.getElementById('nicknameInput');
const roomIdInput = document.getElementById('roomIdInput');
const roomPasswordInput = document.getElementById('roomPasswordInput');
const createPartyBtn = document.getElementById('createPartyBtn');
const joinLeaveRoomBtn = document.getElementById('joinLeaveRoomBtn');
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
const chatArea = document.getElementById('chatArea');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const userListUl = document.getElementById('userList');
const emojiIcon = document.querySelector('.emoji-icon');
const emojiPickerPopup = document.getElementById('emojiPickerPopup');
const triggerFileInput = document.getElementById('triggerFileInput');
const chatFileInput = document.getElementById('chatFileInput');

const startShareBtn = document.getElementById('startShareBtn');
const stopShareBtn = document.getElementById('stopShareBtn');
const remoteVideosContainer = document.getElementById('remoteVideosContainer');

const videoChatSection = document.getElementById('videoChatSection');
const startVideoCallBtn = document.getElementById('startVideoCallBtn');
const stopVideoCallBtn = document.getElementById('stopVideoCallBtn');
const localVideoContainer = document.getElementById('localVideoContainer');
const localVideo = document.getElementById('localVideo');
const remoteVideoChatContainer = document.getElementById('remoteVideoChatContainer');

const audioChatSection = document.getElementById('audioChatSection');
const startAudioCallBtn = document.getElementById('startAudioCallBtn');
const stopAudioCallBtn = document.getElementById('stopAudioCallBtn');
const audioChatStatus = document.getElementById('audioChatStatus');

const whiteboardCanvas = document.getElementById('whiteboardCanvas');
const wbColorPicker = document.getElementById('wbColorPicker');
const wbLineWidth = document.getElementById('wbLineWidth');
const wbModeToggle = document.getElementById('wbModeToggle');
const wbClearBtn = document.getElementById('wbClearBtn');
let wbCtx, wbIsDrawing = false, wbLastX, wbLastY, wbMode = 'draw';
let whiteboardHistory = [];

const kanbanBoard = document.getElementById('kanbanBoard');
const newColumnNameInput = document.getElementById('newColumnNameInput');
const addColumnBtn = document.getElementById('addColumnBtn');

const documentsSection = document.getElementById('documentsSection');
const documentListDiv = document.getElementById('documentList');
const newDocBtn = document.getElementById('newDocBtn');
const renameDocBtn = document.getElementById('renameDocBtn');
const deleteDocBtn = document.getElementById('deleteDocBtn');
const collaborativeEditor = document.getElementById('collaborativeEditor');
const docBoldBtn = document.getElementById('docBoldBtn');
const docItalicBtn = document.getElementById('docItalicBtn');
const docUnderlineBtn = document.getElementById('docUnderlineBtn');
const docUlBtn = document.getElementById('docUlBtn');
const docOlBtn = document.getElementById('docOlBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
// const downloadPdfBtn = document.getElementById('downloadPdfBtn'); // Removed

// Global State
let roomApi;
let localScreenShareStream;
let localVideoCallStream;
let localAudioStream;
let localNickname = '';
let currentRoomId = '';
let currentActiveSection = 'chatSection';
let peerNicknames = {};
let isHost = false;
let importedWorkspaceState = null;
let chatHistory = [];

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

let incomingFileBuffers = new Map();
let kanbanData = { columns: [] };
let peerVideoElements = {};
let peerAudios = {}; 

let documents = [];
let currentActiveDocumentId = null;

const CRYPTO_ALGO = 'AES-GCM';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function initTheme() { const savedTheme = localStorage.getItem('viewPartyTheme') || 'light'; document.documentElement.setAttribute('data-theme', savedTheme); themeToggle.checked = savedTheme === 'dark'; redrawWhiteboardFromHistory(); }
themeToggle.addEventListener('change', () => { const newTheme = themeToggle.checked ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', newTheme); localStorage.setItem('viewPartyTheme', newTheme); redrawWhiteboardFromHistory(); });
initTheme();

sidebarButtons.forEach(button => {
    if (button.id === 'exportWorkspaceBtnSidebar') return;
    button.addEventListener('click', () => {
        const targetSectionId = button.getAttribute('data-section');
        if (currentActiveSection === targetSectionId && document.getElementById(targetSectionId) && !document.getElementById(targetSectionId).classList.contains('hidden')) {
            return;
        }
        sidebarButtons.forEach(btn => { if (btn.id !== 'exportWorkspaceBtnSidebar') btn.classList.remove('active'); });
        button.classList.add('active');
        currentActiveSection = targetSectionId;
        contentSections.forEach(section => {
            section.classList.toggle('hidden', section.id !== targetSectionId);
        });
        clearNotification(targetSectionId);
        if (targetSectionId === 'whiteboardSection' && wbCtx) {
            resizeWhiteboardCanvas();
            if (whiteboardHistory.length > 0 && whiteboardCanvas.offsetParent) {
                redrawWhiteboardFromHistory();
            }
        }
        if (targetSectionId === 'kanbanSection') {
            renderKanbanBoard();
        }
        if (targetSectionId === 'documentsSection' && roomApi) {
            renderDocumentList();
            loadActiveDocumentContent();
        }
    });
});

function showNotification(sectionId) {
    if (sectionId === currentActiveSection &&
        document.getElementById(sectionId) &&
        !document.getElementById(sectionId).classList.contains('hidden')) {
        return;
    }
    const dot = document.querySelector(`.notification-dot[data-notification-for="${sectionId}"]`);
    if (dot) dot.classList.remove('hidden');
}
function clearNotification(sectionId) {
    const dot = document.querySelector(`.notification-dot[data-notification-for="${sectionId}"]`);
    if (dot) dot.classList.add('hidden');
}

const emojis = ['😊', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '👋', '✅', '🤔', '😢', '😮', '😭', '😍', '💯', '🌟', '✨', '🎁', '🎈', '🎂', '🍕', '🚀', '💡', '🤷', '🤦'];
function populateEmojiPicker() { emojiPickerPopup.innerHTML = ''; emojis.forEach(emoji => { const emojiSpan = document.createElement('span'); emojiSpan.textContent = emoji; emojiSpan.setAttribute('role', 'button'); emojiSpan.title = `Insert ${emoji}`; emojiSpan.addEventListener('click', () => { insertEmojiIntoInput(emoji); emojiPickerPopup.classList.add('hidden'); }); emojiPickerPopup.appendChild(emojiSpan); }); }
function insertEmojiIntoInput(emoji) { const cursorPos = messageInput.selectionStart; const textBefore = messageInput.value.substring(0, cursorPos); const textAfter = messageInput.value.substring(cursorPos); messageInput.value = textBefore + emoji + textAfter; messageInput.focus(); const newCursorPos = cursorPos + emoji.length; messageInput.setSelectionRange(newCursorPos, newCursorPos); }
emojiIcon.addEventListener('click', (event) => { event.stopPropagation(); const isHidden = emojiPickerPopup.classList.toggle('hidden'); if (!isHidden && emojiPickerPopup.children.length === 0) { populateEmojiPicker(); } messageInput.focus(); });
document.addEventListener('click', (event) => { if (!emojiPickerPopup.classList.contains('hidden') && !emojiPickerPopup.contains(event.target) && event.target !== emojiIcon) { emojiPickerPopup.classList.add('hidden'); } });

function logStatus(message, isError = false) { console.log(message); if (statusDiv) { statusDiv.textContent = message; statusDiv.style.color = isError ? 'var(--danger-color)' : 'var(--text-primary)'; } }
function generateMemorableRoomCode() { const selectedWords = []; for (let i = 0; i < 4; i++) { selectedWords.push(wordList[Math.floor(Math.random() * wordList.length)]); } return selectedWords.join('-'); }

function displayMessage(msgObject, isSelf = false, isSystem = false) {
    const { senderNickname, message, pmInfo, fileMeta, timestamp } = msgObject;
    const messageDiv = document.createElement('div'); messageDiv.classList.add('message');
    const displayTimestamp = timestamp ? new Date(timestamp) : new Date();
    const hours = String(displayTimestamp.getHours()).padStart(2, '0');
    const minutes = String(displayTimestamp.getMinutes()).padStart(2, '0');
    const timestampStr = `${hours}:${minutes}`;
    const timestampSpan = document.createElement('span'); timestampSpan.classList.add('timestamp'); timestampSpan.textContent = timestampStr;

    if (isSystem) { messageDiv.classList.add('system-message'); messageDiv.appendChild(document.createTextNode(message + " "));
    } else if (pmInfo) { messageDiv.classList.add('pm'); messageDiv.classList.add(isSelf ? 'self' : 'other'); const pmContextSpan = document.createElement('span'); pmContextSpan.classList.add('pm-info'); pmContextSpan.textContent = pmInfo.type === 'sent' ? `To ${pmInfo.recipient}:` : `From ${pmInfo.sender}:`; messageDiv.appendChild(pmContextSpan); messageDiv.appendChild(document.createTextNode(message + " "));
    } else if (fileMeta) { messageDiv.classList.add(isSelf ? 'self' : 'other'); messageDiv.classList.add('file-message'); const senderSpan = document.createElement('span'); senderSpan.classList.add('sender'); senderSpan.textContent = isSelf ? 'You' : senderNickname; messageDiv.appendChild(senderSpan); const fileInfoSpan = document.createElement('span'); fileInfoSpan.innerHTML = `Shared a file: <strong>${fileMeta.name}</strong> (${(fileMeta.size / 1024).toFixed(2)} KB) `; messageDiv.appendChild(fileInfoSpan); if (fileMeta.blobUrl) { const downloadLink = document.createElement('a'); downloadLink.href = fileMeta.blobUrl; downloadLink.download = fileMeta.name; downloadLink.textContent = 'Download'; messageDiv.appendChild(downloadLink); } else if (fileMeta.receiving) { const progressSpan = document.createElement('span'); progressSpan.id = `file-progress-${senderNickname}-${fileMeta.name.replace(/\W/g, '')}`; progressSpan.textContent = ` (Receiving 0%)`; messageDiv.appendChild(progressSpan); }
    } else { messageDiv.classList.add(isSelf ? 'self' : 'other'); const senderSpan = document.createElement('span'); senderSpan.classList.add('sender'); senderSpan.textContent = isSelf ? 'You' : senderNickname; messageDiv.appendChild(senderSpan); messageDiv.appendChild(document.createTextNode(message + " ")); }

    messageDiv.appendChild(timestampSpan); chatArea.appendChild(messageDiv); chatArea.scrollTop = chatArea.scrollHeight;
    if (!isSelf && !isSystem && !msgObject.isHistorical) showNotification('chatSection');
}

function addMessageToHistoryAndDisplay(msgData, isSelf = false, isSystem = false) {
    const fullMsgObject = {
        ...msgData,
        timestamp: msgData.timestamp || Date.now(),
        senderPeerId: isSelf ? localGeneratedPeerId : msgData.senderPeerId
    };
    chatHistory.push(fullMsgObject);
    displayMessage(fullMsgObject, isSelf, isSystem);
}

function updateUserList() {
    userListUl.innerHTML = ''; let count = 0;
    const selfLi = document.createElement('li'); selfLi.innerHTML = `<span class="status-badge"></span> ${localNickname} (You)${isHost ? ' (Host)' : ''}`; userListUl.appendChild(selfLi); count++;
    for (const peerId in peerNicknames) { const nickname = peerNicknames[peerId]; const li = document.createElement('li'); li.innerHTML = `<span class="status-badge"></span> ${nickname}`; li.classList.add('peer-name'); li.title = `Click to private message ${nickname}`; li.dataset.peerId = peerId; li.addEventListener('click', () => { messageInput.value = `/pm ${nickname} `; messageInput.focus(); }); userListUl.appendChild(li); count++; }
    userCountSpan.textContent = count;
}
function findPeerIdByNickname(nickname) { for (const id in peerNicknames) { if (peerNicknames[id].toLowerCase() === nickname.toLowerCase()) { return id; } } return null; }

function displayRemoteScreenShareStream(stream, peerId) {
    const streamPeerNickname = peerNicknames[peerId] || `Peer ${peerId.substring(0, 6)}`;
    logStatus(`Receiving Screen Share from ${streamPeerNickname}.`);
    if (!(stream instanceof MediaStream)) { console.error("displayRemoteScreenShareStream called with non-MediaStream object:", stream); logStatus(`Error: Received invalid screen share stream data from ${streamPeerNickname}.`); return; }
    let videoContainer = document.getElementById(`container-screenshare-${peerId}`);
    let remoteVideo = document.getElementById(`video-screenshare-${peerId}`);
    if (!videoContainer) {
        videoContainer = document.createElement('div'); videoContainer.id = `container-screenshare-${peerId}`; videoContainer.classList.add('remoteVideoContainer');
        const peerInfo = document.createElement('p'); peerInfo.textContent = `Screen from: ${streamPeerNickname}`; videoContainer.appendChild(peerInfo);
        remoteVideo = document.createElement('video'); remoteVideo.id = `video-screenshare-${peerId}`; remoteVideo.autoplay = true; remoteVideo.playsinline = true; remoteVideo.classList.add('remoteVideo'); videoContainer.appendChild(remoteVideo);
        const maximizeBtn = document.createElement('button'); maximizeBtn.textContent = 'Maximize'; maximizeBtn.classList.add('maximize-btn');
        maximizeBtn.onclick = () => { if (remoteVideo.requestFullscreen) remoteVideo.requestFullscreen(); else if (remoteVideo.mozRequestFullScreen) remoteVideo.mozRequestFullScreen(); else if (remoteVideo.webkitRequestFullscreen) remoteVideo.webkitRequestFullscreen(); else if (remoteVideo.msRequestFullscreen) remoteVideo.msRequestFullscreen(); };
        videoContainer.appendChild(maximizeBtn);
        remoteVideosContainer.appendChild(videoContainer);
    }
    if (remoteVideo.srcObject !== stream) { remoteVideo.srcObject = stream; }
    stream.onremovetrack = () => { if (stream.getTracks().length === 0 && remoteVideo) remoteVideo.srcObject = null; };
    stream.getTracks().forEach(track => { track.onended = () => { if ((!stream.active || stream.getTracks().every(t => t.readyState === 'ended')) && remoteVideo) { remoteVideo.srcObject = null; } }; });
    showNotification('screenShareSection');
}

function handleIncomingVideoChatStream(stream, peerId) {
    if (peerId === localGeneratedPeerId) return;
    const streamPeerNickname = peerNicknames[peerId] || `User ${peerId.substring(0, 6)}`;
    logStatus(`Receiving Video Chat stream from ${streamPeerNickname}.`);

    let peerElement = peerVideoElements[peerId];
    if (!peerElement) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('remote-video-wrapper');
        wrapper.id = `vc-wrapper-${peerId}`;

        const nicknameP = document.createElement('p');
        nicknameP.textContent = streamPeerNickname;

        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsinline = true;

        wrapper.appendChild(nicknameP);
        wrapper.appendChild(videoEl);
        remoteVideoChatContainer.appendChild(wrapper);
        peerElement = { wrapper, video: videoEl, stream };
        peerVideoElements[peerId] = peerElement;
    }

    if (peerElement.video.srcObject !== stream) {
        peerElement.video.srcObject = stream;
        peerElement.stream = stream;
    }

    stream.onremovetrack = () => {
        if (stream.getTracks().length === 0 && peerVideoElements[peerId]) {
            peerVideoElements[peerId].video.srcObject = null;
            logStatus(`Video chat stream ended from ${streamPeerNickname}`);
        }
    };
    stream.getTracks().forEach(track => {
        track.onended = () => {
            if ((!stream.active || stream.getTracks().every(t => t.readyState === 'ended')) && peerVideoElements[peerId]) {
                peerVideoElements[peerId].video.srcObject = null;
                logStatus(`Video chat track ended from ${streamPeerNickname}`);
            }
        };
    });
    showNotification('videoChatSection');
}

function handleIncomingAudioChatStream(stream, peerId) {
    if (peerId === localGeneratedPeerId) return; 
    const streamPeerNickname = peerNicknames[peerId] || `User ${peerId.substring(0, 6)}`;
    logStatus(`Receiving Audio Chat stream from ${streamPeerNickname}.`);

    if (peerAudios[peerId]) { 
        peerAudios[peerId].pause();
        peerAudios[peerId].srcObject = null;
        delete peerAudios[peerId];
    }

    const audioEl = document.createElement('audio');
    audioEl.srcObject = stream;
    audioEl.autoplay = true; 
    audioEl.addEventListener('canplaythrough', () => {
        audioEl.play().catch(e => console.warn(`Audio play failed for ${streamPeerNickname}:`, e));
    });
    audioEl.addEventListener('error', (e) => {
        console.error(`Error with audio element for ${streamPeerNickname}:`, e);
    });
    peerAudios[peerId] = audioEl;

    stream.onremovetrack = () => {
        if (stream.getTracks().length === 0 && peerAudios[peerId]) {
            peerAudios[peerId].pause();
            peerAudios[peerId].srcObject = null;
            delete peerAudios[peerId];
            logStatus(`Audio chat stream ended from ${streamPeerNickname}`);
        }
    };
    stream.getTracks().forEach(track => {
        track.onended = () => {
             if ((!stream.active || stream.getTracks().every(t => t.readyState === 'ended')) && peerAudios[peerId]) {
                peerAudios[peerId].pause();
                peerAudios[peerId].srcObject = null;
                delete peerAudios[peerId];
                logStatus(`Audio chat track ended from ${streamPeerNickname}`);
            }
        };
    });
    showNotification('audioChatSection');
}


triggerFileInput.addEventListener('click', () => chatFileInput.click());
chatFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0]; if (!file || !roomApi) return;
    logStatus(`Preparing to send file: ${file.name}`);
    const fileMeta = { name: file.name, type: file.type, size: file.size, id: Date.now().toString() };
    addMessageToHistoryAndDisplay({ senderNickname: localNickname, fileMeta: { ...fileMeta, receiving: true } }, true);
    if (sendFileMeta) sendFileMeta(fileMeta);
    const CHUNK_SIZE = 16 * 1024; let offset = 0; const reader = new FileReader();
    reader.onload = (e) => { if (sendFileChunk) sendFileChunk(e.target.result, Object.keys(roomApi.getPeers()), { fileName: fileMeta.name, fileId: fileMeta.id, final: offset >= file.size }); const progressId = `file-progress-${localNickname}-${fileMeta.name.replace(/\W/g, '')}`; const progressElem = document.getElementById(progressId); if (progressElem) progressElem.textContent = ` (Sending ${Math.min(100, Math.round((offset / file.size) * 100))}%)`; if (offset < file.size) { readNextChunk(); } else { logStatus(`File ${file.name} sent.`); if (progressElem) progressElem.textContent = ` (Sent 100%)`; } };
    reader.onerror = (error) => { logStatus(`Error reading file: ${error}`, true); const progressId = `file-progress-${localNickname}-${fileMeta.name.replace(/\W/g, '')}`; const progressElem = document.getElementById(progressId); if (progressElem) progressElem.textContent = ` (Error sending)`; };
    function readNextChunk() { const slice = file.slice(offset, offset + CHUNK_SIZE); reader.readAsArrayBuffer(slice); offset += CHUNK_SIZE; } readNextChunk(); chatFileInput.value = '';
});
function handleIncomingFileMeta(meta, peerId) {
    const senderNickname = peerNicknames[peerId] || `Peer ${peerId.substring(0, 6)}`;
    const bufferKey = `${peerId}_${meta.id}`;
    incomingFileBuffers.set(bufferKey, { meta, chunks: [], receivedBytes: 0 });
    addMessageToHistoryAndDisplay({ senderNickname, fileMeta: { ...meta, receiving: true }, senderPeerId: peerId }, false);
    logStatus(`${senderNickname} is sending file: ${meta.name}`);
}
function handleIncomingFileChunk(chunk, peerId, chunkMeta) {
    const senderNickname = peerNicknames[peerId] || `Peer ${peerId.substring(0, 6)}`;
    const bufferKey = `${peerId}_${chunkMeta.fileId}`;
    const fileBuffer = incomingFileBuffers.get(bufferKey);
    if (fileBuffer) {
        fileBuffer.chunks.push(chunk); fileBuffer.receivedBytes += chunk.byteLength; const progress = Math.round((fileBuffer.receivedBytes / fileBuffer.meta.size) * 100); const progressId = `file-progress-${senderNickname}-${fileBuffer.meta.name.replace(/\W/g, '')}`; const progressElem = document.getElementById(progressId); if (progressElem) progressElem.textContent = ` (Receiving ${progress}%)`; if (chunkMeta.final || fileBuffer.receivedBytes >= fileBuffer.meta.size) {
            const completeFile = new Blob(fileBuffer.chunks, { type: fileBuffer.meta.type }); const blobUrl = URL.createObjectURL(completeFile); chatArea.querySelectorAll('.message.other.file-message').forEach(msgDiv => { const senderSpan = msgDiv.querySelector('.sender'); const fileInfoStrong = msgDiv.querySelector('strong'); if (senderSpan && senderSpan.textContent === senderNickname && fileInfoStrong && fileInfoStrong.textContent === fileBuffer.meta.name) { const existingProgress = msgDiv.querySelector(`#${progressId}`); if (existingProgress) existingProgress.remove(); let downloadLink = msgDiv.querySelector('a'); if (!downloadLink) { downloadLink = document.createElement('a'); msgDiv.appendChild(document.createTextNode(" ")); msgDiv.appendChild(downloadLink); } downloadLink.href = blobUrl; downloadLink.download = fileBuffer.meta.name; downloadLink.textContent = 'Download'; } }); logStatus(`File ${fileBuffer.meta.name} from ${senderNickname} received.`); incomingFileBuffers.delete(bufferKey);
        }
    } else { console.warn(`Received chunk for unknown file: ${chunkMeta.fileName} from ${senderNickname}`); }
}

function initWhiteboard() {
    if (!whiteboardCanvas) return; wbCtx = whiteboardCanvas.getContext('2d'); resizeWhiteboardCanvas();
    wbColorPicker.addEventListener('change', (e) => { if (wbCtx) wbCtx.strokeStyle = e.target.value; });
    wbLineWidth.addEventListener('input', (e) => { if (wbCtx) wbCtx.lineWidth = e.target.value; });
    wbClearBtn.addEventListener('click', clearWhiteboardAndBroadcast);
    wbModeToggle.addEventListener('click', toggleWbMode);
    ['mousedown', 'touchstart'].forEach(evt => whiteboardCanvas.addEventListener(evt, startWbDraw, { passive: false }));
    ['mousemove', 'touchmove'].forEach(evt => whiteboardCanvas.addEventListener(evt, wbDraw, { passive: false }));
    ['mouseup', 'touchend', 'mouseout', 'touchcancel'].forEach(evt => whiteboardCanvas.addEventListener(evt, stopWbDraw));
    if (wbCtx) { wbCtx.strokeStyle = wbColorPicker.value; wbCtx.lineWidth = wbLineWidth.value; wbCtx.lineCap = 'round'; wbCtx.lineJoin = 'round'; }
}
function resizeWhiteboardCanvas() {
    if (!whiteboardCanvas || !whiteboardCanvas.offsetParent) {
        return;
    }
    const displayWidth = whiteboardCanvas.clientWidth;
    const displayHeight = whiteboardCanvas.clientHeight;

    if (displayWidth <= 0 || displayHeight <= 0) {
        return;
    }

    if (whiteboardCanvas.width !== displayWidth || whiteboardCanvas.height !== displayHeight) {
        whiteboardCanvas.width = displayWidth;
        whiteboardCanvas.height = displayHeight;
    }

    redrawWhiteboardFromHistory();
}
window.addEventListener('resize', resizeWhiteboardCanvas);

function getWbEventPosition(event) {
    const rect = whiteboardCanvas.getBoundingClientRect();
    if (event.touches && event.touches.length > 0) { return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top }; }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function startWbDraw(e) {
    if (!wbCtx) return; e.preventDefault(); wbIsDrawing = true; const pos = getWbEventPosition(e); wbLastX = pos.x; wbLastY = pos.y;
    wbCtx.beginPath(); wbCtx.moveTo(wbLastX, wbLastY);
}
function wbDraw(e) {
    if (!wbIsDrawing || !wbCtx) return; e.preventDefault(); const pos = getWbEventPosition(e);
    const currentX = pos.x; const currentY = pos.y;
    const drawCmdData = {
        type: wbMode === 'draw' ? 'draw' : 'erase',
        x0: wbLastX, y0: wbLastY, x1: currentX, y1: currentY,
        color: wbMode === 'draw' ? wbColorPicker.value : '#FFFFFF',
        lineWidth: wbMode === 'draw' ? wbLineWidth.value : Math.max(20, parseFloat(wbLineWidth.value) * 2)
    };
    applyDrawCommand(drawCmdData);
    whiteboardHistory.push(drawCmdData);
    if (sendDrawCommand) sendDrawCommand(drawCmdData);
    if (roomApi && roomApi.getPeers().length > 0) showNotification('whiteboardSection');
    wbLastX = currentX; wbLastY = currentY;
}
function stopWbDraw() {
    if (wbIsDrawing && wbCtx) { wbCtx.closePath(); wbIsDrawing = false; }
}
function applyDrawCommand(cmd) {
    if (!wbCtx) return;
    const originalStrokeStyle = wbCtx.strokeStyle; const originalLineWidth = wbCtx.lineWidth;
    wbCtx.beginPath(); wbCtx.moveTo(cmd.x0, cmd.y0); wbCtx.lineTo(cmd.x1, cmd.y1);
    wbCtx.strokeStyle = cmd.color;
    wbCtx.lineWidth = cmd.lineWidth;
    wbCtx.stroke(); wbCtx.closePath();
    wbCtx.strokeStyle = originalStrokeStyle; wbCtx.lineWidth = originalLineWidth;
}
function clearWhiteboardAndBroadcast() {
    const clearCmd = { type: 'clear' };
    applyClearCommandLocal(clearCmd);
    if (sendDrawCommand) sendDrawCommand(clearCmd);
    if (roomApi && roomApi.getPeers().length > 0) showNotification('whiteboardSection');
}
function applyClearCommandLocal(cmd) {
    if (!wbCtx) return;
    wbCtx.fillStyle = '#FFFFFF';
    wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    whiteboardHistory.push(cmd);
}
function toggleWbMode() {
    wbMode = wbMode === 'draw' ? 'erase' : 'draw'; wbModeToggle.textContent = wbMode === 'draw' ? 'Draw Mode' : 'Erase Mode';
    whiteboardCanvas.style.cursor = wbMode === 'draw' ? 'crosshair' : 'grab';
}
function redrawWhiteboardFromHistory() {
    if (!wbCtx || !whiteboardCanvas.offsetParent) return;
    wbCtx.fillStyle = '#FFFFFF';
    wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    wbCtx.strokeStyle = wbColorPicker.value;
    wbCtx.lineWidth = wbLineWidth.value;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    whiteboardHistory.forEach(cmd => {
        if (cmd.type === 'clear') {
            wbCtx.fillStyle = '#FFFFFF';
            wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
        } else {
            const cmdToApply = { ...cmd };
            if (cmdToApply.type === 'erase') {
                cmdToApply.color = '#FFFFFF';
            }
            applyDrawCommand(cmdToApply);
        }
    });
}

function initKanban() {
    addColumnBtn.addEventListener('click', handleAddKanbanColumn); renderKanbanBoard();
}
function renderKanbanBoard() {
    kanbanBoard.innerHTML = '';
    if (!kanbanData || !kanbanData.columns) {
        kanbanData = { columns: [] };
    }
    kanbanData.columns.forEach(column => {
        const columnDiv = document.createElement('div'); columnDiv.classList.add('kanban-column'); columnDiv.dataset.columnId = column.id;
        columnDiv.innerHTML = `<h3>${column.title}<button class="delete-column-btn" data-column-id="${column.id}" title="Delete column">🗑️</button></h3><div class="kanban-cards">${column.cards.map(card => `<div class="kanban-card" draggable="true" data-card-id="${card.id}" data-parent-column-id="${column.id}"><p>${card.text}</p><button class="delete-card-btn" data-card-id="${card.id}" data-column-id="${column.id}" title="Delete card">❌</button></div>`).join('')}</div><button class="add-card-btn" data-column-id="${column.id}">+ Add Card</button>`;
        kanbanBoard.appendChild(columnDiv);
    });
    kanbanBoard.querySelectorAll('.add-card-btn').forEach(btn => btn.addEventListener('click', () => handleAddKanbanCard(btn.dataset.columnId)));
    kanbanBoard.querySelectorAll('.delete-column-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteKanbanColumn(btn.dataset.columnId)));
    kanbanBoard.querySelectorAll('.delete-card-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteKanbanCard(btn.dataset.columnId, btn.dataset.cardId)));
    kanbanBoard.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('dragstart', handleKanbanDragStart);
        card.addEventListener('dragend', handleKanbanDragEnd);
    });
    kanbanBoard.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', handleKanbanDragOver);
        col.addEventListener('dragleave', handleKanbanDragLeave);
        col.addEventListener('drop', handleKanbanDrop);
    });
}
let draggedCardElement = null;
let draggedCardData = null;
function handleKanbanDragStart(e) {
    draggedCardElement = e.target;
    draggedCardData = {
        id: e.target.dataset.cardId,
        originalColumnId: e.target.dataset.parentColumnId,
        text: e.target.querySelector('p').textContent
    };
    e.dataTransfer.setData('text/plain', e.target.dataset.cardId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}
function handleKanbanDragEnd(e) {
    if (draggedCardElement) draggedCardElement.classList.remove('dragging');
    draggedCardElement = null; draggedCardData = null;
    kanbanBoard.querySelectorAll('.kanban-column.drag-over').forEach(col => col.classList.remove('drag-over'));
}
function handleKanbanDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const column = e.target.closest('.kanban-column');
    if (column) {
        kanbanBoard.querySelectorAll('.kanban-column.drag-over').forEach(col => col.classList.remove('drag-over'));
        column.classList.add('drag-over');
    }
}
function handleKanbanDragLeave(e) {
    const column = e.target.closest('.kanban-column');
    if (column && !column.contains(e.relatedTarget)) {
        column.classList.remove('drag-over');
    }
}
function handleKanbanDrop(e) {
    e.preventDefault();
    if (!draggedCardData) return;
    const targetColumnDiv = e.target.closest('.kanban-column');
    if (!targetColumnDiv) return;
    targetColumnDiv.classList.remove('drag-over');
    const targetColumnId = targetColumnDiv.dataset.columnId;
    if (draggedCardData.originalColumnId !== targetColumnId) {
        const sourceCol = kanbanData.columns.find(c => c.id === draggedCardData.originalColumnId);
        const targetCol = kanbanData.columns.find(c => c.id === targetColumnId);
        if (sourceCol && targetCol) {
            const cardIndex = sourceCol.cards.findIndex(card => card.id === draggedCardData.id);
            if (cardIndex > -1) {
                const [movedCard] = sourceCol.cards.splice(cardIndex, 1);
                targetCol.cards.push(movedCard);
                const update = { type: 'moveCard', cardId: draggedCardData.id, fromColumnId: draggedCardData.originalColumnId, toColumnId: targetColumnId };
                if (sendKanbanUpdate) sendKanbanUpdate(update);
                renderKanbanBoard();
                if (roomApi && roomApi.getPeers().length > 0) showNotification('kanbanSection');
            }
        }
    }
    draggedCardElement = null; draggedCardData = null;
}
function handleAddKanbanColumn() {
    const columnName = newColumnNameInput.value.trim(); if (!columnName) return;
    const newColumn = { id: `col-${Date.now()}`, title: columnName, cards: [] };
    if (!kanbanData.columns) kanbanData.columns = [];
    kanbanData.columns.push(newColumn);
    if (sendKanbanUpdate) sendKanbanUpdate({ type: 'addColumn', column: newColumn });
    renderKanbanBoard(); newColumnNameInput.value = '';
    if (roomApi && roomApi.getPeers().length > 0) showNotification('kanbanSection');
}
function handleAddKanbanCard(columnId) {
    const cardText = prompt("Enter card text:"); if (!cardText || !cardText.trim()) return;
    const column = kanbanData.columns.find(col => col.id === columnId);
    if (column) {
        const newCard = { id: `card-${Date.now()}`, text: cardText.trim() };
        if (!column.cards) column.cards = [];
        column.cards.push(newCard);
        if (sendKanbanUpdate) sendKanbanUpdate({ type: 'addCard', columnId, card: newCard });
        renderKanbanBoard();
        if (roomApi && roomApi.getPeers().length > 0) showNotification('kanbanSection');
    }
}
function handleDeleteKanbanColumn(columnId) {
    if (!confirm("Delete column and all cards?")) return;
    kanbanData.columns = kanbanData.columns.filter(col => col.id !== columnId);
    if (sendKanbanUpdate) sendKanbanUpdate({ type: 'deleteColumn', columnId });
    renderKanbanBoard();
    if (roomApi && roomApi.getPeers().length > 0) showNotification('kanbanSection');
}
function handleDeleteKanbanCard(columnId, cardId) {
    if (!confirm("Delete card?")) return;
    const column = kanbanData.columns.find(col => col.id === columnId);
    if (column) {
        column.cards = column.cards.filter(card => card.id !== cardId);
        if (sendKanbanUpdate) sendKanbanUpdate({ type: 'deleteCard', columnId, cardId });
        renderKanbanBoard();
        if (roomApi && roomApi.getPeers().length > 0) showNotification('kanbanSection');
    }
}
function applyKanbanUpdate(update, peerId) {
    let needsRender = true;
    if (!kanbanData.columns) kanbanData.columns = [];
    switch (update.type) {
        case 'fullState': kanbanData = update.data; break;
        case 'addColumn': if (!kanbanData.columns.find(c => c.id === update.column.id)) { kanbanData.columns.push(update.column); } else needsRender = false; break;
        case 'addCard': { const column = kanbanData.columns.find(col => col.id === update.columnId); if (column) { if (!column.cards) column.cards = []; if (!column.cards.find(c => c.id === update.card.id)) column.cards.push(update.card); else needsRender = false; } else needsRender = false; break; }
        case 'deleteColumn': kanbanData.columns = kanbanData.columns.filter(col => col.id !== update.columnId); break;
        case 'deleteCard': { const column = kanbanData.columns.find(col => col.id === update.columnId); if (column) { column.cards = column.cards.filter(card => card.id !== update.cardId); } else needsRender = false; break; }
        case 'moveCard': { const sourceCol = kanbanData.columns.find(c => c.id === update.fromColumnId); const targetCol = kanbanData.columns.find(c => c.id === update.toColumnId); if (sourceCol && targetCol) { const cardIndex = sourceCol.cards.findIndex(c => c.id === update.cardId); if (cardIndex > -1) { const [movedCard] = sourceCol.cards.splice(cardIndex, 1); if (!targetCol.cards) targetCol.cards = []; targetCol.cards.push(movedCard); } else needsRender = false; } else needsRender = false; break; }
        default: console.warn("Unknown Kanban update type:", update.type); needsRender = false;
    }
    if (needsRender) {
        renderKanbanBoard();
        if (peerId !== localGeneratedPeerId) showNotification('kanbanSection');
    }
}

async function deriveKeyFromPassword_ImportExport(password, salt) {
    const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: CRYPTO_ALGO, length: 256 }, true, ["encrypt", "decrypt"]);
}

exportWorkspaceBtnSidebar.addEventListener('click', async () => {
    if (!roomApi) { logStatus("You must be in a workspace to export.", true); return; }
    const password = prompt("Enter a password to encrypt the workspace data (this is for the file, not the workspace access password):");
    if (!password) { logStatus("Export cancelled: No password provided.", true); return; }
    try {
        logStatus("Exporting workspace...");
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (activeDoc && collaborativeEditor.innerHTML !== activeDoc.htmlContent) {
            activeDoc.htmlContent = collaborativeEditor.innerHTML;
        }

        const workspaceState = {
            chatHistory: chatHistory,
            whiteboardHistory: whiteboardHistory,
            kanbanData: kanbanData,
            documents: documents,
            currentActiveDocumentId: currentActiveDocumentId,
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

importWorkspaceBtn.addEventListener('click', () => { importFilePicker.click(); });
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
        if (!importedWorkspaceState ||
            typeof importedWorkspaceState.kanbanData === 'undefined' ||
            typeof importedWorkspaceState.whiteboardHistory === 'undefined' ||
            typeof importedWorkspaceState.documents === 'undefined' ||
            typeof importedWorkspaceState.currentActiveDocumentId === 'undefined'
        ) {
            throw new Error("Invalid or incomplete workspace file structure.");
        }
        if (importedWorkspaceState.roomId && !roomIdInput.value) { roomIdInput.value = importedWorkspaceState.roomId; }
        logStatus(`Workspace "${file.name}" decrypted and ready. Enter workspace password and create/join to apply.`);
        statusDiv.textContent += ` (Imported ${importedWorkspaceState.roomId || 'workspace data'})`;
    } catch (error) { console.error("Error importing workspace:", error); logStatus("Error importing: " + (error.message.includes("decrypt") ? "Incorrect password or corrupted file." : error.message), true); importedWorkspaceState = null;
    } finally { importFilePicker.value = ''; }
});

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

const debouncedSendActiveDocumentContentUpdate = debounce(() => {
    if (roomApi && sendDocumentContentUpdate && currentActiveDocumentId) {
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (activeDoc && collaborativeEditor.innerHTML !== activeDoc.htmlContent) {
            activeDoc.htmlContent = collaborativeEditor.innerHTML;
            sendDocumentContentUpdate({ documentId: currentActiveDocumentId, htmlContent: activeDoc.htmlContent });
            if (roomApi.getPeers().length > 0) showNotification('documentsSection');
        }
    }
}, 750);

function initDocumentsModule() {
    collaborativeEditor.addEventListener('input', debouncedSendActiveDocumentContentUpdate);

    const execFormatCommand = (command) => {
        document.execCommand(command, false, null);
        collaborativeEditor.focus();
        debouncedSendActiveDocumentContentUpdate();
    };

    docBoldBtn.addEventListener('click', () => execFormatCommand('bold'));
    docItalicBtn.addEventListener('click', () => execFormatCommand('italic'));
    docUnderlineBtn.addEventListener('click', () => execFormatCommand('underline'));
    docUlBtn.addEventListener('click', () => execFormatCommand('insertUnorderedList'));
    docOlBtn.addEventListener('click', () => execFormatCommand('insertOrderedList'));

    downloadTxtBtn.addEventListener('click', () => {
        if (!currentActiveDocumentId) { logStatus("No active document to download.", true); return; }
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (!activeDoc) { logStatus("Active document not found.", true); return; }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = activeDoc.htmlContent;
        const text = tempDiv.innerText;
        tempDiv.remove();

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const filename = `${activeDoc.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });

    // PDF Download functionality is removed.
    // If you had a downloadPdfBtn variable, ensure it's not referenced or its event listener is removed.
    // The button itself should be removed from index.html.

    newDocBtn.addEventListener('click', () => handleCreateNewDocument());
    renameDocBtn.addEventListener('click', handleRenameDocument);
    deleteDocBtn.addEventListener('click', handleDeleteDocument);

    renderDocumentList();
    loadActiveDocumentContent();
}

function renderDocumentList() {
    documentListDiv.innerHTML = '';
    if (documents.length === 0 && isHost && roomApi) {
        handleCreateNewDocument("Default Document", "<p>Welcome to your new document!</p>", false);
        return;
    }

    documents.forEach(doc => {
        const docItem = document.createElement('span');
        docItem.classList.add('document-list-item');
        docItem.textContent = doc.name;
        docItem.dataset.documentId = doc.id;
        if (doc.id === currentActiveDocumentId) {
            docItem.classList.add('active');
        }
        docItem.addEventListener('click', () => {
            setActiveDocument(doc.id);
        });
        documentListDiv.appendChild(docItem);
    });
    if (!currentActiveDocumentId || !documents.find(d => d.id === currentActiveDocumentId)) {
        collaborativeEditor.innerHTML = '<p>Select or create a document.</p>';
        collaborativeEditor.contentEditable = "false";
    } else {
        collaborativeEditor.contentEditable = "true";
    }
}

function loadActiveDocumentContent() {
    if (!currentActiveDocumentId && documents.length > 0) {
        currentActiveDocumentId = documents[0].id;
    }
    const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
    if (activeDoc) {
        if (collaborativeEditor.innerHTML !== activeDoc.htmlContent) {
            collaborativeEditor.innerHTML = activeDoc.htmlContent;
        }
        collaborativeEditor.contentEditable = "true";
    } else if (documents.length > 0) {
        currentActiveDocumentId = documents[0].id;
        if (collaborativeEditor.innerHTML !== documents[0].htmlContent) {
            collaborativeEditor.innerHTML = documents[0].htmlContent;
        }
        collaborativeEditor.contentEditable = "true";
    }
    else {
        collaborativeEditor.innerHTML = '<p>Select or create a document to start editing.</p>';
        collaborativeEditor.contentEditable = "false";
    }
    renderDocumentList();
}

function setActiveDocument(documentId) {
    if (currentActiveDocumentId) {
        const currentDocObj = documents.find(d => d.id === currentActiveDocumentId);
        if (currentDocObj && collaborativeEditor.innerHTML !== currentDocObj.htmlContent) {
            currentDocObj.htmlContent = collaborativeEditor.innerHTML;
        }
    }
    currentActiveDocumentId = documentId;
    loadActiveDocumentContent();
}

function handleCreateNewDocument(defaultName = null, defaultContent = null, broadcast = true) {
    const docName = defaultName || prompt("Enter name for the new document:", `Document ${documents.length + 1}`);
    if (!docName) return;

    const newDoc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: docName,
        htmlContent: defaultContent || '<p>Start typing in your new document...</p>'
    };
    documents.push(newDoc);
    setActiveDocument(newDoc.id);
    renderDocumentList();
    if (broadcast && roomApi && sendCreateDocument) {
        sendCreateDocument(newDoc);
        if (roomApi.getPeers().length > 0) showNotification('documentsSection');
    }
}

function handleRenameDocument() {
    if (!currentActiveDocumentId) {
        logStatus("No document selected to rename.", true); return;
    }
    const docToRename = documents.find(d => d.id === currentActiveDocumentId);
    if (!docToRename) {
        logStatus("Selected document not found.", true); return;
    }
    const newName = prompt("Enter new name for the document:", docToRename.name);
    if (newName && newName.trim() !== "" && newName !== docToRename.name) {
        docToRename.name = newName.trim();
        renderDocumentList();
        if (roomApi && sendRenameDocument) {
            sendRenameDocument({ documentId: currentActiveDocumentId, newName: docToRename.name });
            if (roomApi.getPeers().length > 0) showNotification('documentsSection');
        }
    }
}

function handleDeleteDocument() {
    if (!currentActiveDocumentId) {
        logStatus("No document selected to delete.", true); return;
    }
    const docToDelete = documents.find(d => d.id === currentActiveDocumentId); 
    if (!docToDelete) { 
        logStatus("Selected document not found for deletion.", true); return;
    }
    if (!confirm(`Are you sure you want to delete "${docToDelete.name}"? This cannot be undone.`)) { 
        return;
    }

    const deletedDocId = currentActiveDocumentId;
    documents = documents.filter(doc => doc.id !== deletedDocId);

    if (roomApi && sendDeleteDocument) {
        sendDeleteDocument({ documentId: deletedDocId });
    }

    currentActiveDocumentId = null;
    if (documents.length > 0) {
        setActiveDocument(documents[0].id);
    } else {
        if (isHost) {
            handleCreateNewDocument("Default Document", "<p>All documents were deleted. Here's a new one!</p>", true);
        } else {
            collaborativeEditor.innerHTML = '<p>No documents available. The host can create one.</p>';
            collaborativeEditor.contentEditable = "false";
            renderDocumentList(); 
        }
    }
    if (roomApi && roomApi.getPeers().length > 0 && deletedDocId) showNotification('documentsSection');
}

async function joinRoomAndSetup() {
    localNickname = nicknameInput.value.trim();
    if (!localNickname) {
        logStatus("Please enter a nickname.", true);
        return;
    }

    const roomPassword = roomPasswordInput.value; 
    if (!roomPassword) {
        logStatus("Workspace password is required.", true);
        createPartyBtn.disabled = false;
        joinLeaveRoomBtn.disabled = false;
        joinLeaveRoomBtn.textContent = 'Join Workspace';
        nicknameInput.disabled = false;
        roomIdInput.disabled = false;
        roomPasswordInput.disabled = false;
        importWorkspaceBtn.disabled = false;
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
        roomIdInput.value = roomIdToJoin; 
    } else { 
        if (!roomIdToJoin) {
            logStatus("Room Code is required to join a workspace.", true);
            createPartyBtn.disabled = false;
            joinLeaveRoomBtn.disabled = false;
            joinLeaveRoomBtn.textContent = 'Join Workspace';
            nicknameInput.disabled = false;
            roomIdInput.disabled = false;
            roomPasswordInput.disabled = false;
            importWorkspaceBtn.disabled = false;
            return;
        }
    }

    const sanitizedRoomId = roomIdToJoin.toLowerCase().replace(/[\s,]+/g, '-');
    if (roomIdToJoin !== sanitizedRoomId) {
        logStatus(`Using sanitized Room Code: ${sanitizedRoomId}`);
        roomIdInput.value = sanitizedRoomId;
    }
    currentRoomId = sanitizedRoomId;

    logStatus(`Connecting to Workspace: ${currentRoomId} as ${localNickname}...`);
    joinLeaveRoomBtn.textContent = 'Connecting...';
    joinLeaveRoomBtn.disabled = true;
    createPartyBtn.disabled = true;
    nicknameInput.disabled = true;
    roomIdInput.disabled = true;
    roomPasswordInput.disabled = true;
    importWorkspaceBtn.disabled = true;

    try {
        const config = { appId: APP_ID, password: roomPassword };
        roomApi = await joinRoom(config, currentRoomId);
        logStatus(`Joined workspace: ${currentRoomId}. My Peer ID: ${localGeneratedPeerId.substring(0, 8)}`);

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

        if (importedWorkspaceState && isHost) { 
            chatHistory = importedWorkspaceState.chatHistory || [];
            whiteboardHistory = importedWorkspaceState.whiteboardHistory || [];
            kanbanData = importedWorkspaceState.kanbanData || { columns: [] };
            documents = importedWorkspaceState.documents || [];
            currentActiveDocumentId = importedWorkspaceState.currentActiveDocumentId || null;
            if (documents.length === 0) {
                documents.push({ id: `doc-${Date.now()}`, name: 'Imported Document', htmlContent: '<p>Workspace imported.</p>' });
                currentActiveDocumentId = documents[0].id;
            } else if (currentActiveDocumentId && !documents.find(d => d.id === currentActiveDocumentId)) {
                currentActiveDocumentId = documents[0].id;
            }
            logStatus("Imported workspace state applied for hosting.");
            importedWorkspaceState = null; 
        } else if (isHost && documents.length === 0) { 
            const defaultDocId = `doc-${Date.now()}`;
            documents = [{ id: defaultDocId, name: 'Shared Notes', htmlContent: '<p>Welcome to the shared document!</p>' }];
            currentActiveDocumentId = defaultDocId;
        }
        
        chatArea.innerHTML = '';
        chatHistory.forEach(msg => displayMessage({ ...msg, isHistorical: true }, msg.senderPeerId === localGeneratedPeerId, msg.isSystem));

        onChatMessage((msgData, peerId) => {
            const senderNickname = peerNicknames[peerId] || `Peer ${peerId.substring(0, 6)}`;
            addMessageToHistoryAndDisplay({ ...msgData, senderNickname, senderPeerId: peerId }, false);
        });
        onNickname(async (nicknameData, peerId) => {
            const { nickname, initialJoin, isHost: peerIsHost } = nicknameData;
            const oldNickname = peerNicknames[peerId]; peerNicknames[peerId] = nickname;
            if (initialJoin && oldNickname !== nickname) {
                addMessageToHistoryAndDisplay({ message: `${nickname}${peerIsHost ? ' (Host)' : ''} has joined.`, senderPeerId: peerId }, false, true);
                if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: false, isHost: isHost }, peerId);
                if (isHost) {
                    if (sendChatHistory && chatHistory.length > 0) sendChatHistory(chatHistory, peerId);
                    if (sendInitialWhiteboard && whiteboardHistory.length > 0) sendInitialWhiteboard(whiteboardHistory, peerId);
                    if (sendInitialKanban && (kanbanData.columns && kanbanData.columns.length > 0)) sendInitialKanban(kanbanData, peerId);
                    if (sendInitialDocuments) sendInitialDocuments({ docs: documents, activeId: currentActiveDocumentId }, peerId);
                }
            } else if (oldNickname && oldNickname !== nickname) {
                addMessageToHistoryAndDisplay({ message: `${oldNickname} is now known as ${nickname}.`, senderPeerId: peerId }, false, true);
            }
            updateUserList();
            const vcWrapper = document.getElementById(`vc-wrapper-${peerId}`);
            if (vcWrapper) {
                const nicknameEl = vcWrapper.querySelector('p');
                if (nicknameEl) nicknameEl.textContent = nickname;
            }
        });
        onChatHistory((history, peerId) => {
            if (!isHost) {
                chatHistory = history; chatArea.innerHTML = '';
                chatHistory.forEach(msg => displayMessage({ ...msg, isHistorical: true }, msg.senderPeerId === localGeneratedPeerId, msg.isSystem));
                logStatus(`Received chat history from ${peerNicknames[peerId] || 'host'}.`);
            }
        });
        onPrivateMessage((pmData, senderPeerId) => {
            const sender = peerNicknames[senderPeerId] || `Peer ${senderPeerId.substring(0, 6)}`;
            addMessageToHistoryAndDisplay({ senderNickname: sender, message: pmData.content, pmInfo: { type: 'received', sender: sender }, senderPeerId: senderPeerId }, false);
        });
        onFileMeta(handleIncomingFileMeta);
        onFileChunk(handleIncomingFileChunk);
        onDrawCommand((cmd, peerId) => {
            if (cmd.type === 'clear') applyClearCommandLocal(cmd);
            else { applyDrawCommand(cmd); whiteboardHistory.push(cmd); }
            if (peerId !== localGeneratedPeerId) showNotification('whiteboardSection');
        });
        onInitialWhiteboard((history, peerId) => {
            if (!isHost) {
                whiteboardHistory = history;
                if (currentActiveSection === 'whiteboardSection' && whiteboardCanvas.offsetParent) redrawWhiteboardFromHistory();
                logStatus(`Received whiteboard state from ${peerNicknames[peerId] || 'host'}.`);
            }
        });
        onKanbanUpdate((update, peerId) => {
            applyKanbanUpdate(update, peerId);
        });
        onInitialKanban((initialData, peerId) => {
            if (!isHost) {
                kanbanData = initialData;
                if (currentActiveSection === 'kanbanSection') renderKanbanBoard();
                logStatus(`Received Kanban state from ${peerNicknames[peerId] || 'host'}.`);
            }
        });
        onInitialDocuments((data, peerId) => {
            if (!isHost) {
                documents = data.docs || [];
                currentActiveDocumentId = data.activeId || (documents.length > 0 ? documents[0].id : null);
                renderDocumentList();
                loadActiveDocumentContent();
                logStatus(`Received documents state from ${peerNicknames[peerId] || 'host'}.`);
            }
        });
        onCreateDocument((newDoc, peerId) => {
            if (!documents.find(d => d.id === newDoc.id)) {
                documents.push(newDoc);
                renderDocumentList();
                if (documents.length === 1 && !currentActiveDocumentId) {
                    setActiveDocument(newDoc.id);
                }
                if (peerId !== localGeneratedPeerId) showNotification('documentsSection');
            }
        });
        onRenameDocument((data, peerId) => {
            const doc = documents.find(d => d.id === data.documentId);
            if (doc) {
                doc.name = data.newName;
                renderDocumentList();
                if (peerId !== localGeneratedPeerId) showNotification('documentsSection');
            }
        });
        onDeleteDocument((data, peerId) => {
            documents = documents.filter(d => d.id !== data.documentId);
            if (currentActiveDocumentId === data.documentId) {
                currentActiveDocumentId = documents.length > 0 ? documents[0].id : null;
                loadActiveDocumentContent();
            }
            renderDocumentList();
            if (peerId !== localGeneratedPeerId) showNotification('documentsSection');
        });
        onDocumentContentUpdate((data, peerId) => {
            const doc = documents.find(d => d.id === data.documentId);
            if (doc) {
                doc.htmlContent = data.htmlContent;
                if (currentActiveDocumentId === data.documentId && collaborativeEditor.innerHTML !== data.htmlContent) {
                    collaborativeEditor.innerHTML = data.htmlContent;
                }
                if (peerId !== localGeneratedPeerId) showNotification('documentsSection');
            }
        });

        roomApi.onPeerJoin(async (joinedPeerId) => {
            logStatus(`Peer ${joinedPeerId.substring(0, 8)}... joined.`);
            if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: true, isHost: isHost }, joinedPeerId);

            if (localVideoCallStream && roomApi.addStream) {
                roomApi.addStream(localVideoCallStream, joinedPeerId, { streamType: 'videochat' });
            }
            if (localAudioStream && roomApi.addStream) {
                roomApi.addStream(localAudioStream, joinedPeerId, { streamType: 'audiochat' });
            }
            if (localScreenShareStream && roomApi.addStream) {
                roomApi.addStream(localScreenShareStream, joinedPeerId, { streamType: 'screenshare' });
            }
            if (isHost && sendInitialDocuments) { 
                sendInitialDocuments({ docs: documents, activeId: currentActiveDocumentId }, joinedPeerId);
            }
        });
        roomApi.onPeerLeave(leftPeerId => {
            const departedUser = peerNicknames[leftPeerId] || `Peer ${leftPeerId.substring(0, 6)}`;
            addMessageToHistoryAndDisplay({ message: `${departedUser} has left.`, senderPeerId: leftPeerId }, false, true);
            delete peerNicknames[leftPeerId]; updateUserList();

            const screenShareVideoEl = document.getElementById(`container-screenshare-${leftPeerId}`);
            if (screenShareVideoEl) screenShareVideoEl.remove();

            if (peerVideoElements[leftPeerId]) {
                peerVideoElements[leftPeerId].wrapper.remove();
                delete peerVideoElements[leftPeerId];
            }
            if (peerAudios[leftPeerId]) {
                peerAudios[leftPeerId].pause();
                peerAudios[leftPeerId].srcObject = null;
                delete peerAudios[leftPeerId];
            }
        });
        roomApi.onPeerStream((stream, peerId, metadata) => {
            if (metadata && metadata.streamType) {
                const streamType = metadata.streamType;
                if (streamType === 'videochat') {
                    handleIncomingVideoChatStream(stream, peerId);
                } else if (streamType === 'audiochat') {
                    handleIncomingAudioChatStream(stream, peerId);
                } else if (streamType === 'screenshare') {
                    displayRemoteScreenShareStream(stream, peerId);
                } else {
                    console.warn(`Received stream from ${peerId} with unknown type: '${streamType}'.`);
                }
            } else {
                console.warn(`Received stream from ${peerId} with missing or invalid 'streamType' metadata. Stream will not be displayed automatically. Metadata:`, metadata);
            }
        });

        setupSection.classList.add('hidden'); statusDiv.classList.add('hidden');
        inRoomInterface.classList.remove('hidden');
        currentRoomCodeSpan.textContent = currentRoomId; currentNicknameSpan.textContent = localNickname;
        messageInput.placeholder = `Message #${currentRoomId}`;
        joinLeaveRoomBtn.textContent = 'Leave Workspace'; joinLeaveRoomBtn.disabled = false;

        startShareBtn.disabled = false; startShareBtn.title = "Start sharing your screen"; stopShareBtn.disabled = true;
        startVideoCallBtn.disabled = false; stopVideoCallBtn.disabled = true;
        startAudioCallBtn.disabled = false; stopAudioCallBtn.disabled = true; audioChatStatus.classList.add('hidden');

        if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: true, isHost: isHost }, Object.keys(roomApi.getPeers()).filter(p => p !== localGeneratedPeerId));
        updateUserList();
        if (chatHistory.filter(m => m.isSystem && m.message.startsWith("You joined room")).length === 0) {
            addMessageToHistoryAndDisplay({ message: `You joined workspace: ${currentRoomId} as ${localNickname}${isHost ? ' (Host)' : ''}.` }, false, true);
        }

        initWhiteboard(); initKanban(); initDocumentsModule();
        if (currentActiveSection === 'whiteboardSection') resizeWhiteboardCanvas(); else redrawWhiteboardFromHistory();
        if (currentActiveSection === 'kanbanSection') renderKanbanBoard(); else renderKanbanBoard();
        if (currentActiveSection === 'documentsSection') {
            renderDocumentList();
            loadActiveDocumentContent();
        }

    } catch (error) {
        console.error("Error during room join or Trystero setup:", error);
        logStatus(`Error: ${error.message}. Could be incorrect password or network issue. Please try again.`, true);
        resetToSetupState();
    }
}

async function leaveRoomAndCleanup() {
    logStatus("Leaving workspace...");
    if (localScreenShareStream) stopScreenSharing(false);
    if (localVideoCallStream) stopVideoCall(false);
    if (localAudioStream) stopAudioCall(false);

    if (roomApi) { try { await roomApi.leave(); logStatus("Left workspace successfully."); } catch (e) { console.warn("Error leaving room:", e); } }
    roomApi = null;
    sendChatMessage = onChatMessage = sendNickname = onNickname = sendPrivateMessage = onPrivateMessage = null;
    sendFileMeta = onFileMeta = sendFileChunk = onFileChunk = null;
    sendDrawCommand = onDrawCommand = sendInitialWhiteboard = onInitialWhiteboard = null;
    sendKanbanUpdate = onKanbanUpdate = sendInitialKanban = onInitialKanban = null;
    sendChatHistory = onChatHistory = null;
    sendInitialDocuments = onInitialDocuments = sendCreateDocument = onCreateDocument = null;
    sendRenameDocument = onRenameDocument = sendDeleteDocument = onDeleteDocument = null;
    sendDocumentContentUpdate = onDocumentContentUpdate = null;
    resetToSetupState();
}

function resetToSetupState() {
    inRoomInterface.classList.add('hidden');
    setupSection.classList.remove('hidden');
    statusDiv.classList.remove('hidden');
    if (!emojiPickerPopup.classList.contains('hidden')) emojiPickerPopup.classList.add('hidden');

    joinLeaveRoomBtn.textContent = 'Join Workspace';
    joinLeaveRoomBtn.disabled = false;
    createPartyBtn.disabled = false;
    importWorkspaceBtn.disabled = false;
    nicknameInput.disabled = false;
    roomIdInput.disabled = false;
    roomPasswordInput.disabled = false;
    roomPasswordInput.value = '';

    roomIdInput.placeholder = "Enter Room Code (or leave blank to create)";

    startShareBtn.disabled = true; startShareBtn.title = ""; stopShareBtn.disabled = true;
    remoteVideosContainer.innerHTML = '';

    startVideoCallBtn.disabled = true; stopVideoCallBtn.disabled = true;
    localVideoContainer.classList.add('hidden');
    if (localVideo) localVideo.srcObject = null;
    remoteVideoChatContainer.innerHTML = '';
    peerVideoElements = {};

    startAudioCallBtn.disabled = true; stopAudioCallBtn.disabled = true;
    audioChatStatus.classList.add('hidden');
    if (localAudioStream) {
        localAudioStream.getTracks().forEach(track => track.stop());
        localAudioStream = null;
    }
    Object.values(peerAudios).forEach(audioEl => {
        if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
        }
    });
    peerAudios = {};

    chatArea.innerHTML = ''; userListUl.innerHTML = ''; userCountSpan.textContent = '0';
    messageInput.value = '';
    logStatus('Enter nickname, workspace code, and password. Create, join, or import a workspace.');
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

    whiteboardHistory = [];
    kanbanData = { columns: [] };
    chatHistory = [];
    documents = [];
    currentActiveDocumentId = null;
    if (documentListDiv) documentListDiv.innerHTML = '';
    if (collaborativeEditor) {
        collaborativeEditor.innerHTML = '<p>Select or create a document.</p>';
        collaborativeEditor.contentEditable = "false";
    }

    isHost = false;
    currentRoomId = '';

    if (wbCtx && whiteboardCanvas.offsetParent) applyClearCommandLocal({ type: 'clear' });
    if (kanbanBoard) kanbanBoard.innerHTML = '';
}

createPartyBtn.addEventListener('click', () => {
    isHost = true;
    documents = []; 
    currentActiveDocumentId = null;
    joinRoomAndSetup();
});

joinLeaveRoomBtn.addEventListener('click', () => {
    if (roomApi) {
        leaveRoomAndCleanup();
    } else {
        isHost = false;
        joinRoomAndSetup();
    }
});

startShareBtn.addEventListener('click', async () => {
    if (!roomApi) { logStatus("Not in a room.", true); return; }
    try {
        if (!navigator.mediaDevices?.getDisplayMedia) { logStatus("Screen sharing not supported.", true); return; }
        if (localScreenShareStream) stopScreenSharing(true);
        localScreenShareStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true });
        await roomApi.addStream(localScreenShareStream, null, { streamType: 'screenshare' });
        startShareBtn.disabled = true; stopShareBtn.disabled = false;
        localScreenShareStream.getVideoTracks().forEach(track => track.onended = () => stopScreenSharing(true));
        showNotification('screenShareSection');
    } catch (err) {
        console.error("Error starting screen share:", err);
        logStatus(`Error starting share: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}`, true);
        if (localScreenShareStream) { localScreenShareStream.getTracks().forEach(track => track.stop()); localScreenShareStream = null; }
        if (roomApi) { startShareBtn.disabled = false; stopShareBtn.disabled = true; }
    }
});
function stopScreenSharing(updateButtons = true) {
    logStatus("Stopping screen share...");
    if (localScreenShareStream) {
        if (roomApi?.removeStream) {
            try { roomApi.removeStream(localScreenShareStream, null, { streamType: 'screenshare' }).catch(err => console.error("Error in roomApi.removeStream for screen share:", err)); }
            catch (e) { console.error("Exception calling roomApi.removeStream for screen share:", e); }
        }
        localScreenShareStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localScreenShareStream = null;
    }
    if (updateButtons && roomApi) { startShareBtn.disabled = false; stopShareBtn.disabled = true; }
}
stopShareBtn.addEventListener('click', () => stopScreenSharing(true));

startVideoCallBtn.addEventListener('click', async () => {
    if (!roomApi) { logStatus("Not in a room to start video call.", true); return; }
    try {
        if (!navigator.mediaDevices?.getUserMedia) { logStatus("Video call not supported by your browser.", true); return; }
        if (localVideoCallStream) await stopVideoCall(true);

        localVideoCallStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localVideoCallStream;
        localVideoContainer.classList.remove('hidden');

        await roomApi.addStream(localVideoCallStream, null, { streamType: 'videochat' });

        startVideoCallBtn.disabled = true;
        stopVideoCallBtn.disabled = false;
        logStatus("Video call started.");
        showNotification('videoChatSection');

        localVideoCallStream.getTracks().forEach(track => {
            track.onended = () => stopVideoCall(true);
        });

    } catch (err) {
        console.error("Error starting video call:", err);
        logStatus(`Error starting video call: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}`, true);
        if (localVideoCallStream) { localVideoCallStream.getTracks().forEach(track => track.stop()); localVideoCallStream = null; }
        localVideoContainer.classList.add('hidden');
        if (localVideo) localVideo.srcObject = null;
        if (roomApi) { startVideoCallBtn.disabled = false; stopVideoCallBtn.disabled = true; }
    }
});

async function stopVideoCall(updateButtons = true) {
    logStatus("Stopping video call...");
    if (localVideoCallStream) {
        if (roomApi?.removeStream) {
            try { await roomApi.removeStream(localVideoCallStream, null, { streamType: 'videochat' }); }
            catch (e) { console.error("Exception calling roomApi.removeStream for video call:", e); }
        }
        localVideoCallStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localVideoCallStream = null;
    }
    if (localVideo) localVideo.srcObject = null;
    localVideoContainer.classList.add('hidden');

    if (updateButtons && roomApi) {
        startVideoCallBtn.disabled = false;
        stopVideoCallBtn.disabled = true;
    }
    logStatus("Video call stopped.");
}
stopVideoCallBtn.addEventListener('click', () => stopVideoCall(true));

async function startAudioCall() {
    if (!roomApi) { logStatus("Not in a room to start audio call.", true); return; }
    try {
        if (!navigator.mediaDevices?.getUserMedia) { 
            logStatus("Audio capture not supported by your browser. Please try a different browser or update your current one.", true); 
            return; 
        }
        if (localAudioStream) await stopAudioCall(true); 

        logStatus("Requesting microphone access...");
        localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        logStatus("Microphone access granted. Starting audio call...");

        await roomApi.addStream(localAudioStream, null, { streamType: 'audiochat' });

        startAudioCallBtn.disabled = true;
        stopAudioCallBtn.disabled = false;
        audioChatStatus.textContent = "Audio call active. You are transmitting audio.";
        audioChatStatus.classList.remove('hidden');
        
        localAudioStream.getTracks().forEach(track => {
            track.onended = () => stopAudioCall(true); 
        });

    } catch (err) {
        console.error("Error starting audio call:", err);
        let userMessage = `Error starting audio call: ${err.message}`;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            userMessage = "Microphone permission denied. Please check your browser's site settings (usually a lock icon in the address bar) and allow microphone access for this page. You might need to refresh the page after changing permissions.";
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            userMessage = "No microphone found. Please ensure a microphone is connected, enabled in your system settings, and not in use by another application.";
        } else if (err.name === 'SecurityError') {
             userMessage = "Microphone access denied due to security settings. This page might need to be served over HTTPS (secure connection), or your browser's security policy is preventing access.";
        } else if (err.name === 'AbortError') {
            userMessage = "Microphone request was aborted. This can happen if another device request was made too quickly or there was a hardware error.";
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            userMessage = "Could not read from the microphone. It might be in use by another application, or there could be a hardware/driver issue. Try closing other apps that might use the mic, or restarting your browser/computer.";
        }
        
        logStatus(userMessage, true);
        if (localAudioStream) { localAudioStream.getTracks().forEach(track => track.stop()); localAudioStream = null; }
        if (roomApi) { startAudioCallBtn.disabled = false; stopAudioCallBtn.disabled = true; }
        audioChatStatus.classList.add('hidden');
    }
}

async function stopAudioCall(updateButtons = true) {
    logStatus("Stopping audio call...");
    if (localAudioStream) {
        if (roomApi?.removeStream) {
            try { await roomApi.removeStream(localAudioStream, null, { streamType: 'audiochat' }); }
            catch (e) { console.error("Exception calling roomApi.removeStream for audio call:", e); }
        }
        localAudioStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localAudioStream = null;
    }

    if (updateButtons && roomApi) {
        startAudioCallBtn.disabled = false;
        stopAudioCallBtn.disabled = true;
    }
    audioChatStatus.classList.add('hidden');
    logStatus("Audio call stopped.");
}
startAudioCallBtn.addEventListener('click', startAudioCall);
stopAudioCallBtn.addEventListener('click', () => stopAudioCall(true));


sendMessageBtn.addEventListener('click', () => {
    const messageText = messageInput.value.trim(); if (!messageText || !roomApi) return;
    const timestamp = Date.now();
    if (messageText.toLowerCase().startsWith('/pm ')) {
        const parts = messageText.substring(4).split(' ');
        const targetNickname = parts.shift();
        const pmContent = parts.join(' ').trim();
        if (!targetNickname || !pmContent) { addMessageToHistoryAndDisplay({ message: "Usage: /pm <nickname> <message>", timestamp }, false, true); return; }
        if (targetNickname.toLowerCase() === localNickname.toLowerCase()) { addMessageToHistoryAndDisplay({ message: "You can't PM yourself.", timestamp }, false, true); return; }
        const targetPeerId = findPeerIdByNickname(targetNickname);
        if (targetPeerId && sendPrivateMessage) {
            sendPrivateMessage({ content: pmContent, timestamp }, targetPeerId);
            addMessageToHistoryAndDisplay({ senderNickname: localNickname, message: pmContent, pmInfo: { type: 'sent', recipient: targetNickname }, timestamp }, true);
        } else { addMessageToHistoryAndDisplay({ message: `User "${targetNickname}" not found or PM failed.`, timestamp }, false, true); }
    } else if (sendChatMessage) {
        const msgData = { message: messageText, timestamp };
        sendChatMessage(msgData);
        addMessageToHistoryAndDisplay({ senderNickname: localNickname, ...msgData }, true);
    }
    messageInput.value = ''; if (!emojiPickerPopup.classList.contains('hidden')) emojiPickerPopup.classList.add('hidden');
});
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessageBtn.click(); });
copyRoomCodeBtn.addEventListener('click', () => {
    if (currentRoomId) { navigator.clipboard.writeText(currentRoomId).then(() => { const originalText = copyRoomCodeBtn.textContent; copyRoomCodeBtn.textContent = '✅'; copyRoomCodeBtn.title = 'Copied!'; setTimeout(() => { copyRoomCodeBtn.textContent = '📋'; copyRoomCodeBtn.title = 'Copy Room Code'; }, 1500); }).catch(err => { logStatus('Failed to copy room code.', true); }); }
});

window.addEventListener('beforeunload', async () => {
    // No specific cleanup needed here that isn't handled by browser closing connections
    // or leaveRoomAndCleanup for explicit actions.
});
const savedNickname = localStorage.getItem('viewPartyNickname');
if (savedNickname) nicknameInput.value = savedNickname;
nicknameInput.addEventListener('input', () => localStorage.setItem('viewPartyNickname', nicknameInput.value.trim()));

if (!navigator.mediaDevices?.getDisplayMedia) { startShareBtn.title = "Screen sharing not supported by your browser."; startShareBtn.disabled = true; }
if (!navigator.mediaDevices?.getUserMedia) { 
    startVideoCallBtn.title = "Video/Audio capture not supported by your browser."; 
    startVideoCallBtn.disabled = true; 
    startAudioCallBtn.title = "Audio capture not supported by your browser.";
    startAudioCallBtn.disabled = true;
}

resetToSetupState();
populateEmojiPicker();
