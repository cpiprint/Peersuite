// main.js

import { joinRoom, selfId as localGeneratedPeerId } from './trystero-torrent.min.js';
import {
    initShareFeatures,
    getShareableData,
    loadShareableData,
    resetShareModuleStates,
    setShareModulePeerInfo, // This function might not be strictly needed if share.js doesn't directly use peerNicknames for its internal logic beyond what's passed
    handleShareModulePeerLeave
} from './share.js';
import { initMediaFeatures, handleMediaPeerStream, stopAllLocalMedia, setupMediaForNewPeer, cleanupMediaForPeer } from './media.js';

const APP_ID = 'PeerSuite-0.1.3-jun02'; // Example: Increment version

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
const settingsSidebarBtn = document.getElementById('settingsSidebarBtn');
const settingsSection = document.getElementById('settingsSection');
const settingsNicknameInput = document.getElementById('settingsNicknameInput');
const settingsVideoFlipCheckbox = document.getElementById('settingsVideoFlipCheckbox');
const settingsPttEnabledCheckbox = document.getElementById('settingsPttEnabledCheckbox');
const pttHotkeySettingsContainer = document.getElementById('pttHotkeySettingsContainer');
const settingsPttKeyBtn = document.getElementById('settingsPttKeyBtn');
const pttKeyInstructions = document.getElementById('pttKeyInstructions');
const settingsSaveBtn = document.getElementById('settingsSaveBtn');

const settingsGlobalVolumeSlider = document.getElementById('settingsGlobalVolumeSlider');
const globalVolumeValue = document.getElementById('globalVolumeValue');

let isCapturingPttKey = false;
let roomApi;
let localNickname = '';
let currentRoomId = '';
let currentActiveSection = 'chatSection';
let peerNicknames = {}; // { peerId: nickname }
let isHost = false;
let importedWorkspaceState = null;

let peerSuiteSettings = {
    videoFlip: false,
    pttEnabled: false,
    pttKey: 'Space',
    pttKeyDisplay: 'Space',
    globalVolume: 1,
};

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


function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function loadSettings() {
    const savedSettings = localStorage.getItem('peerSuiteAppSettings');
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            peerSuiteSettings = {
                videoFlip: typeof parsedSettings.videoFlip === 'boolean' ? parsedSettings.videoFlip : false,
                pttEnabled: typeof parsedSettings.pttEnabled === 'boolean' ? parsedSettings.pttEnabled : false,
                pttKey: typeof parsedSettings.pttKey === 'string' ? parsedSettings.pttKey : 'Space',
                pttKeyDisplay: typeof parsedSettings.pttKeyDisplay === 'string' ? parsedSettings.pttKeyDisplay : 'Space',
                globalVolume: typeof parsedSettings.globalVolume === 'number' && !isNaN(parsedSettings.globalVolume) ? parsedSettings.globalVolume : 1,
            };
        } catch (e) {
            console.error("Error parsing saved settings, using defaults.", e);
            peerSuiteSettings = { videoFlip: false, pttEnabled: false, pttKey: 'Space', pttKeyDisplay: 'Space', globalVolume: 1 };
        }
    }

    populateSettingsSection();

    if (window.mediaModuleRef && window.mediaModuleRef.setLocalVideoFlip) {
        window.mediaModuleRef.setLocalVideoFlip(peerSuiteSettings.videoFlip);
    }
    if (window.mediaModuleRef && window.mediaModuleRef.updatePttSettings) {
        window.mediaModuleRef.updatePttSettings(peerSuiteSettings.pttEnabled, peerSuiteSettings.pttKey, peerSuiteSettings.pttKeyDisplay);
    }
    if (window.mediaModuleRef && window.mediaModuleRef.setGlobalVolume) {
        window.mediaModuleRef.setGlobalVolume(peerSuiteSettings.globalVolume, false);
    }
}

function saveSettings() {
    localStorage.setItem('peerSuiteAppSettings', JSON.stringify(peerSuiteSettings));
}


function populateSettingsSection() {
    if (!settingsNicknameInput || !settingsVideoFlipCheckbox || !settingsPttEnabledCheckbox || !settingsPttKeyBtn || !pttHotkeySettingsContainer ||
        !settingsGlobalVolumeSlider || !globalVolumeValue) return;
    settingsNicknameInput.value = localNickname;
    settingsVideoFlipCheckbox.checked = peerSuiteSettings.videoFlip;
    settingsPttEnabledCheckbox.checked = peerSuiteSettings.pttEnabled;
    settingsPttKeyBtn.textContent = peerSuiteSettings.pttKeyDisplay;
    pttHotkeySettingsContainer.classList.toggle('hidden', !settingsPttEnabledCheckbox.checked);

    settingsGlobalVolumeSlider.value = peerSuiteSettings.globalVolume;
    globalVolumeValue.textContent = `${Math.round(peerSuiteSettings.globalVolume * 100)}%`;
}


function handlePttKeyCapture(event) {
    if (!isCapturingPttKey) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
        // Action handled by simply closing the capture state
    } else {
        peerSuiteSettings.pttKey = event.code;
        if (event.code === 'Space') peerSuiteSettings.pttKeyDisplay = 'Space';
        else if (event.key.length === 1) peerSuiteSettings.pttKeyDisplay = event.key.toUpperCase();
        else peerSuiteSettings.pttKeyDisplay = event.key;

        if (settingsPttKeyBtn) settingsPttKeyBtn.textContent = peerSuiteSettings.pttKeyDisplay;
    }

    isCapturingPttKey = false;
    if (pttKeyInstructions) pttKeyInstructions.classList.add('hidden');
    if (settingsPttKeyBtn) settingsPttKeyBtn.classList.remove('hidden');
    document.removeEventListener('keydown', handlePttKeyCapture, true);
}


if (settingsPttEnabledCheckbox) {
    settingsPttEnabledCheckbox.addEventListener('change', () => {
        if (pttHotkeySettingsContainer) pttHotkeySettingsContainer.classList.toggle('hidden', !settingsPttEnabledCheckbox.checked);
    });
}

if (settingsPttKeyBtn) {
    settingsPttKeyBtn.addEventListener('click', () => {
        if (isCapturingPttKey) return;
        isCapturingPttKey = true;
        settingsPttKeyBtn.classList.add('hidden');
        if(pttKeyInstructions) pttKeyInstructions.classList.remove('hidden');
        document.addEventListener('keydown', handlePttKeyCapture, true);
    });
}

if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', async () => {
        const newNickname = settingsNicknameInput.value.trim();
        if (newNickname && newNickname !== localNickname) {
            localNickname = newNickname;
            localStorage.setItem('viewPartyNickname', localNickname);
            if(currentNicknameSpan) currentNicknameSpan.textContent = escapeHtml(localNickname);
            updateUserList();
            if (roomApi && sendNickname) {
                await sendNickname({ nickname: localNickname, initialJoin: false, isHost: isHost });
            }
             if (window.mediaModuleRef && window.mediaModuleRef.updatePeerNicknameInUI) {
                window.mediaModuleRef.updatePeerNicknameInUI(localGeneratedPeerId, localNickname);
            }
        }

        peerSuiteSettings.videoFlip = settingsVideoFlipCheckbox.checked;
        peerSuiteSettings.pttEnabled = settingsPttEnabledCheckbox.checked;

        const newGlobalVolume = parseFloat(settingsGlobalVolumeSlider.value);
        if (peerSuiteSettings.globalVolume !== newGlobalVolume) {
            peerSuiteSettings.globalVolume = newGlobalVolume;
            // mediaModuleRef.setGlobalVolume handles applying it if it exists
        }
        // All settings are applied live by their respective 'input' or 'change' handlers where appropriate,
        // or here for settings without live handlers (like videoFlip, pttEnabled itself).
        // The main purpose of "Save" is to persist to localStorage.

        saveSettings();

        // Apply settings that might need explicit re-application or don't have live handlers
        if (window.mediaModuleRef) {
            if (window.mediaModuleRef.setLocalVideoFlip) {
                 window.mediaModuleRef.setLocalVideoFlip(peerSuiteSettings.videoFlip);
            }
            if (window.mediaModuleRef.updatePttSettings) {
                window.mediaModuleRef.updatePttSettings(peerSuiteSettings.pttEnabled, peerSuiteSettings.pttKey, peerSuiteSettings.pttKeyDisplay);
            }
            if (window.mediaModuleRef.setGlobalVolume) { // Ensure it's set from the potentially saved value
                window.mediaModuleRef.setGlobalVolume(peerSuiteSettings.globalVolume, true);
            }
        }
        logStatus("Settings saved.");
    });
}

if (settingsGlobalVolumeSlider && globalVolumeValue) {
    settingsGlobalVolumeSlider.addEventListener('input', () => {
        const volume = parseFloat(settingsGlobalVolumeSlider.value);
        globalVolumeValue.textContent = `${Math.round(volume * 100)}%`;
        if (window.mediaModuleRef && window.mediaModuleRef.setGlobalVolume) {
            window.mediaModuleRef.setGlobalVolume(volume, true); // Apply live
        }
    });
}


function initTheme() {
    const savedTheme = localStorage.getItem('viewPartyTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggle(savedTheme);
    
    const shareModule = window.shareModuleRef;
    if (shareModule && shareModule.redrawWhiteboardFromHistoryIfVisible) {
        shareModule.redrawWhiteboardFromHistoryIfVisible();
    }
}

function updateThemeToggle(currentTheme) {
    if (!themeToggle) return;
    
    switch(currentTheme) {
        case 'light':
            themeToggle.checked = false;
            break;
        case 'dark':
            themeToggle.checked = true;
            break;
        case 'frutiger':
            themeToggle.checked = false; // Or true, depending on your toggle sequence preference
            break;
    }
    updateThemeLabel();
}

function cycleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    let nextTheme;
    
    switch(currentTheme) {
        case 'light':
            nextTheme = 'dark';
            break;
        case 'dark':
            nextTheme = 'frutiger';
            break;
        case 'frutiger':
            nextTheme = 'light';
            break;
        default:
            nextTheme = 'light';
    }
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('viewPartyTheme', nextTheme);
    updateThemeToggle(nextTheme);
    
    const shareModule = window.shareModuleRef;
    if (shareModule && shareModule.redrawWhiteboardFromHistoryIfVisible) {
        shareModule.redrawWhiteboardFromHistoryIfVisible();
    }
    
    logStatus(`Theme changed to: ${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)}`);
}

function updateThemeLabel() {
    if (!themeToggle || !themeToggle.closest('.theme-switch')) return;
    
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const themeSwitch = themeToggle.closest('.theme-switch');
    
    switch(currentTheme) {
        case 'light':
            themeSwitch.setAttribute('data-theme-name', 'Light');
            break;
        case 'dark':
            themeSwitch.setAttribute('data-theme-name', 'Dark');
            break;
        case 'frutiger':
            themeSwitch.setAttribute('data-theme-name', 'Aero');
            break;
    }
}


if (themeToggle) {
    themeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        cycleTheme();
    });
}

sidebarButtons.forEach(button => {
    if (button.id === 'exportWorkspaceBtnSidebar') return;

    button.addEventListener('click', () => {
        const targetSectionId = button.getAttribute('data-section');
        const targetSectionElement = document.getElementById(targetSectionId);

        if (currentActiveSection === targetSectionId && targetSectionElement && !targetSectionElement.classList.contains('hidden')) {
            return;
        }

        sidebarButtons.forEach(btn => {
            if (btn.id !== 'exportWorkspaceBtnSidebar') btn.classList.remove('active');
        });
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
        if (targetSectionId === 'videoChatSection' && window.mediaModuleRef && window.mediaModuleRef.setLocalVideoFlip) {
            window.mediaModuleRef.setLocalVideoFlip(peerSuiteSettings.videoFlip, true);
        }
        if (targetSectionId === 'settingsSection') {
            populateSettingsSection();
            if (isCapturingPttKey) {
                isCapturingPttKey = false;
                if (pttKeyInstructions) pttKeyInstructions.classList.add('hidden');
                if (settingsPttKeyBtn) settingsPttKeyBtn.classList.remove('hidden');
                document.removeEventListener('keydown', handlePttKeyCapture, true);
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

function logStatus(message, isError = false) {
    console.log(message);
    if (isError) {
        console.error("PeerSuite Error:", message);
        if (window.shareModuleRef && window.shareModuleRef.displaySystemMessage) {
            window.shareModuleRef.displaySystemMessage(`Error: ${message}`);
        }
    } else {
        if (window.shareModuleRef && window.shareModuleRef.displaySystemMessage) {
            window.shareModuleRef.displaySystemMessage(message);
        }
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
    const fragment = document.createDocumentFragment();
    let count = 0;

    const selfLi = document.createElement('li');
    const selfBadge = document.createElement('span');
    selfBadge.className = 'status-badge';
    selfLi.appendChild(selfBadge);
    selfLi.appendChild(document.createTextNode(` ${escapeHtml(localNickname)} (You)${isHost ? ' (Host)' : ''}`));
    fragment.appendChild(selfLi);
    count++;

    for (const peerId in peerNicknames) {
        const nickname = peerNicknames[peerId];
        const li = document.createElement('li');
        li.classList.add('peer-name-container');
        li.dataset.peerId = peerId;

        const nameAndPmContainer = document.createElement('div');
        nameAndPmContainer.className = 'peer-info-clickable';
        const peerBadge = document.createElement('span');
        peerBadge.className = 'status-badge';
        nameAndPmContainer.appendChild(peerBadge);
        nameAndPmContainer.appendChild(document.createTextNode(` ${escapeHtml(nickname)}`));
        nameAndPmContainer.title = `Click to private message ${escapeHtml(nickname)}`;
        nameAndPmContainer.addEventListener('click', () => {
            const shareModule = window.shareModuleRef;
            if (shareModule && shareModule.primePrivateMessage) {
                shareModule.primePrivateMessage(nickname);
            }
        });
        li.appendChild(nameAndPmContainer);

        const volumeControlContainer = document.createElement('div');
        volumeControlContainer.className = 'peer-volume-control'; // Always visible for connected peers

        const volumeIcon = document.createElement('span');
        volumeIcon.textContent = '🔊';
        volumeIcon.className = 'volume-icon';
        volumeControlContainer.appendChild(volumeIcon);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.01';
        
        let currentIndividualVolume = 1;
        if (window.mediaModuleRef && window.mediaModuleRef.getIndividualVolume) {
             currentIndividualVolume = window.mediaModuleRef.getIndividualVolume(peerId);
        }
        slider.value = currentIndividualVolume.toString();

        slider.className = 'peer-volume-slider';
        slider.title = `Volume for ${escapeHtml(nickname)}`;
        slider.addEventListener('input', (e) => {
            if (window.mediaModuleRef && window.mediaModuleRef.setIndividualVolume) {
                window.mediaModuleRef.setIndividualVolume(peerId, parseFloat(e.target.value));
            }
        });
        volumeControlContainer.appendChild(slider);
        li.appendChild(volumeControlContainer);

        fragment.appendChild(li);
        count++;
    }
    userListUl.innerHTML = '';
    userListUl.appendChild(fragment);
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

async function deriveKeyFromPassword_ImportExport(password, salt) {
    const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 750000, hash: "SHA-256" }, keyMaterial, { name: CRYPTO_ALGO, length: 256 }, true, ["encrypt", "decrypt"]);
}

if (exportWorkspaceBtnSidebar) {
    exportWorkspaceBtnSidebar.addEventListener('click', async () => {
        if (!roomApi) { logStatus("You must be in a workspace to export.", true); return; }
        const password = prompt("Enter a password to encrypt the workspace data (this is for the file, not the workspace access password):");
        if (!password) { logStatus("Export cancelled: No password provided.", true); return; }

        try {
            logStatus("Exporting workspace...");
            const shareData = getShareableData();

            const workspaceState = {
                ...shareData,
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
        } catch (error) {
            console.error("Error exporting workspace:", error);
            logStatus("Error exporting workspace: " + error.message, true);
        }
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
            if (!importedWorkspaceState ||
                typeof importedWorkspaceState.kanbanData === 'undefined' ||
                typeof importedWorkspaceState.whiteboardHistory === 'undefined' ||
                typeof importedWorkspaceState.documents === 'undefined' ||
                typeof importedWorkspaceState.currentActiveDocumentId === 'undefined' ||
                typeof importedWorkspaceState.channels === 'undefined' ||
                typeof importedWorkspaceState.chatHistory === 'undefined'
            ) {
                throw new Error("Invalid or incomplete workspace file structure.");
            }
            if (importedWorkspaceState.roomId && roomIdInput && !roomIdInput.value) { roomIdInput.value = importedWorkspaceState.roomId; }
            logStatus(`Workspace "${file.name}" decrypted. Enter workspace password and create/join to apply. (Imported ${importedWorkspaceState.roomId || 'data'})`);
        } catch (error) {
            console.error("Error importing workspace:", error);
            logStatus("Error importing: " + (error.message.includes("decrypt") ? "Incorrect password or corrupted file." : error.message), true);
            importedWorkspaceState = null;
        } finally { importFilePicker.value = ''; }
    });
}


async function joinRoomAndSetup() {
    localNickname = nicknameInput.value.trim();
    if (!localNickname) {
        logStatus("Please enter a nickname.", true);
        return;
    }
    localStorage.setItem('viewPartyNickname', localNickname);
    populateSettingsSection(); // Ensure settings UI reflects the nickname

    const roomPassword = roomPasswordInput.value;
    if (!roomPassword) {
        logStatus("Workspace password is required.", true);
        // Re-enable setup buttons if password is missing
        if(createPartyBtn) createPartyBtn.disabled = false;
        if(joinWorkspaceBtn) joinWorkspaceBtn.disabled = false;
        if(importWorkspaceBtn) importWorkspaceBtn.disabled = false;
        if(nicknameInput) nicknameInput.disabled = false;
        if(roomIdInput) roomIdInput.disabled = false;
        if(roomPasswordInput) roomPasswordInput.disabled = false;
        if(joinPasswordInput) joinPasswordInput.disabled = false;
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
            // Re-enable setup buttons
            if(createPartyBtn) createPartyBtn.disabled = false;
            if(joinWorkspaceBtn) joinWorkspaceBtn.disabled = false;
            if(importWorkspaceBtn) importWorkspaceBtn.disabled = false;
            if(nicknameInput) nicknameInput.disabled = false;
            if(roomIdInput) roomIdInput.disabled = false;
            if(roomPasswordInput) roomPasswordInput.disabled = false;
            if(joinPasswordInput) joinPasswordInput.disabled = false;
            return;
        }
    }

    const sanitizedRoomId = roomIdToJoin.toLowerCase().replace(/[\s,]+/g, '-');
    if (roomIdToJoin !== sanitizedRoomId) {
        logStatus(`Using sanitized Room Code: ${sanitizedRoomId}`);
        if(roomIdInput) roomIdInput.value = sanitizedRoomId;
    }
    currentRoomId = sanitizedRoomId;

    logStatus(`Connecting to workspace: ${currentRoomId}...`);
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
        logStatus("Setting up workspace features...");

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
            sendChatMessage, sendPrivateMessage, sendFileMeta, sendFileChunk,
            sendChatHistory, sendCreateChannel, sendInitialChannels,
            sendDrawCommand, sendInitialWhiteboard,
            sendKanbanUpdate, sendInitialKanban,
            sendInitialDocuments, sendCreateDocument, sendRenameDocument,
            sendDeleteDocument, sendDocumentContentUpdate,
            logStatus, showNotification,
            localGeneratedPeerId,
            getPeerNicknames: () => peerNicknames,
            getIsHost: () => isHost,
            getLocalNickname: () => localNickname,
            findPeerIdByNicknameFnc: findPeerIdByNickname,
            getImportedWorkspaceState: () => importedWorkspaceState,
            clearImportedWorkspaceState: () => { importedWorkspaceState = null; },
            currentRoomId: currentRoomId,
        };
        window.shareModuleRef = initShareFeatures(shareModuleDeps);

        const mediaModuleDeps = {
            roomApi, logStatus, showNotification,
            localGeneratedPeerId,
            getPeerNicknames: () => peerNicknames,
            getLocalNickname: () => localNickname,
            initialVideoFlip: peerSuiteSettings.videoFlip,
            initialPttEnabled: peerSuiteSettings.pttEnabled,
            initialPttKey: peerSuiteSettings.pttKey,
            initialPttKeyDisplay: peerSuiteSettings.pttKeyDisplay,
            initialGlobalVolume: peerSuiteSettings.globalVolume,
            updateUserList: updateUserList, // Pass updateUserList for dynamic UI updates
        };
        window.mediaModuleRef = initMediaFeatures(mediaModuleDeps);

        if (importedWorkspaceState && isHost) {
            logStatus("Applying imported workspace data...");
            // Share module's initShareFeatures should handle loading this via getImportedWorkspaceState
        } else if (isHost && window.shareModuleRef.ensureDefaultDocument) {
            window.shareModuleRef.ensureDefaultDocument();
        }

        // Setup Trystero event handlers
        onChatMessage((data, peerId) => window.shareModuleRef.handleChatMessage(data, peerId));
        onPrivateMessage((data, peerId) => window.shareModuleRef.handlePrivateMessage(data, peerId));
        onFileMeta((data, peerId) => window.shareModuleRef.handleFileMeta(data, peerId));
        onFileChunk((data, peerId, chunkMeta) => window.shareModuleRef.handleFileChunk(data, peerId, chunkMeta));

        onDrawCommand((data, peerId) => window.shareModuleRef.handleDrawCommand(data, peerId));
        onInitialWhiteboard((data, peerId) => window.shareModuleRef.handleInitialWhiteboard(data, peerId)); // getIsHost() is internal to share.js
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
            // if(window.shareModuleRef && setShareModulePeerInfo) setShareModulePeerInfo(peerNicknames); // Likely not needed

            if (initialJoin && peerId !== localGeneratedPeerId) {
                if (!oldNickname || oldNickname !== nickname) {
                    if(window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`${escapeHtml(nickname)}${peerIsHost ? ' (Host)' : ''} has joined.`);
                }
                if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: false, isHost: isHost }, peerId);
            } else if (oldNickname && oldNickname !== nickname) {
                 if(window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`${escapeHtml(oldNickname)} is now known as ${escapeHtml(nickname)}.`);
            }
            updateUserList();
             if (window.mediaModuleRef && window.mediaModuleRef.updatePeerNicknameInUI) {
                window.mediaModuleRef.updatePeerNicknameInUI(peerId, nickname);
            }
        });

        roomApi.onPeerJoin(async (joinedPeerId) => {
            logStatus("Syncing with new peer...");
            if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: true, isHost: isHost }, joinedPeerId);

            if (window.mediaModuleRef && typeof setupMediaForNewPeer === 'function') setupMediaForNewPeer(joinedPeerId);

            if (isHost && window.shareModuleRef && window.shareModuleRef.sendFullStateToPeer) {
                 window.shareModuleRef.sendFullStateToPeer(joinedPeerId);
            }
            updateUserList(); // New peer joined, update the list
        });

        roomApi.onPeerLeave(leftPeerId => {
            const departedUser = peerNicknames[leftPeerId] || `Peer ${leftPeerId.substring(0, 6)}`;
            if(window.shareModuleRef && window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`${escapeHtml(departedUser)} has left.`);
            delete peerNicknames[leftPeerId];
            // if(window.shareModuleRef && typeof setShareModulePeerInfo === 'function') setShareModulePeerInfo(peerNicknames); // Likely not needed
            if(typeof handleShareModulePeerLeave === 'function') handleShareModulePeerLeave(leftPeerId);
            if (window.mediaModuleRef && typeof cleanupMediaForPeer === 'function') cleanupMediaForPeer(leftPeerId);
            updateUserList(); // Peer left, update the list
        });

        roomApi.onPeerStream((stream, peerId, metadata) => {
            if (window.mediaModuleRef && typeof handleMediaPeerStream === 'function') handleMediaPeerStream(stream, peerId, metadata);
            // Note: updateUserList might be called from within media.js if a stream starts/stops,
            // which is fine if we need to update based on that specific event.
        });

        logStatus("Finalizing workspace setup...");

        if(setupSection) setupSection.classList.add('hidden');
        if(inRoomInterface) inRoomInterface.classList.remove('hidden');
        if(currentRoomCodeSpan) currentRoomCodeSpan.textContent = currentRoomId; 
        if(currentNicknameSpan) currentNicknameSpan.textContent = escapeHtml(localNickname); 

        if (window.mediaModuleRef && window.mediaModuleRef.enableMediaButtons) window.mediaModuleRef.enableMediaButtons();

        // Send own nickname to existing peers
        if (sendNickname) await sendNickname({ nickname: localNickname, initialJoin: true, isHost: isHost }, Object.keys(roomApi.getPeers()).filter(p => p !== localGeneratedPeerId));
        updateUserList(); // Initial user list after joining
        // if(window.shareModuleRef && typeof setShareModulePeerInfo === 'function') setShareModulePeerInfo(peerNicknames); // Likely not needed

        if(window.shareModuleRef && window.shareModuleRef.displaySystemMessage) window.shareModuleRef.displaySystemMessage(`You joined workspace: ${currentRoomId} as ${escapeHtml(localNickname)}${isHost ? ' (Host)' : ''}.`);

        const shareModule = window.shareModuleRef;
        if (shareModule) {
            if (currentActiveSection === 'whiteboardSection' && shareModule.resizeWhiteboardAndRedraw) {
                 shareModule.resizeWhiteboardAndRedraw();
            } else if (shareModule.redrawWhiteboardFromHistoryIfVisible) {
                shareModule.redrawWhiteboardFromHistoryIfVisible(true);
            }

            if (currentActiveSection === 'kanbanSection' && shareModule.renderKanbanBoardIfActive) {
                shareModule.renderKanbanBoardIfActive();
            } else if (shareModule.renderKanbanBoardIfActive) {
                 shareModule.renderKanbanBoardIfActive(true);
            }
            if (currentActiveSection === 'documentsSection' && shareModule.renderDocumentsIfActive) {
                 shareModule.renderDocumentsIfActive();
            } else if (shareModule.renderDocumentsIfActive) {
                shareModule.renderDocumentsIfActive(true);
            }
        }

        if (window.mediaModuleRef) {
            if (window.mediaModuleRef.setLocalVideoFlip) {
                window.mediaModuleRef.setLocalVideoFlip(peerSuiteSettings.videoFlip);
            }
            if (window.mediaModuleRef.updatePttSettings) {
                window.mediaModuleRef.updatePttSettings(peerSuiteSettings.pttEnabled, peerSuiteSettings.pttKey, peerSuiteSettings.pttKeyDisplay);
            }
            if (window.mediaModuleRef.setGlobalVolume) {
                window.mediaModuleRef.setGlobalVolume(peerSuiteSettings.globalVolume, true);
            }
        }

        logStatus(`Connected to workspace: ${currentRoomId}`);

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
    // Reset all Trystero action variables
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

    // Re-enable setup form fields and buttons
    if(createPartyBtn) createPartyBtn.disabled = false;
    if(joinWorkspaceBtn) joinWorkspaceBtn.disabled = false;
    if(importWorkspaceBtn) importWorkspaceBtn.disabled = false;
    if(confirmCreateBtn) confirmCreateBtn.disabled = false; // ensure these are re-enabled
    if(confirmJoinBtn) confirmJoinBtn.disabled = false;   // ensure these are re-enabled

    if(createWorkspaceFields) createWorkspaceFields.classList.add('hidden');
    if(joinWorkspaceFields) joinWorkspaceFields.classList.add('hidden');

    if(nicknameInput) nicknameInput.disabled = false;
    if(roomIdInput) { roomIdInput.disabled = false; roomIdInput.value = ''; }
    if(roomPasswordInput) { roomPasswordInput.disabled = false; roomPasswordInput.value = ''; }
    if(joinPasswordInput) { joinPasswordInput.disabled = false; joinPasswordInput.value = ''; }


    if (window.mediaModuleRef && window.mediaModuleRef.resetMediaUIAndState) window.mediaModuleRef.resetMediaUIAndState();

    if (window.shareModuleRef && typeof resetShareModuleStates === 'function') {
        resetShareModuleStates();
        if (window.shareModuleRef.hideEmojiPicker) window.shareModuleRef.hideEmojiPicker();
    }

    if(userListUl) userListUl.innerHTML = '';
    if (userCountSpan) userCountSpan.textContent = '0';
    sidebarButtons.forEach(btn => {
        if (btn.id !== 'exportWorkspaceBtnSidebar') btn.classList.remove('active');
        clearNotification(btn.dataset.section);
    });
    if (settingsSection) settingsSection.classList.add('hidden');

    contentSections.forEach(section => section.classList.add('hidden'));

    const defaultSectionButton = document.querySelector('.sidebar-button[data-section="chatSection"]');
    const defaultSection = document.getElementById('chatSection');
    if (defaultSectionButton) defaultSectionButton.classList.add('active');
    if (defaultSection) defaultSection.classList.remove('hidden');
    currentActiveSection = 'chatSection';

    peerNicknames = {};
    isHost = false;
    currentRoomId = '';
    importedWorkspaceState = null;
    // loadSettings(); // Reload settings to ensure UI reflects last saved state or defaults
    // populateSettingsSection(); // Called by loadSettings
}

// Event listeners for setup buttons
if (createPartyBtn) {
    createPartyBtn.addEventListener('click', () => {
        if (joinWorkspaceFields) joinWorkspaceFields.classList.add('hidden');
        if (createWorkspaceFields) createWorkspaceFields.classList.remove('hidden');
        if (roomPasswordInput) roomPasswordInput.focus();
    });
}

if (joinWorkspaceBtn) {
    joinWorkspaceBtn.addEventListener('click', () => {
        if (createWorkspaceFields) createWorkspaceFields.classList.add('hidden');
        if (joinWorkspaceFields) joinWorkspaceFields.classList.remove('hidden');
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
        if (joinPasswordInput && roomPasswordInput) { // Ensure roomPasswordInput gets value from joinPasswordInput
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

// Initial setup
localNickname = localStorage.getItem('viewPartyNickname') || '';
if (nicknameInput) {
    nicknameInput.value = localNickname;
    nicknameInput.addEventListener('input', () => { // Save nickname as user types
        localStorage.setItem('viewPartyNickname', nicknameInput.value.trim());
    });
}

if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    console.warn("Screen sharing not supported by your browser.");
}
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn("Video/Audio capture not supported by your browser.");
}

const themeToggleCSS = `
.theme-switch::after {
    content: attr(data-theme-name);
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7em;
    color: var(--text-secondary);
    margin-top: 4px;
    white-space: nowrap;
    pointer-events: none;
}
[data-theme="frutiger"] .theme-switch-track::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(125, 206, 160, 0.2) 100%);
    border-radius: inherit;
    animation: aurora-glow 3s ease-in-out infinite;
}
@keyframes aurora-glow {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
}
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = themeToggleCSS;
document.head.appendChild(styleSheet);

initTheme();
loadSettings(); // This will also call populateSettingsSection
resetToSetupState(); // This ensures the UI is in the correct initial state.
updateThemeLabel();

console.log('PeerSuite: Enter username and choose an action: Create, Join, or Import a workspace.');
if (setupSection && !setupSection.classList.contains('hidden')) {
    const existingMessage = setupSection.querySelector('p.initial-setup-message');
    if (existingMessage) existingMessage.remove(); // Remove old message if it exists

    const initialSetupMessage = document.createElement('p');
    initialSetupMessage.className = 'initial-setup-message'; // Add a class for potential removal
    initialSetupMessage.textContent = 'Enter username and choose an action: Create, Join, or Import a workspace.';
    initialSetupMessage.style.textAlign = 'center';
    initialSetupMessage.style.marginTop = 'var(--space-md)';
    initialSetupMessage.style.color = 'var(--text-secondary)';
    setupSection.appendChild(initialSetupMessage);
}