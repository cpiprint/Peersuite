// media.js

let localScreenShareStream;
let localVideoCallStream;
let localAudioStream;

let peerVideoElements = {}; // { peerId: { wrapper, video, stream, nicknameP } }
let peerAudios = {}; // { peerId: audio_element }


let localVideoPreviewElement = null;
let localVideoFlipped = false;


let pttEnabled = false;
let pttKey = 'Space';
let pttKeyDisplay = 'Space';
let isPttKeyDown = false;


let roomApiDep, logStatusDep, showNotificationDep;
let localGeneratedPeerIdDep;
let getPeerNicknamesDep, getLocalNicknameDep;

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
            if (localVideoCallStream) {
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
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
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

    // Define a cleanup function for this specific screen share UI
    const cleanupScreenShareUI = () => {
        // Re-fetch elements inside closure to ensure they are current
        const currentVideoContainer = document.getElementById(`container-screenshare-${peerId}`);
        const currentRemoteVideo = document.getElementById(`video-screenshare-${peerId}`);

        if (currentRemoteVideo) {
            currentRemoteVideo.srcObject = null; // Important: clear the srcObject
        }
        if (currentVideoContainer && currentVideoContainer.parentNode) {
            currentVideoContainer.remove(); // Remove the entire container
        }
        // Check if it's already logged or avoid duplicate logs if track.onended also calls this
        // Check if the element is actually gone from the DOM before logging
        if (!document.getElementById(`container-screenshare-${peerId}`)) {
             logStatusDep(`Screen share from ${streamPeerNickname} has ended.`);
        }
    };

    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = `container-screenshare-${peerId}`;
        videoContainer.classList.add('remoteVideoContainer');

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
        maximizeBtn.classList.add('maximize-btn', 'btn');
        maximizeBtn.style.fontSize = '0.8em';
        maximizeBtn.style.padding = 'var(--space-xs) var(--space-sm)';
        maximizeBtn.onclick = () => {
            const videoToMaximize = document.getElementById(`video-screenshare-${peerId}`); // Re-fetch
            if (videoToMaximize) {
                if (videoToMaximize.requestFullscreen) videoToMaximize.requestFullscreen();
                else if (videoToMaximize.mozRequestFullScreen) videoToMaximize.mozRequestFullScreen();
                else if (videoToMaximize.webkitRequestFullscreen) videoToMaximize.webkitRequestFullscreen();
                else if (videoToMaximize.msRequestFullscreen) videoToMaximize.msRequestFullscreen();
            }
        };
        videoContainer.appendChild(maximizeBtn);
        if(remoteVideosContainer) remoteVideosContainer.appendChild(videoContainer);
        else console.error("remoteVideosContainer not found for screen share.")
    }

    if (remoteVideo && remoteVideo.srcObject !== stream) {
        remoteVideo.srcObject = stream;
    }

    stream.oninactive = cleanupScreenShareUI; // Primary handler for stream ending

    stream.getTracks().forEach(track => {
        track.onended = () => {
            // If the stream is no longer active after this track ended, trigger cleanup
            if (!stream.active) {
                cleanupScreenShareUI();
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
    videoEl.style.transform = localVideoFlipped ? 'scaleX(-1)' : 'none';

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
                stopLocalVideoCall(true); // This will handle local cleanup
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

    // Define a cleanup function for this specific video chat UI
    const cleanupVideoChatUI = () => {
        const currentPeerElement = peerVideoElements[peerId]; // Re-fetch in case of closure issues
        if (currentPeerElement) {
            if (currentPeerElement.video) {
                currentPeerElement.video.srcObject = null; // Important: clear the srcObject
            }
            if (currentPeerElement.wrapper && currentPeerElement.wrapper.parentNode) {
                currentPeerElement.wrapper.remove(); // Remove the wrapper
            }
            delete peerVideoElements[peerId]; // Clean up the reference
        }
        // Check if it's already logged or avoid duplicate logs
        if (!peerVideoElements[peerId]) { // Check if already deleted
            logStatusDep(`Video chat from ${streamPeerNickname} has ended.`);
        }
    };

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
        peerElement.stream = stream; // Ensure the stream reference is updated
    }
    if (peerElement.nicknameP.textContent !== streamPeerNickname) {
        peerElement.nicknameP.textContent = streamPeerNickname;
    }

    // Ensure to use the correct stream object associated with the peerElement
    // The stream passed to this function *is* the one we should be attaching listeners to.
    const currentStream = stream;

    currentStream.oninactive = cleanupVideoChatUI; // Primary handler for stream ending

    currentStream.getTracks().forEach(track => {
        track.onended = () => {
            // If the stream is no longer active after this track ended, trigger cleanup
            if (!currentStream.active) {
                cleanupVideoChatUI();
            }
        };
    });
    showNotificationDep('videoChatSection');
}

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
            if (!isPttKeyDown) {
                localAudioStream.getAudioTracks().forEach(track => track.enabled = false);
            }
        } else {
            localAudioStream.getAudioTracks().forEach(track => track.enabled = true);
            isPttKeyDown = false;
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
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;
    const settingsSection = document.getElementById('settingsSection'); // Changed from settingsModal
    if (settingsSection && !settingsSection.classList.contains('hidden')) {
        const pttKeyInstructions = document.getElementById('pttKeyInstructions');
        if (pttKeyInstructions && !pttKeyInstructions.classList.contains('hidden')) {
             return;
        }
    }


    if (!pttEnabled || event.code !== pttKey || isPttKeyDown || !localAudioStream) return;
    isPttKeyDown = true;
    localAudioStream.getAudioTracks().forEach(track => track.enabled = true);
    updateAudioChatStatusUI();
}

function handlePttKeyUp(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;
    const settingsSection = document.getElementById('settingsSection'); // Changed from settingsModal
     if (settingsSection && !settingsSection.classList.contains('hidden')) {
        const pttKeyInstructions = document.getElementById('pttKeyInstructions');
        if (pttKeyInstructions && !pttKeyInstructions.classList.contains('hidden')) {
             return;
        }
    }

    if (!pttEnabled || event.code !== pttKey || !localAudioStream || !isPttKeyDown) return;
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

        if (pttEnabled && !isPttKeyDown) {
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
        localAudioStream.getAudioTracks().forEach(track => track.enabled = true); // Ensure re-enabled if PTT was on
        localAudioStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localAudioStream = null;
    }
    isPttKeyDown = false;

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

    const cleanupAudioUI = () => {
        const audioElToClean = peerAudios[peerId];
        if (audioElToClean) {
            audioElToClean.pause();
            audioElToClean.srcObject = null;
            if (audioElToClean.parentNode) {
                audioElToClean.remove();
            }
            delete peerAudios[peerId];
        }
        if (!peerAudios[peerId]) { // Check if already deleted
             logStatusDep(`Audio chat from ${streamPeerNickname} has ended.`);
        }
    };

    if (peerAudios[peerId]) { // If an old audio element exists, clean it up first
        cleanupAudioUI();
    }

    let audioEl = document.createElement('audio');
    document.body.appendChild(audioEl);
    peerAudios[peerId] = audioEl;


    audioEl.srcObject = stream;
    audioEl.autoplay = true;
    audioEl.play().catch(e => console.warn(`Audio play failed for ${streamPeerNickname}:`, e));

    audioEl.addEventListener('error', (e) => {
        console.error(`Error with audio element for ${streamPeerNickname}:`, e);
    });

    stream.oninactive = cleanupAudioUI;

    stream.getTracks().forEach(track => {
        track.onended = () => {
             if (!stream.active) {
                cleanupAudioUI();
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
    // Screen share elements are directly identified by ID and removed
    const screenShareVideoContainer = document.getElementById(`container-screenshare-${leftPeerId}`);
    if (screenShareVideoContainer) {
        const videoEl = screenShareVideoContainer.querySelector('video');
        if (videoEl) videoEl.srcObject = null;
        screenShareVideoContainer.remove();
    }

    // Video chat elements
    if (peerVideoElements[leftPeerId]) {
        if (peerVideoElements[leftPeerId].video) peerVideoElements[leftPeerId].video.srcObject = null;
        if (peerVideoElements[leftPeerId].wrapper) peerVideoElements[leftPeerId].wrapper.remove();
        delete peerVideoElements[leftPeerId];
    }

    // Audio chat elements
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
    isPttKeyDown = false;

    if(startShareBtn) { startShareBtn.title = ""; } // Reset title in case it was 'not supported'
    if(remoteVideosContainer) remoteVideosContainer.innerHTML = '';
    if(localScreenSharePreviewVideo) localScreenSharePreviewVideo.srcObject = null;
    if(localScreenSharePreviewContainer) localScreenSharePreviewContainer.classList.add('hidden');

    removeLocalVideoFromGrid();
    if(remoteVideoChatContainer) remoteVideoChatContainer.innerHTML = '';
    peerVideoElements = {};
    if (toggleLocalVideoPreviewCheckbox) toggleLocalVideoPreviewCheckbox.checked = true;


    updateAudioChatStatusUI();
    Object.values(peerAudios).forEach(audioEl => {
        if (audioEl) { audioEl.pause(); audioEl.srcObject = null; if(audioEl.parentNode) audioEl.remove(); }
    });
    peerAudios = {};

    enableMediaButtons(); // Re-checks capabilities and sets button states
}

export function updatePeerNicknameInUI(peerId, newNickname) {
    // Update video chat nickname
    if (peerVideoElements[peerId] && peerVideoElements[peerId].nicknameP) {
        peerVideoElements[peerId].nicknameP.textContent = newNickname;
    }

    // Update local video preview nickname (if it's this peer)
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

    // Update screen share nickname
    const screenShareContainer = document.getElementById(`container-screenshare-${peerId}`);
    if (screenShareContainer) {
        const pElement = screenShareContainer.querySelector('p');
        if (pElement) {
            pElement.textContent = `Screen from: ${newNickname}`;
        }
    }
}