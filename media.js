
let localScreenShareStream;
let localVideoCallStream;
let localAudioStream;

let peerVideoElements = {}; // { peerId: { wrapper, video, stream, nicknameP } }
let peerAudios = {}; // { peerId: audio_element }

let roomApiDep, logStatusDep, showNotificationDep;
let localGeneratedPeerIdDep;
let getPeerNicknamesDep;

let startShareBtn, stopShareBtn, remoteVideosContainer;
let startVideoCallBtn, stopVideoCallBtn, localVideoContainer, localVideo, remoteVideoChatContainer;
let startAudioCallBtn, stopAudioCallBtn, audioChatStatus;

function selectMediaDomElements() {
    startShareBtn = document.getElementById('startShareBtn');
    stopShareBtn = document.getElementById('stopShareBtn');
    remoteVideosContainer = document.getElementById('remoteVideosContainer');

    startVideoCallBtn = document.getElementById('startVideoCallBtn');
    stopVideoCallBtn = document.getElementById('stopVideoCallBtn');
    localVideoContainer = document.getElementById('localVideoContainer');
    localVideo = document.getElementById('localVideo');
    remoteVideoChatContainer = document.getElementById('remoteVideoChatContainer');

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

    if(startShareBtn) startShareBtn.addEventListener('click', startScreenSharing);
    if(stopShareBtn) stopShareBtn.addEventListener('click', () => stopLocalScreenShare(true));
    if(startVideoCallBtn) startVideoCallBtn.addEventListener('click', startLocalVideoCall);
    if(stopVideoCallBtn) stopVideoCallBtn.addEventListener('click', () => stopLocalVideoCall(true));
    if(startAudioCallBtn) startAudioCallBtn.addEventListener('click', startLocalAudioCall);
    if(stopAudioCallBtn) stopAudioCallBtn.addEventListener('click', () => stopLocalAudioCall(true));
    
    checkMediaCapabilities();

    return {
        enableMediaButtons,
        resetMediaUIAndState,
        updatePeerNicknameInUI,
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
    
    if (audioChatStatus) audioChatStatus.classList.add('hidden');
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
            audio: true
        });

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
        videoContainer.classList.add('remoteVideoContainer');

        const peerInfo = document.createElement('p');
        peerInfo.textContent = `Screen from: ${streamPeerNickname}`;
        videoContainer.appendChild(peerInfo);

        remoteVideo = document.createElement('video');
        remoteVideo.id = `video-screenshare-${peerId}`;
        remoteVideo.autoplay = true;
        remoteVideo.playsinline = true;
        remoteVideo.classList.add('remoteVideo');
        videoContainer.appendChild(remoteVideo);

        const maximizeBtn = document.createElement('button');
        maximizeBtn.textContent = 'Maximize';
        maximizeBtn.classList.add('maximize-btn');
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
        if(localVideo) localVideo.srcObject = localVideoCallStream;
        if(localVideoContainer) localVideoContainer.classList.remove('hidden');

        await roomApiDep.addStream(localVideoCallStream, null, { streamType: 'videochat' });

        if(startVideoCallBtn) startVideoCallBtn.disabled = true;
        if(stopVideoCallBtn) stopVideoCallBtn.disabled = false;
        logStatusDep("Video call started.");
        showNotificationDep('videoChatSection');

        localVideoCallStream.getTracks().forEach(track => {
            track.onended = () => stopLocalVideoCall(true);
        });

    } catch (err) {
        console.error("Error starting video call:", err);
        logStatusDep(`Error starting video call: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}`, true);
        if (localVideoCallStream) { localVideoCallStream.getTracks().forEach(track => track.stop()); localVideoCallStream = null; }
        if(localVideoContainer) localVideoContainer.classList.add('hidden');
        if(localVideo) localVideo.srcObject = null;
        if (roomApiDep && startVideoCallBtn && stopVideoCallBtn) {
             startVideoCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true;
             stopVideoCallBtn.disabled = true;
        }
    }
}

async function stopLocalVideoCall(updateButtons = true) {
    logStatusDep("Stopping video call...");
    if (localVideoCallStream) {
        if (roomApiDep?.removeStream) {
            try { await roomApiDep.removeStream(localVideoCallStream, null, { streamType: 'videochat' }); }
            catch (e) { console.error("Exception calling roomApi.removeStream for video call:", e); }
        }
        localVideoCallStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localVideoCallStream = null;
    }
    if(localVideo) localVideo.srcObject = null;
    if(localVideoContainer) localVideoContainer.classList.add('hidden');

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
            peerVideoElements[peerId].video.srcObject = null;
            logStatusDep(`Video chat stream ended from ${streamPeerNickname}`);
        }
    };
    stream.getTracks().forEach(track => {
        track.onended = () => {
            if ((!stream.active || stream.getTracks().every(t => t.readyState === 'ended')) && peerVideoElements[peerId]) {
                peerVideoElements[peerId].video.srcObject = null;
                logStatusDep(`Video chat track ended from ${streamPeerNickname}`);
            }
        };
    });
    showNotificationDep('videoChatSection');
}


// --- Audio Chat ---
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

        if(startAudioCallBtn) startAudioCallBtn.disabled = true;
        if(stopAudioCallBtn) stopAudioCallBtn.disabled = false;
        if(audioChatStatus) {
            audioChatStatus.textContent = "Audio call active. You are transmitting audio.";
            audioChatStatus.classList.remove('hidden');
        }
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
        if(audioChatStatus) audioChatStatus.classList.add('hidden');
    }
}

async function stopLocalAudioCall(updateButtons = true) {
    logStatusDep("Stopping audio call...");
    if (localAudioStream) {
        if (roomApiDep?.removeStream) {
            try { await roomApiDep.removeStream(localAudioStream, null, { streamType: 'audiochat' }); }
            catch (e) { console.error("Exception calling roomApi.removeStream for audio call:", e); }
        }
        localAudioStream.getTracks().forEach(track => { track.onended = null; track.stop(); });
        localAudioStream = null;
    }

    if (updateButtons && roomApiDep && startAudioCallBtn && stopAudioCallBtn) {
        startAudioCallBtn.disabled = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? false : true;
        stopAudioCallBtn.disabled = true;
    }
    if(audioChatStatus) audioChatStatus.classList.add('hidden');
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
        document.body.appendChild(audioEl);
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

    if(startShareBtn) { startShareBtn.title = ""; }
    if(remoteVideosContainer) remoteVideosContainer.innerHTML = '';

    if(localVideoContainer) localVideoContainer.classList.add('hidden');
    if(localVideo) localVideo.srcObject = null;
    if(remoteVideoChatContainer) remoteVideoChatContainer.innerHTML = '';
    peerVideoElements = {};

    if(audioChatStatus) audioChatStatus.classList.add('hidden');
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
    const screenShareContainer = document.getElementById(`container-screenshare-${peerId}`);
    if (screenShareContainer) {
        const pElement = screenShareContainer.querySelector('p');
        if (pElement) {
            pElement.textContent = `Screen from: ${newNickname}`;
        }
    }
}
