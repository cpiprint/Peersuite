// media.js

let localScreenShareStream;
let localVideoCallStream;
let localAudioStream;

let peerVideoElements = {}; // { peerId: { wrapper, video, stream, nicknameP } }
let peerAudios = {}; // { peerId: { audio_element: HTMLAudioElement, stream: MediaStream } }


let localVideoPreviewElement = null;
let localVideoFlipped = false;


let pttEnabled = false;
let pttKey = 'Space';
let pttKeyDisplay = 'Space';
let isPttKeyDown = false;


let roomApiDep, logStatusDep, showNotificationDep;
let localGeneratedPeerIdDep;
let getPeerNicknamesDep, getLocalNicknameDep, updateUserListDep;

let startShareBtn, stopShareBtn, remoteVideosContainer;
let localScreenSharePreviewContainer, localScreenSharePreviewVideo;

let startVideoCallBtn, stopVideoCallBtn, remoteVideoChatContainer;
let toggleLocalVideoPreviewCheckbox;

let startAudioCallBtn, stopAudioCallBtn, audioChatStatus;

let localGlobalVolume = 1;
let individualVolumes = {}; // { peerId: volumeValue (0-1) }

// To keep track of screen share streams for volume control
let peerScreenShareStreams = {}; // { peerId: MediaStream }

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
    updateUserListDep = dependencies.updateUserList;

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
    if (typeof dependencies.initialGlobalVolume === 'number') {
        localGlobalVolume = dependencies.initialGlobalVolume;
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
        setGlobalVolume,
        setIndividualVolume,
        getIndividualVolume,
        // isAudioActiveForPeer, // No longer strictly needed for slider visibility by main.js
        // isAnyAudioActiveForPeer, // Keep if useful for other UI down the line
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
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } // Request audio with screen share
        });

        if (localScreenSharePreviewVideo && localScreenSharePreviewContainer) {
            localScreenSharePreviewVideo.srcObject = localScreenShareStream;
            // Mute local preview of screen share audio to prevent echo
            localScreenSharePreviewVideo.muted = true;
            localScreenSharePreviewContainer.classList.remove('hidden');
        }

        await roomApiDep.addStream(localScreenShareStream, null, { streamType: 'screenshare' });
        if(startShareBtn) startShareBtn.disabled = true;
        if(stopShareBtn) stopShareBtn.disabled = false;
        showNotificationDep('screenShareSection');

        localScreenShareStream.getVideoTracks().forEach(track => {
            track.onended = () => stopLocalScreenShare(true);
        });
        // If audio track exists, handle its end too (though video track end usually signals stream end)
        localScreenShareStream.getAudioTracks().forEach(track => {
            track.onended = () => {
                if (!localScreenShareStream || !localScreenShareStream.active) {
                    stopLocalScreenShare(true);
                }
            };
        });


    } catch (err) {
        console.error("Error starting screen share:", err);
        logStatusDep(`Error starting share: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}`, true);
        if (localScreenShareStream) {
            localScreenShareStream.getTracks().forEach(track => track.stop());
            localScreenShareStream = null;
        }
        if (localScreenSharePreviewVideo && localScreenSharePreviewContainer) {
            localScreenSharePreviewVideo.srcObject = null;
            localScreenSharePreviewContainer.classList.add('hidden');
        }
        if (roomApiDep && startShareBtn && stopShareBtn) { startShareBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) ? false : true; stopShareBtn.disabled = true; }
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
    peerScreenShareStreams[peerId] = stream; // Track the stream

    let videoContainer = document.getElementById(`container-screenshare-${peerId}`);
    let remoteVideo = document.getElementById(`video-screenshare-${peerId}`);

    const cleanupScreenShareUI = () => {
        const currentVideoContainer = document.getElementById(`container-screenshare-${peerId}`);
        const currentRemoteVideo = document.getElementById(`video-screenshare-${peerId}`);

        if (currentRemoteVideo) {
            currentRemoteVideo.srcObject = null;
        }
        if (currentVideoContainer && currentVideoContainer.parentNode) {
            currentVideoContainer.remove();
        }
        delete peerScreenShareStreams[peerId]; // Untrack stream
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
        // remoteVideo.muted = false; // Handled by applyVolumeToPeer
        videoContainer.appendChild(remoteVideo);

        const maximizeBtn = document.createElement('button');
        maximizeBtn.textContent = 'Maximize';
        // ... (maximizeBtn setup)
        videoContainer.appendChild(maximizeBtn);
        if(remoteVideosContainer) remoteVideosContainer.appendChild(videoContainer);
        else console.error("remoteVideosContainer not found for screen share.")
    }

    if (remoteVideo && remoteVideo.srcObject !== stream) {
        remoteVideo.srcObject = stream;
    }
    applyVolumeToPeer(peerId); // Apply volume when stream is displayed/updated

    stream.oninactive = cleanupScreenShareUI;
    stream.getTracks().forEach(track => {
        track.onended = () => { if (!stream.active) { cleanupScreenShareUI(); }};
    });
    showNotificationDep('screenShareSection');
}

export function setLocalVideoFlip(shouldFlip, forceApply = false) {
    if (localVideoFlipped === shouldFlip && !forceApply) return;
    localVideoFlipped = shouldFlip;
    if (localVideoPreviewElement && localVideoPreviewElement.parentNode) {
        const videoEl = localVideoPreviewElement.querySelector('video');
        if (videoEl) { videoEl.style.transform = localVideoFlipped ? 'scaleX(-1)' : 'none'; }
    }
}

function addLocalVideoToGrid() {
    // ... (no changes needed here regarding volume)
    if (!localVideoCallStream || !remoteVideoChatContainer || localVideoPreviewElement) return;
    const wrapper = document.createElement('div');
    wrapper.classList.add('remote-video-wrapper', 'local-preview-in-grid');
    wrapper.id = `vc-wrapper-${localGeneratedPeerIdDep}`;
    const nicknameP = document.createElement('p');
    let localUserNickname = "You";
    try { if (typeof getLocalNicknameDep === 'function' && getLocalNicknameDep()) { localUserNickname = getLocalNicknameDep(); }} catch(e) { console.warn("Could not get local nickname for preview:", e)}
    nicknameP.textContent = localUserNickname + " (Preview)";
    const videoEl = document.createElement('video');
    videoEl.autoplay = true; videoEl.playsinline = true; videoEl.muted = true;
    videoEl.srcObject = localVideoCallStream;
    videoEl.style.transform = localVideoFlipped ? 'scaleX(-1)' : 'none';
    wrapper.appendChild(nicknameP); wrapper.appendChild(videoEl);
    if (remoteVideoChatContainer.firstChild) { remoteVideoChatContainer.insertBefore(wrapper, remoteVideoChatContainer.firstChild);
    } else { remoteVideoChatContainer.appendChild(wrapper); }
    localVideoPreviewElement = wrapper;
}

function removeLocalVideoFromGrid() {
    // ... (no changes needed here)
    if (localVideoPreviewElement && localVideoPreviewElement.parentNode) { localVideoPreviewElement.remove(); }
    localVideoPreviewElement = null;
}

async function startLocalVideoCall() {
    // ... (no changes needed here regarding volume)
    if (!roomApiDep) { logStatusDep("Not in a room to start video call.", true); return; }
    try {
        if (!navigator.mediaDevices?.getUserMedia) { logStatusDep("Video call not supported by your browser.", true); return; }
        if (localVideoCallStream) await stopLocalVideoCall(true);
        localVideoCallStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (toggleLocalVideoPreviewCheckbox && toggleLocalVideoPreviewCheckbox.checked) { addLocalVideoToGrid(); }
        await roomApiDep.addStream(localVideoCallStream, null, { streamType: 'videochat' });
        if(startVideoCallBtn) startVideoCallBtn.disabled = true;
        if(stopVideoCallBtn) stopVideoCallBtn.disabled = false;
        logStatusDep("Video call started.");
        showNotificationDep('videoChatSection');
        localVideoCallStream.getTracks().forEach(track => { track.onended = () => { stopLocalVideoCall(true); }; });
    } catch (err) {
        console.error("Error starting video call:", err);
        logStatusDep(`Error starting video call: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}`, true);
        if (localVideoCallStream) { localVideoCallStream.getTracks().forEach(track => track.stop()); localVideoCallStream = null; }
        removeLocalVideoFromGrid();
        if (roomApiDep && startVideoCallBtn && stopVideoCallBtn) { startVideoCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true; stopVideoCallBtn.disabled = true; }
    }
}

async function stopLocalVideoCall(updateButtons = true) {
    // ... (no changes needed here)
    logStatusDep("Stopping video call...");
    removeLocalVideoFromGrid();
    if (localVideoCallStream) {
        if (roomApiDep?.removeStream) { try { await roomApiDep.removeStream(localVideoCallStream, null, { streamType: 'videochat' }); } catch (e) { console.error("Exception calling roomApi.removeStream for video call:", e); } }
        localVideoCallStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localVideoCallStream = null;
    }
    if (updateButtons && roomApiDep && startVideoCallBtn && stopVideoCallBtn) { startVideoCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true; stopVideoCallBtn.disabled = true; }
}

function handleIncomingVideoChatStream(stream, peerId) {
    if (peerId === localGeneratedPeerIdDep) return;
    const streamPeerNickname = getPeerNicknamesDep()[peerId] || `User ${peerId.substring(0, 6)}`;
    logStatusDep(`Receiving Video Chat stream from ${streamPeerNickname}.`);

    let peerElement = peerVideoElements[peerId];

    const cleanupVideoChatUI = () => {
        const currentPeerElement = peerVideoElements[peerId];
        if (currentPeerElement) {
            if (currentPeerElement.video) { currentPeerElement.video.srcObject = null; }
            if (currentPeerElement.wrapper && currentPeerElement.wrapper.parentNode) { currentPeerElement.wrapper.remove(); }
            delete peerVideoElements[peerId];
        }
        if (!peerVideoElements[peerId]) { logStatusDep(`Video chat from ${streamPeerNickname} has ended.`); }
    };

    if (!peerElement) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('remote-video-wrapper');
        wrapper.id = `vc-wrapper-${peerId}`;
        const nicknameP = document.createElement('p');
        nicknameP.textContent = streamPeerNickname;
        const videoEl = document.createElement('video');
        videoEl.autoplay = true; videoEl.playsinline = true;
        // videoEl.muted = false; // Handled by applyVolumeToPeer
        wrapper.appendChild(nicknameP); wrapper.appendChild(videoEl);
        if(remoteVideoChatContainer) remoteVideoChatContainer.appendChild(wrapper);
        else console.error("remoteVideoChatContainer not found for video chat.")
        peerElement = { wrapper, video: videoEl, stream, nicknameP };
        peerVideoElements[peerId] = peerElement;
    }

    if (peerElement.video.srcObject !== stream) {
        peerElement.video.srcObject = stream;
        peerElement.stream = stream; // Update stream reference
    }
    if (peerElement.nicknameP.textContent !== streamPeerNickname) {
        peerElement.nicknameP.textContent = streamPeerNickname;
    }
    applyVolumeToPeer(peerId); // Apply volume when stream is displayed/updated

    stream.oninactive = cleanupVideoChatUI;
    stream.getTracks().forEach(track => {
        track.onended = () => { if (!stream.active) { cleanupVideoChatUI(); }};
    });
    showNotificationDep('videoChatSection');
}


function updateAudioChatStatusUI() { /* ... (no changes) ... */ }
export function updatePttSettings(enabled, key, display) { /* ... (no changes) ... */ }
function handlePttKeyDown(event) { /* ... (no changes) ... */ }
function handlePttKeyUp(event) { /* ... (no changes) ... */ }
async function startLocalAudioCall() { /* ... (no changes needed for volume logic here) ... */ }
async function stopLocalAudioCall(updateButtons = true) { /* ... (no changes) ... */ }

function handleIncomingAudioChatStream(stream, peerId) {
    if (peerId === localGeneratedPeerIdDep) return;
    const streamPeerNickname = getPeerNicknamesDep()[peerId] || `User ${peerId.substring(0, 6)}`;
    logStatusDep(`Receiving Audio Chat stream from ${streamPeerNickname}.`);

    const cleanupAudioUI = () => {
        const audioData = peerAudios[peerId];
        if (audioData && audioData.audio_element) {
            audioData.audio_element.pause();
            audioData.audio_element.srcObject = null;
            if (audioData.audio_element.parentNode) { audioData.audio_element.remove(); }
        }
        delete peerAudios[peerId];
        // Individual volume persists until peer leaves, so not deleted here.
        if (!peerAudios[peerId]) { logStatusDep(`Audio chat from ${streamPeerNickname} has ended.`); }
    };

    if (peerAudios[peerId]) { cleanupAudioUI(); }

    let audioEl = document.createElement('audio');
    document.body.appendChild(audioEl);
    peerAudios[peerId] = { audio_element: audioEl, stream: stream };

    audioEl.srcObject = stream;
    audioEl.autoplay = true;
    // audioEl.muted = false; // Handled by applyVolumeToPeer
    applyVolumeToPeer(peerId); // Apply volume when stream is displayed/updated
    audioEl.play().catch(e => console.warn(`Audio play failed for ${streamPeerNickname}:`, e));
    audioEl.addEventListener('error', (e) => { console.error(`Error with audio element for ${streamPeerNickname}:`, e); });

    stream.oninactive = cleanupAudioUI;
    stream.getTracks().forEach(track => {
        track.onended = () => { if (!stream.active) { cleanupAudioUI(); }};
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
        console.warn(`Received stream from ${peerId} with missing 'streamType' metadata. Metadata:`, metadata);
    }
}

export async function stopAllLocalMedia(updateButtons = true) { /* ... (no changes) ... */ }
export function setupMediaForNewPeer(joinedPeerId) { /* ... (no changes) ... */ }

export function cleanupMediaForPeer(leftPeerId) {
    const screenShareVideoContainer = document.getElementById(`container-screenshare-${leftPeerId}`);
    if (screenShareVideoContainer) {
        const videoEl = screenShareVideoContainer.querySelector('video');
        if (videoEl) videoEl.srcObject = null;
        screenShareVideoContainer.remove();
    }
    delete peerScreenShareStreams[leftPeerId];

    if (peerVideoElements[leftPeerId]) {
        if (peerVideoElements[leftPeerId].video) peerVideoElements[leftPeerId].video.srcObject = null;
        if (peerVideoElements[leftPeerId].wrapper) peerVideoElements[leftPeerId].wrapper.remove();
        delete peerVideoElements[leftPeerId];
    }

    if (peerAudios[leftPeerId] && peerAudios[leftPeerId].audio_element) {
        peerAudios[leftPeerId].audio_element.pause();
        peerAudios[leftPeerId].audio_element.srcObject = null;
        if (peerAudios[leftPeerId].audio_element.parentNode) { peerAudios[leftPeerId].audio_element.remove(); }
    }
    delete peerAudios[leftPeerId];
    delete individualVolumes[leftPeerId]; // This is the correct place to clear individual volume

    if (updateUserListDep) { updateUserListDep(); }
}

export function resetMediaUIAndState() {
    // ... (Stop local streams) ...
    if (localScreenShareStream) { localScreenShareStream.getTracks().forEach(t => t.stop()); localScreenShareStream = null; }
    if (localVideoCallStream) { localVideoCallStream.getTracks().forEach(t => t.stop()); localVideoCallStream = null; }
    if (localAudioStream) { localAudioStream.getTracks().forEach(t => t.stop()); localAudioStream = null; }
    isPttKeyDown = false;


    // ... (Reset UI elements) ...
    if(remoteVideosContainer) remoteVideosContainer.innerHTML = '';
    if(localScreenSharePreviewVideo) localScreenSharePreviewVideo.srcObject = null;
    if(localScreenSharePreviewContainer) localScreenSharePreviewContainer.classList.add('hidden');
    removeLocalVideoFromGrid();
    if(remoteVideoChatContainer) remoteVideoChatContainer.innerHTML = '';


    // Reset collections
    peerVideoElements = {};
    Object.values(peerAudios).forEach(audioData => {
        if (audioData && audioData.audio_element) {
            audioData.audio_element.pause(); audioData.audio_element.srcObject = null; if(audioData.audio_element.parentNode) audioData.audio_element.remove();
        }
    });
    peerAudios = {};
    peerScreenShareStreams = {};
    individualVolumes = {}; // Reset all individual volumes

    updateAudioChatStatusUI();
    enableMediaButtons();
}

export function updatePeerNicknameInUI(peerId, newNickname) { /* ... (no changes) ... */ }

// --- Volume Control Functions ---
function applyVolumeToPeer(peerId) {
    const individualVol = getIndividualVolume(peerId); // Use getter to ensure default
    const targetVolume = localGlobalVolume * individualVol;

    if (peerAudios[peerId] && peerAudios[peerId].audio_element) {
        peerAudios[peerId].audio_element.volume = targetVolume;
    }
    if (peerVideoElements[peerId] && peerVideoElements[peerId].video) {
        peerVideoElements[peerId].video.volume = targetVolume;
         // It's generally good to ensure video is not muted if we are controlling volume,
        // but be mindful if users can mute videos directly via browser controls.
        // peerVideoElements[peerId].video.muted = targetVolume === 0; // Or just false
    }
    const screenShareVideo = document.getElementById(`video-screenshare-${peerId}`);
    if (screenShareVideo && peerScreenShareStreams[peerId] && peerScreenShareStreams[peerId].getAudioTracks().length > 0) {
        screenShareVideo.volume = targetVolume;
        // screenShareVideo.muted = targetVolume === 0; // Or just false
    }
}

export function setGlobalVolume(volume, applyToElements = true) {
    localGlobalVolume = Math.max(0, Math.min(1, volume)); // Clamp volume
    if (applyToElements) {
        const connectedPeers = getPeerNicknamesDep ? Object.keys(getPeerNicknamesDep()) : [];
        // Also include localGeneratedPeerIdDep if you might have local previews with controllable audio that aren't self-muted
        const allRelevantPeerIds = new Set([...connectedPeers, localGeneratedPeerIdDep]);

        allRelevantPeerIds.forEach(peerId => {
             // Check if peerId exists in our tracking; getPeerNicknames might include peers not yet fully processed by media
            if (peerAudios[peerId] || peerVideoElements[peerId] || peerScreenShareStreams[peerId]) {
                applyVolumeToPeer(peerId);
            }
        });
    }
}

export function setIndividualVolume(peerId, volume) {
    individualVolumes[peerId] = Math.max(0, Math.min(1, volume)); // Clamp volume
    applyVolumeToPeer(peerId);
}

export function getIndividualVolume(peerId) {
    return individualVolumes[peerId] !== undefined ? individualVolumes[peerId] : 1;
}