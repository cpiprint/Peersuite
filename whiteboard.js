// --- Global variables for whiteboard.js ---
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

// --- Dependencies (will be set in initWhiteboardFeatures) ---
let sendDrawCommandDep, sendInitialWhiteboardDep;
let logStatusDep, showNotificationDep;
let getPeerNicknamesDep, localGeneratedPeerIdDep; // For notifications

// --- DOM Elements (selected within this module) ---
let whiteboardCanvas, wbColorPicker, wbLineWidth, wbClearBtn, wbLineWidthValue, wbToolPalette, wbZoomOutBtn, wbZoomLevelDisplay, wbZoomInBtn;

function selectWhiteboardDomElements() {
    whiteboardCanvas = document.getElementById('whiteboardCanvas');
    wbColorPicker = document.getElementById('wbColorPicker');
    wbLineWidth = document.getElementById('wbLineWidth');
    wbClearBtn = document.getElementById('wbClearBtn');
    wbLineWidthValue = document.getElementById('wbLineWidthValue');
    wbToolPalette = document.querySelector('.wb-tool-palette');
    wbZoomOutBtn = document.getElementById('wbZoomOutBtn');
    wbZoomLevelDisplay = document.getElementById('wbZoomLevelDisplay');
    wbZoomInBtn = document.getElementById('wbZoomInBtn');
}

export function initWhiteboardFeatures(dependencies) {
    selectWhiteboardDomElements();

    sendDrawCommandDep = dependencies.sendDrawCommand;
    sendInitialWhiteboardDep = dependencies.sendInitialWhiteboard; 
    logStatusDep = dependencies.logStatus;
    showNotificationDep = dependencies.showNotification;
    getPeerNicknamesDep = dependencies.getPeerNicknames;
    localGeneratedPeerIdDep = dependencies.localGeneratedPeerId;


    if (!whiteboardCanvas || !wbColorPicker || !wbLineWidth || !wbClearBtn || !wbLineWidthValue || !wbToolPalette || !wbZoomOutBtn || !wbZoomLevelDisplay || !wbZoomInBtn) {
        console.warn("Whiteboard DOM elements not found, Whiteboard feature might be partially disabled.");
        
    } else {
        whiteboardCanvas.style.backgroundColor = '#FFFFFF'; 
        wbCtx = whiteboardCanvas.getContext('2d');
        resizeWhiteboardAndRedraw(); // Initial resize and draw

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

    return {
        handleDrawCommand,
        handleInitialWhiteboard,
        redrawWhiteboardFromHistoryIfVisible,
        resizeWhiteboardAndRedraw,
        getWhiteboardHistory,
        loadWhiteboardData,
        resetWhiteboardState,
        sendInitialWhiteboardStateToPeer 
    };
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
            wbPanX = 0; wbPanY = 0; wbZoomLevel = 1.0;
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
    if (wbCtx) { 
        wbCtx.fillStyle = '#FFFFFF';
        wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    }
    redrawWhiteboardFromHistory();
}

function clearWhiteboardAndBroadcast() {
    const clearCmd = { type: 'clear' };
    applyDrawCommand(clearCmd); 
    whiteboardHistory = [clearCmd]; 
    if (sendDrawCommandDep) sendDrawCommandDep(clearCmd);
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');
}

function redrawWhiteboardFromHistory() {
    if (!wbCtx || !whiteboardCanvas || whiteboardCanvas.width === 0 || whiteboardCanvas.height === 0) {
        return;
    }
    wbCtx.fillStyle = '#FFFFFF';
    wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    
    wbCtx.strokeStyle = wbColorPicker ? wbColorPicker.value : '#000000'; 
    wbCtx.lineWidth = wbLineWidth ? parseFloat(wbLineWidth.value) : 3;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    
    whiteboardHistory.forEach(cmd => {
        applyDrawCommand(cmd);
    });
}

export function redrawWhiteboardFromHistoryIfVisible(force = false) {
    if (whiteboardCanvas && (whiteboardCanvas.offsetParent || force)) {
        if (wbCtx) {
            wbCtx.fillStyle = '#FFFFFF';
            wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
        }
        redrawWhiteboardFromHistory();
    }
}

export function handleDrawCommand(cmd, peerId) {
    applyDrawCommand(cmd); 
    if (cmd.type === 'clear') {
        whiteboardHistory = [cmd]; 
    } else if (!whiteboardHistory.find(c => JSON.stringify(c) === JSON.stringify(cmd))) { 
        whiteboardHistory.push(cmd);
    }
    if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('whiteboardSection');
}

export function handleInitialWhiteboard(history, peerId, getIsHost) {
    if (getIsHost && !getIsHost()) {
        const nickname = (getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'host';
        if(logStatusDep) logStatusDep(`Client: Received initial whiteboard history from ${nickname}, length: ${history.length}.`);

        whiteboardHistory = history; 
        wbZoomLevel = 1.0; wbPanX = 0; wbPanY = 0; 
        updateZoomDisplay();
        redrawWhiteboardFromHistoryIfVisible(true); 
        if(logStatusDep) logStatusDep(`Client: Whiteboard state applied from ${nickname}.`);
    }
}

export function getWhiteboardHistory() {
    return whiteboardHistory;
}

export function loadWhiteboardData(importedHistory) {
    whiteboardHistory = importedHistory || [];
    wbZoomLevel = 1.0; wbPanX = 0; wbPanY = 0; 
    if (wbZoomLevelDisplay) updateZoomDisplay();
}

export function resetWhiteboardState() {
    whiteboardHistory = []; wbZoomLevel = 1.0; wbPanX = 0; wbPanY = 0;
    if(wbZoomLevelDisplay) updateZoomDisplay();
    if (wbCtx && whiteboardCanvas ) { 
         wbCtx.fillStyle = '#FFFFFF';
         wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    }
}

export function sendInitialWhiteboardStateToPeer(peerId, getIsHost) {
    if (getIsHost && getIsHost() && sendInitialWhiteboardDep) {
        if (whiteboardHistory.length > 0) {
            if(logStatusDep) logStatusDep(`Host: Sending whiteboard history to peer ${peerId.substring(0,6)}, length: ${whiteboardHistory.length}`);
            sendInitialWhiteboardDep(whiteboardHistory, peerId);
        } else {
            if(logStatusDep) logStatusDep(`Host: Sending EMPTY whiteboard history to peer ${peerId.substring(0,6)}`);
            sendInitialWhiteboardDep([], peerId);
        }
    }
}
