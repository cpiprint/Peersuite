
let localScreenShareStream;
let localVideoCallStream;
let localAudioStream;

let peerVideoElements = {}; // { peerId: { wrapper, video, stream, nicknameP } }
let peerAudios = {}; // { peerId: audio_element }


let localVideoPreviewElement = null;
let localVideoFlipped = false; // For video flip setting


let pttEnabled = false;
let pttKey = 'Space';
let pttKeyDisplay = 'Space';
let isPttKeyDown = false;


let roomApiDep, logStatusDep, showNotificationDep;
let localGeneratedPeerIdDep;
let getPeerNicknamesDep, getLocalNicknameDep;

// --- DOM Elements ---
let startShareBtn, stopShareBtn, remoteVideosContainer;
let localScreenSharePreviewContainer, localScreenSharePreviewVideo; 

let startVideoCallBtn, stopVideoCallBtn, remoteVideoChatContainer;
let toggleLocalVideoPreviewCheckbox; 

let startAudioCallBtn, stopAudioCallBtn, audioChatStatus;

function selectMediaDomElements() {
    startShareBtn = document.getElementById('startShareBtn');
    stopShareBtn = document.getElementById('stopShareBtn');
    remoteVideosContainer = document.getElementById('remoteVideosContainer');
    localScreenSharePreviewContainer = document.getElementById('localScreenSharePreviewContainer');
    localScreenSharePreviewVideo = document.getElementById('localScreenSharePreviewVideo');

    startVideoCallBtn = document.getElementById('startVideoCallBtn');
    stopVideoCallBtn = document.getElementById('stopVideoCallBtn');
    remoteVideoChatContainer = document.getElementById('remoteVideoChatContainer');
    toggleLocalVideoPreviewCheckbox = document.getElementById('toggleLocalVideoPreviewCheckbox');

    startAudioCallBtn = document.getElementById('startAudioCallBtn');
    stopAudioCallBtn = document.getElementById('stopAudioCallBtn');
    audioChatStatus = document.getElementById('audioChatStatus');
}


// --- Initialization ---
export function initMediaFeatures(dependencies) {
    selectMediaDomElements();

    roomApiDep = dependencies.roomApi;
    logStatusDep = dependencies.logStatus;
    showNotificationDep = dependencies.showNotification;
    localGeneratedPeerIdDep = dependencies.localGeneratedPeerId;
    getPeerNicknamesDep = dependencies.getPeerNicknames;
    getLocalNicknameDep = dependencies.getLocalNickname;

 
    if (typeof dependencies.initialVideoFlip === 'boolean') {
        localVideoFlipped = dependencies.initialVideoFlip;
    }
    if (typeof dependencies.initialPttEnabled === 'boolean') {
        pttEnabled = dependencies.initialPttEnabled;
    }
    if (dependencies.initialPttKey) {
        pttKey = dependencies.initialPttKey;
    }
    if (dependencies.initialPttKeyDisplay) {
        pttKeyDisplay = dependencies.initialPttKeyDisplay;
    }
    
0
    if (pttEnabled) {
        window.addEventListener('keydown', handlePttKeyDown);
        window.addEventListener('keyup', handlePttKeyUp);
    }
    updateAudioChatStatusUI();


    if(startShareBtn) startShareBtn.addEventListener('click', startScreenSharing);
    if(stopShareBtn) stopShareBtn.addEventListener('click', () => stopLocalScreenShare(true));

    if(startVideoCallBtn) startVideoCallBtn.addEventListener('click', startLocalVideoCall);
    if(stopVideoCallBtn) stopVideoCallBtn.addEventListener('click', () => stopLocalVideoCall(true));

    if (toggleLocalVideoPreviewCheckbox) {
        toggleLocalVideoPreviewCheckbox.addEventListener('change', () => {
            if (localVideoCallStream) { // Only toggle if stream exists
                if (toggleLocalVideoPreviewCheckbox.checked) {
                    addLocalVideoToGrid();
                } else {
                    removeLocalVideoFromGrid();
                }
            }
        });
    }

    if(startAudioCallBtn) startAudioCallBtn.addEventListener('click', startLocalAudioCall);
    if(stopAudioCallBtn) stopAudioCallBtn.addEventListener('click', () => stopLocalAudioCall(true));

    checkMediaCapabilities();

    return {
        enableMediaButtons,
        resetMediaUIAndState,
        updatePeerNicknameInUI,
        setLocalVideoFlip,
        updatePttSettings,
    };
}

function checkMediaCapabilities() {
    const noDisplayMedia = !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia;
    const noGetUserMedia = !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia;

    if(startShareBtn) {
        startShareBtn.disabled = noDisplayMedia;
        if (noDisplayMedia) startShareBtn.title = "Screen sharing not supported";
        else startShareBtn.title = "Start sharing your screen";
    }
    if(stopShareBtn) stopShareBtn.disabled = true;


    if(startVideoCallBtn) {
        startVideoCallBtn.disabled = noGetUserMedia;
        if (noGetUserMedia) startVideoCallBtn.title = "Video/Audio not supported";
        else startVideoCallBtn.title = "Start Video Call";
    }
    if(stopVideoCallBtn) stopVideoCallBtn.disabled = true;

    if(startAudioCallBtn) {
        startAudioCallBtn.disabled = noGetUserMedia;
        if (noGetUserMedia) startAudioCallBtn.title = "Audio not supported";
        else startAudioCallBtn.title = "Start Audio Call";
    }
    if(stopAudioCallBtn) stopAudioCallBtn.disabled = true;
}


export function enableMediaButtons() {
    checkMediaCapabilities();
    if(startShareBtn && startShareBtn.title !== "Screen sharing not supported") startShareBtn.disabled = false;
    if(stopShareBtn) stopShareBtn.disabled = true;

    if(startVideoCallBtn && startVideoCallBtn.title !== "Video/Audio not supported") startVideoCallBtn.disabled = false;
    if(stopVideoCallBtn) stopVideoCallBtn.disabled = true;

    if(startAudioCallBtn && startAudioCallBtn.title !== "Audio not supported") startAudioCallBtn.disabled = false;
    if(stopAudioCallBtn) stopAudioCallBtn.disabled = true;

    updateAudioChatStatusUI(); 
}


// --- Screen Share ---
async function startScreenSharing() {
    if (!roomApiDep) { logStatusDep("Not in a room.", true); return; }
    try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            logStatusDep("Screen sharing not supported by your browser.", true);
            return;
        }
        if (localScreenShareStream) await stopLocalScreenShare(true);

        localScreenShareStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } // Example good audio settings for screen share
        });

        if (localScreenSharePreviewVideo && localScreenSharePreviewContainer) {
            localScreenSharePreviewVideo.srcObject = localScreenShareStream;
            localScreenSharePreviewContainer.classList.remove('hidden');
        }

        await roomApiDep.addStream(localScreenShareStream, null, { streamType: 'screenshare' });
        if(startShareBtn) startShareBtn.disabled = true;
        if(stopShareBtn) stopShareBtn.disabled = false;
        showNotificationDep('screenShareSection');

        localScreenShareStream.getVideoTracks().forEach(track => {
            track.onended = () => stopLocalScreenShare(true);
        });

    } catch (err) {
        console.error("Error starting screen share:", err);
        logStatusDep(`Error starting share: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}`, true);
        if (localScreenShareStream) {
            localScreenShareStream.getTracks().forEach(track => track.stop());
            localScreenShareStream = null;
        }
        if (localScreenSharePreviewVideo && localScreenSharePreviewContainer) { // Also hide preview on error
            localScreenSharePreviewVideo.srcObject = null;
            localScreenSharePreviewContainer.classList.add('hidden');
        }
        if (roomApiDep && startShareBtn && stopShareBtn) { startShareBtn.disabled = false; stopShareBtn.disabled = true; }
    }
}

async function stopLocalScreenShare(updateButtons = true) {
    logStatusDep("Stopping screen share...");
    if (localScreenShareStream) {
        if (roomApiDep?.removeStream) {
            try { await roomApiDep.removeStream(localScreenShareStream, null, { streamType: 'screenshare' }); }
            catch (e) { console.error("Exception calling roomApi.removeStream for screen share:", e); }
        }
        localScreenShareStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localScreenShareStream = null;
    }

    if (localScreenSharePreviewVideo && localScreenSharePreviewContainer) {
        localScreenSharePreviewVideo.srcObject = null;
        localScreenSharePreviewContainer.classList.add('hidden');
    }

    if (updateButtons && roomApiDep && startShareBtn && stopShareBtn) {
        startShareBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) ? false : true;
        stopShareBtn.disabled = true;
    }
}

function displayRemoteScreenShareStream(stream, peerId) {
    const streamPeerNickname = getPeerNicknamesDep()[peerId] || `Peer ${peerId.substring(0, 6)}`;
    logStatusDep(`Receiving Screen Share from ${streamPeerNickname}.`);

    if (!(stream instanceof MediaStream)) {
        console.error("displayRemoteScreenShareStream called with non-MediaStream object:", stream);
        logStatusDep(`Error: Received invalid screen share stream data from ${streamPeerNickname}.`);
        return;
    }

    let videoContainer = document.getElementById(`container-screenshare-${peerId}`);
    let remoteVideo = document.getElementById(`video-screenshare-${peerId}`);

    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = `container-screenshare-${peerId}`;
        videoContainer.classList.add('remoteVideoContainer'); // CSS class for styling

        const peerInfo = document.createElement('p');
        peerInfo.textContent = `Screen from: ${streamPeerNickname}`;
        videoContainer.appendChild(peerInfo);

        remoteVideo = document.createElement('video');
        remoteVideo.id = `video-screenshare-${peerId}`;
        remoteVideo.autoplay = true;
        remoteVideo.playsinline = true;
        videoContainer.appendChild(remoteVideo);

        const maximizeBtn = document.createElement('button');
        maximizeBtn.textContent = 'Maximize';
        maximizeBtn.classList.add('maximize-btn', 'btn'); // Added 'btn' for styling
        maximizeBtn.style.fontSize = '0.8em'; // Smaller button
        maximizeBtn.style.padding = 'var(--space-xs) var(--space-sm)';
        maximizeBtn.onclick = () => {
            if (remoteVideo.requestFullscreen) remoteVideo.requestFullscreen();
            else if (remoteVideo.mozRequestFullScreen) remoteVideo.mozRequestFullScreen();
            else if (remoteVideo.webkitRequestFullscreen) remoteVideo.webkitRequestFullscreen();
            else if (remoteVideo.msRequestFullscreen) remoteVideo.msRequestFullscreen();
        };
        videoContainer.appendChild(maximizeBtn);
        if(remoteVideosContainer) remoteVideosContainer.appendChild(videoContainer);
        else console.error("remoteVideosContainer not found for screen share.")
    }

    if (remoteVideo && remoteVideo.srcObject !== stream) {
        remoteVideo.srcObject = stream;
    }

    stream.onremovetrack = () => {
        if (stream.getTracks().length === 0 && remoteVideo) {
            remoteVideo.srcObject = null;
            logStatusDep(`Screen share stream ended from ${streamPeerNickname}`);
        }
    };
    stream.getTracks().forEach(track => {
        track.onended = () => {
            if ((!stream.active || stream.getTracks().every(t => t.readyState === 'ended')) && remoteVideo) {
                remoteVideo.srcObject = null;
                 logStatusDep(`Screen share track ended from ${streamPeerNickname}`);
            }
        };
    });
    showNotificationDep('screenShareSection');
}

// --- Video Flip ---
export function setLocalVideoFlip(shouldFlip, forceApply = false) {
    if (localVideoFlipped === shouldFlip && !forceApply) return;
    localVideoFlipped = shouldFlip;

    if (localVideoPreviewElement && localVideoPreviewElement.parentNode) {
        const videoEl = localVideoPreviewElement.querySelector('video');
        if (videoEl) {
            videoEl.style.transform = localVideoFlipped ? 'scaleX(-1)' : 'none';
        }
    }
}


// --- Helper functions for local video preview in grid ---
function addLocalVideoToGrid() {
    if (!localVideoCallStream || !remoteVideoChatContainer || localVideoPreviewElement) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('remote-video-wrapper', 'local-preview-in-grid');
    wrapper.id = `vc-wrapper-${localGeneratedPeerIdDep}`;

    const nicknameP = document.createElement('p');
    let localUserNickname = "You";
    try { 
        if (typeof getLocalNicknameDep === 'function' && getLocalNicknameDep()) {
             localUserNickname = getLocalNicknameDep();
        }
    } catch(e) { console.warn("Could not get local nickname for preview:", e)}
    nicknameP.textContent = localUserNickname + " (Preview)";


    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsinline = true;
    videoEl.muted = true;
    videoEl.srcObject = localVideoCallStream;
    videoEl.style.transform = localVideoFlipped ? 'scaleX(-1)' : 'none'; // Apply flip state

    wrapper.appendChild(nicknameP);
    wrapper.appendChild(videoEl);


    if (remoteVideoChatContainer.firstChild) {
        remoteVideoChatContainer.insertBefore(wrapper, remoteVideoChatContainer.firstChild);
    } else {
        remoteVideoChatContainer.appendChild(wrapper);
    }
    localVideoPreviewElement = wrapper;
}

function removeLocalVideoFromGrid() {
    if (localVideoPreviewElement && localVideoPreviewElement.parentNode) {
        localVideoPreviewElement.remove();
    }
    localVideoPreviewElement = null;
}

// --- Video Chat ---
async function startLocalVideoCall() {
    if (!roomApiDep) { logStatusDep("Not in a room to start video call.", true); return; }
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            logStatusDep("Video call not supported by your browser.", true);
            return;
        }
        if (localVideoCallStream) await stopLocalVideoCall(true);

        localVideoCallStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        if (toggleLocalVideoPreviewCheckbox && toggleLocalVideoPreviewCheckbox.checked) {
            addLocalVideoToGrid();
        }

        await roomApiDep.addStream(localVideoCallStream, null, { streamType: 'videochat' });

        if(startVideoCallBtn) startVideoCallBtn.disabled = true;
        if(stopVideoCallBtn) stopVideoCallBtn.disabled = false;
        logStatusDep("Video call started.");
        showNotificationDep('videoChatSection');

        localVideoCallStream.getTracks().forEach(track => {
            track.onended = () => {
                stopLocalVideoCall(true);
            };
        });

    } catch (err) {
        console.error("Error starting video call:", err);
        logStatusDep(`Error starting video call: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}`, true);
        if (localVideoCallStream) { localVideoCallStream.getTracks().forEach(track => track.stop()); localVideoCallStream = null; }
        removeLocalVideoFromGrid();
        if (roomApiDep && startVideoCallBtn && stopVideoCallBtn) {
             startVideoCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true;
             stopVideoCallBtn.disabled = true;
        }
    }
}

async function stopLocalVideoCall(updateButtons = true) {
    logStatusDep("Stopping video call...");
    removeLocalVideoFromGrid();

    if (localVideoCallStream) {
        if (roomApiDep?.removeStream) {
            try { await roomApiDep.removeStream(localVideoCallStream, null, { streamType: 'videochat' }); }
            catch (e) { console.error("Exception calling roomApi.removeStream for video call:", e); }
        }
        localVideoCallStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localVideoCallStream = null;
    }

    if (updateButtons && roomApiDep && startVideoCallBtn && stopVideoCallBtn) {
        startVideoCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true;
        stopVideoCallBtn.disabled = true;
    }
}

function handleIncomingVideoChatStream(stream, peerId) {
    if (peerId === localGeneratedPeerIdDep) return; 
    const streamPeerNickname = getPeerNicknamesDep()[peerId] || `User ${peerId.substring(0, 6)}`;
    logStatusDep(`Receiving Video Chat stream from ${streamPeerNickname}.`);

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
        if(remoteVideoChatContainer) remoteVideoChatContainer.appendChild(wrapper);
        else console.error("remoteVideoChatContainer not found for video chat.")

        peerElement = { wrapper, video: videoEl, stream, nicknameP };
        peerVideoElements[peerId] = peerElement;
    }

    if (peerElement.video.srcObject !== stream) {
        peerElement.video.srcObject = stream;
        peerElement.stream = stream;
    }
    if (peerElement.nicknameP.textContent !== streamPeerNickname) {
        peerElement.nicknameP.textContent = streamPeerNickname;
    }

    stream.onremovetrack = () => {
        if (stream.getTracks().length === 0 && peerVideoElements[peerId]) {
            if (peerVideoElements[peerId].video) peerVideoElements[peerId].video.srcObject = null;
            logStatusDep(`Video chat stream ended from ${streamPeerNickname}`);
        }
    };
    stream.getTracks().forEach(track => {
        track.onended = () => {
            if ((!stream.active || stream.getTracks().every(t => t.readyState === 'ended')) && peerVideoElements[peerId]) {
                if (peerVideoElements[peerId].video) peerVideoElements[peerId].video.srcObject = null;
                logStatusDep(`Video chat track ended from ${streamPeerNickname}`);
            }
        };
    });
    showNotificationDep('videoChatSection');
}


// --- Audio Chat & PTT ---
function updateAudioChatStatusUI() {
    if (!audioChatStatus) return;
    if (localAudioStream) {
        audioChatStatus.classList.remove('hidden');
        if (pttEnabled) {
            if (isPttKeyDown) {
                audioChatStatus.textContent = `PTT: Transmitting... (Release '${pttKeyDisplay}' to mute)`;
            } else {
                audioChatStatus.textContent = `PTT: Muted (Press '${pttKeyDisplay}' to talk)`;
            }
        } else {
            audioChatStatus.textContent = "Audio call active. You are transmitting audio.";
        }
    } else {
        audioChatStatus.classList.add('hidden');
        audioChatStatus.textContent = "Audio call active."; // Default reset
    }
}

export function updatePttSettings(enabled, key, display) {
    const oldPttEnabled = pttEnabled;
    pttEnabled = enabled;
    pttKey = key;
    pttKeyDisplay = display;

    if (localAudioStream) {
        if (pttEnabled) {
            if (!isPttKeyDown) { // Mute if PTT just enabled and key not pressed
                localAudioStream.getAudioTracks().forEach(track => track.enabled = false);
            }
        } else { // PTT disabled, ensure audio is unmuted
            localAudioStream.getAudioTracks().forEach(track => track.enabled = true);
            isPttKeyDown = false; // Reset PTT key state
        }
    }

    if (pttEnabled && !oldPttEnabled) {
        window.addEventListener('keydown', handlePttKeyDown);
        window.addEventListener('keyup', handlePttKeyUp);
    } else if (!pttEnabled && oldPttEnabled) {
        window.removeEventListener('keydown', handlePttKeyDown);
        window.removeEventListener('keyup', handlePttKeyUp);
        isPttKeyDown = false; 
    }
    updateAudioChatStatusUI();
}

function handlePttKeyDown(event) {
    // Ignore if input field is focused or capturing key
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && !settingsModal.classList.contains('hidden')) { // Ignore if settings modal is open
        const pttKeyInstructions = document.getElementById('pttKeyInstructions');
        if (pttKeyInstructions && !pttKeyInstructions.classList.contains('hidden')) { // And actively capturing key
             return;
        }
    }


    if (!pttEnabled || event.code !== pttKey || isPttKeyDown || !localAudioStream) return;
    isPttKeyDown = true;
    localAudioStream.getAudioTracks().forEach(track => track.enabled = true);
    updateAudioChatStatusUI();
}

function handlePttKeyUp(event) {
    // Ignore if input field is focused
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;
    const settingsModal = document.getElementById('settingsModal');
     if (settingsModal && !settingsModal.classList.contains('hidden')) { // Ignore if settings modal is open
        const pttKeyInstructions = document.getElementById('pttKeyInstructions');
        if (pttKeyInstructions && !pttKeyInstructions.classList.contains('hidden')) { // And actively capturing key
             return;
        }
    }

    if (!pttEnabled || event.code !== pttKey || !localAudioStream || !isPttKeyDown) return; // only trigger if key was actually down
    isPttKeyDown = false;
    localAudioStream.getAudioTracks().forEach(track => track.enabled = false);
    updateAudioChatStatusUI();
}


async function startLocalAudioCall() {
    if (!roomApiDep) { logStatusDep("Not in a room to start audio call.", true); return; }
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            logStatusDep("Audio capture not supported by your browser.", true);
            return;
        }
        if (localAudioStream) await stopLocalAudioCall(true);

        logStatusDep("Requesting microphone access...");
        localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        logStatusDep("Microphone access granted. Starting audio call...");

        await roomApiDep.addStream(localAudioStream, null, { streamType: 'audiochat' });

        if (pttEnabled && !isPttKeyDown) { // If PTT active, mute initially
            localAudioStream.getAudioTracks().forEach(track => track.enabled = false);
        }

        if(startAudioCallBtn) startAudioCallBtn.disabled = true;
        if(stopAudioCallBtn) stopAudioCallBtn.disabled = false;
        
        updateAudioChatStatusUI();
        showNotificationDep('audioChatSection');

        localAudioStream.getTracks().forEach(track => {
            track.onended = () => stopLocalAudioCall(true);
        });

    } catch (err) {
        console.error("Error starting audio call:", err);
        let userMessage = `Error starting audio call: ${err.message}`;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') userMessage = "Microphone permission denied. Please check browser/site settings.";
        else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') userMessage = "No microphone found. Ensure it's connected and enabled.";
        else if (err.name === 'SecurityError') userMessage = "Microphone access denied (security). Page might need HTTPS.";
        else if (err.name === 'AbortError') userMessage = "Microphone request aborted (hardware error or conflict).";
        else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') userMessage = "Could not read from microphone (in use or hardware/driver issue).";

        logStatusDep(userMessage, true);
        if (localAudioStream) { localAudioStream.getTracks().forEach(track => track.stop()); localAudioStream = null; }
        if (roomApiDep && startAudioCallBtn && stopAudioCallBtn) {
            startAudioCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true;
            stopAudioCallBtn.disabled = true;
        }
        updateAudioChatStatusUI();
    }
}

async function stopLocalAudioCall(updateButtons = true) {
    logStatusDep("Stopping audio call...");
    if (localAudioStream) {
        if (roomApiDep?.removeStream) {
            try { await roomApiDep.removeStream(localAudioStream, null, { streamType: 'audiochat' }); }
            catch (e) { console.error("Exception calling roomApi.removeStream for audio call:", e); }
        }
        // Ensure tracks are enabled before stopping so they aren't left muted by PTT
        localAudioStream.getAudioTracks().forEach(track => track.enabled = true);
        localAudioStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localAudioStream = null;
    }
    isPttKeyDown = false; // Reset PTT key state

    if (updateButtons && roomApiDep && startAudioCallBtn && stopAudioCallBtn) {
        startAudioCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true;
        stopAudioCallBtn.disabled = true;
    }
    updateAudioChatStatusUI();
}

function handleIncomingAudioChatStream(stream, peerId) {
    if (peerId === localGeneratedPeerIdDep) return;
    const streamPeerNickname = getPeerNicknamesDep()[peerId] || `User ${peerId.substring(0, 6)}`;
    logStatusDep(`Receiving Audio Chat stream from ${streamPeerNickname}.`);

    if (peerAudios[peerId]) {
        peerAudios[peerId].pause();
        peerAudios[peerId].srcObject = null;
    }

    let audioEl = peerAudios[peerId];
    if (!audioEl) {
        audioEl = document.createElement('audio');
        document.body.appendChild(audioEl); // Needs to be in DOM to play in some browsers
        peerAudios[peerId] = audioEl;
    }

    audioEl.srcObject = stream;
    audioEl.autoplay = true;
    audioEl.play().catch(e => console.warn(`Audio play failed for ${streamPeerNickname}:`, e));

    audioEl.addEventListener('error', (e) => {
        console.error(`Error with audio element for ${streamPeerNickname}:`, e);
    });

    stream.onremovetrack = () => {
        if (stream.getTracks().length === 0 && peerAudios[peerId]) {
            peerAudios[peerId].pause();
            peerAudios[peerId].srcObject = null;
            logStatusDep(`Audio chat stream ended from ${streamPeerNickname}`);
        }
    };
    stream.getTracks().forEach(track => {
        track.onended = () => {
             if ((!stream.active || stream.getTracks().every(t => t.readyState === 'ended')) && peerAudios[peerId]) {
                peerAudios[peerId].pause();
                peerAudios[peerId].srcObject = null;
                logStatusDep(`Audio chat track ended from ${streamPeerNickname}`);
            }
        };
    });
    showNotificationDep('audioChatSection');
}


export function handleMediaPeerStream(stream, peerId, metadata) {
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
        console.warn(`Received stream from ${peerId} with missing or invalid 'streamType' metadata. Metadata:`, metadata);
    }
}

export async function stopAllLocalMedia(updateButtons = true) {
    if (localScreenShareStream) await stopLocalScreenShare(updateButtons);
    if (localVideoCallStream) await stopLocalVideoCall(updateButtons);
    if (localAudioStream) await stopLocalAudioCall(updateButtons);
}

export function setupMediaForNewPeer(joinedPeerId) {
    if (localVideoCallStream && roomApiDep?.addStream) {
        roomApiDep.addStream(localVideoCallStream, [joinedPeerId], { streamType: 'videochat' });
    }
    if (localAudioStream && roomApiDep?.addStream) {
        roomApiDep.addStream(localAudioStream, [joinedPeerId], { streamType: 'audiochat' });
    }
    if (localScreenShareStream && roomApiDep?.addStream) {
        roomApiDep.addStream(localScreenShareStream, [joinedPeerId], { streamType: 'screenshare' });
    }
}

export function cleanupMediaForPeer(leftPeerId) {
    const screenShareVideoEl = document.getElementById(`container-screenshare-${leftPeerId}`);
    if (screenShareVideoEl) screenShareVideoEl.remove();

    if (peerVideoElements[leftPeerId]) {
        if (peerVideoElements[leftPeerId].video) peerVideoElements[leftPeerId].video.srcObject = null;
        if (peerVideoElements[leftPeerId].wrapper) peerVideoElements[leftPeerId].wrapper.remove();
        delete peerVideoElements[leftPeerId];
    }

    if (peerAudios[leftPeerId]) {
        peerAudios[leftPeerId].pause();
        peerAudios[leftPeerId].srcObject = null;
        if (peerAudios[leftPeerId].parentNode) {
            peerAudios[leftPeerId].remove();
        }
        delete peerAudios[leftPeerId];
    }
}

export function resetMediaUIAndState() {
    if (localScreenShareStream) { localScreenShareStream.getTracks().forEach(t => t.stop()); localScreenShareStream = null; }
    if (localVideoCallStream) { localVideoCallStream.getTracks().forEach(t => t.stop()); localVideoCallStream = null; }
    if (localAudioStream) { localAudioStream.getTracks().forEach(t => t.stop()); localAudioStream = null; }
    isPttKeyDown = false; // Reset PTT key state on full reset

    if(startShareBtn) { startShareBtn.title = ""; }
    if(remoteVideosContainer) remoteVideosContainer.innerHTML = '';
    if(localScreenSharePreviewVideo) localScreenSharePreviewVideo.srcObject = null;
    if(localScreenSharePreviewContainer) localScreenSharePreviewContainer.classList.add('hidden');

    removeLocalVideoFromGrid();
    if(remoteVideoChatContainer) remoteVideoChatContainer.innerHTML = '';
    peerVideoElements = {};
    if (toggleLocalVideoPreviewCheckbox) toggleLocalVideoPreviewCheckbox.checked = true;


    updateAudioChatStatusUI(); // Reset PTT status display
    Object.values(peerAudios).forEach(audioEl => {
        if (audioEl) { audioEl.pause(); audioEl.srcObject = null; if(audioEl.parentNode) audioEl.remove(); }
    });
    peerAudios = {};

    enableMediaButtons();
}

export function updatePeerNicknameInUI(peerId, newNickname) {
    if (peerVideoElements[peerId] && peerVideoElements[peerId].nicknameP) {
        peerVideoElements[peerId].nicknameP.textContent = newNickname;
    }
    
    if (localVideoPreviewElement && peerId === localGeneratedPeerIdDep) {
        const nicknameP = localVideoPreviewElement.querySelector('p');
        if (nicknameP) {
            let currentLocalNickname = "You";
             try { 
                if (typeof getLocalNicknameDep === 'function' && getLocalNicknameDep()) {
                     currentLocalNickname = getLocalNicknameDep();
                }
            } catch(e) { /* ignore */ }
            nicknameP.textContent = (newNickname || currentLocalNickname) + " (Preview)";
        }
    }
    const screenShareContainer = document.getElementById(`container-screenshare-${peerId}`);
    if (screenShareContainer) {
        const pElement = screenShareContainer.querySelector('p');
        if (pElement) {
            pElement.textContent = `Screen from: ${newNickname}`;
        }
    }
}
