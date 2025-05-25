// whiteboard.js

// --- Global variables for whiteboard.js ---
let wbCtx, wbIsDrawing = false, wbLastX, wbLastY;
let currentWbTool = 'pen';
let wbShapeStartX, wbShapeStartY;
let whiteboardHistory = [];
let wbTextInsertionPoint = null; // To store {x, y} for text insertion

// --- Dependencies (will be set in initWhiteboardFeatures) ---
let sendDrawCommandDep, sendInitialWhiteboardDep;
let logStatusDep, showNotificationDep;
let getPeerNicknamesDep, localGeneratedPeerIdDep;

// --- DOM Elements ---
let whiteboardCanvas, wbColorPicker, wbLineWidth, wbClearBtn, wbLineWidthValue, wbToolPalette;
let wbExportPngBtn;
let wbTextInputArea, wbActualTextInput, wbSubmitTextBtn;

function selectWhiteboardDomElements() {
    whiteboardCanvas = document.getElementById('whiteboardCanvas');
    wbColorPicker = document.getElementById('wbColorPicker');
    wbLineWidth = document.getElementById('wbLineWidth');
    wbClearBtn = document.getElementById('wbClearBtn');
    wbLineWidthValue = document.getElementById('wbLineWidthValue');
    wbToolPalette = document.querySelector('.wb-tool-palette');
    wbExportPngBtn = document.getElementById('wbExportPngBtn');
    wbTextInputArea = document.getElementById('wbTextInputArea');
    wbActualTextInput = document.getElementById('wbActualTextInput');
    wbSubmitTextBtn = document.getElementById('wbSubmitTextBtn');
}

export function initWhiteboardFeatures(dependencies) {
    selectWhiteboardDomElements();

    sendDrawCommandDep = dependencies.sendDrawCommand;
    sendInitialWhiteboardDep = dependencies.sendInitialWhiteboard;
    logStatusDep = dependencies.logStatus;
    showNotificationDep = dependencies.showNotification;
    getPeerNicknamesDep = dependencies.getPeerNicknames;
    localGeneratedPeerIdDep = dependencies.localGeneratedPeerId;

    if (!whiteboardCanvas || !wbToolPalette) {
        console.error("CRITICAL Whiteboard DOM elements (canvas or tool palette) not found. Whiteboard disabled.");
        return {
            handleDrawCommand: () => { if(logStatusDep) logStatusDep("WB Error: Attempted to use disabled whiteboard.", true); },
            handleInitialWhiteboard: () => { if(logStatusDep) logStatusDep("WB Error: Attempted to use disabled whiteboard.", true); },
            redrawWhiteboardFromHistoryIfVisible: () => { if(logStatusDep) logStatusDep("WB Error: Attempted to use disabled whiteboard.", true); },
            resizeWhiteboardAndRedraw: () => { if(logStatusDep) logStatusDep("WB Error: Attempted to use disabled whiteboard.", true); },
            getWhiteboardHistory: () => [], // Provide an empty array
            loadWhiteboardData: () => { if(logStatusDep) logStatusDep("WB Error: Attempted to use disabled whiteboard.", true); },
            resetWhiteboardState: () => { if(logStatusDep) logStatusDep("WB Error: Attempted to use disabled whiteboard.", true); },
            sendInitialWhiteboardStateToPeer: () => { if(logStatusDep) logStatusDep("WB Error: Attempted to use disabled whiteboard.", true); }
        };
    }

    whiteboardCanvas.style.backgroundColor = '#FFFFFF';
    wbCtx = whiteboardCanvas.getContext('2d');
    resizeWhiteboardAndRedraw();

    if (wbColorPicker) {
        wbColorPicker.addEventListener('change', (e) => { if (wbCtx) wbCtx.strokeStyle = e.target.value; });
    } else { console.warn("WB: Color picker not found."); }

    if (wbLineWidth && wbLineWidthValue) {
        wbLineWidth.addEventListener('input', (e) => {
            if (wbCtx) wbCtx.lineWidth = parseFloat(e.target.value);
            if (wbLineWidthValue) wbLineWidthValue.textContent = `${e.target.value}px`;
        });
        if (wbLineWidthValue) wbLineWidthValue.textContent = `${wbLineWidth.value}px`;
    } else { console.warn("WB: Line width controls not found."); }

    if (wbClearBtn) {
        wbClearBtn.addEventListener('click', clearWhiteboardAndBroadcast);
    } else { console.warn("WB: Clear button not found."); }

    if (wbExportPngBtn) {
        wbExportPngBtn.addEventListener('click', exportWhiteboardToPNG);
    } else { console.warn("WB: Export button not found."); }
    if (wbTextInputArea && wbActualTextInput && wbSubmitTextBtn) {
        wbSubmitTextBtn.addEventListener('click', handleSubmitWbText);
        wbActualTextInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmitWbText();
            }
        });
    } else {
        console.warn("WB: Text input elements (Area, Input, or Button) not found. Text tool may not function correctly.");
    }

    const toolButtons = wbToolPalette.querySelectorAll('.wb-tool-btn');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Check if text tool can be activated
            if (button.dataset.tool === 'text' && (!wbTextInputArea || !wbActualTextInput || !wbSubmitTextBtn)) {
                console.warn("WB: Text tool selected, but required input DOM elements are missing.");
            }

            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const oldTool = currentWbTool;
            currentWbTool = button.dataset.tool;

    
            if (currentWbTool !== 'text') { 
                if(wbTextInputArea) wbTextInputArea.classList.add('hidden');
                wbTextInsertionPoint = null; // Clear insertion point
            } else {
                 if (oldTool !== 'text' && wbTextInputArea && !wbTextInputArea.classList.contains('hidden')) {
                    wbTextInputArea.classList.add('hidden');
                }
            }

            switch (currentWbTool) {
                case 'pen': case 'rectangle': case 'circle': case 'line':
                    whiteboardCanvas.style.cursor = 'crosshair'; break;
                case 'eraser':
                    whiteboardCanvas.style.cursor = 'grab'; break; // Consider a custom eraser cursor image
                case 'text':
                    whiteboardCanvas.style.cursor = 'text'; break;
                default: whiteboardCanvas.style.cursor = 'default';
            }
        });
    });

    const initialToolButton = wbToolPalette.querySelector(`.wb-tool-btn[data-tool="${currentWbTool}"]`);
    if (initialToolButton) {
        initialToolButton.classList.add('active');
        switch (currentWbTool) {
            case 'pen': case 'rectangle': case 'circle': case 'line': whiteboardCanvas.style.cursor = 'crosshair'; break;
            case 'eraser': whiteboardCanvas.style.cursor = 'grab'; break;
            case 'text': whiteboardCanvas.style.cursor = 'text'; break;
            default: whiteboardCanvas.style.cursor = 'default';
        }
    } else {
         if(whiteboardCanvas) whiteboardCanvas.style.cursor = 'crosshair'; // Fallback
    }

    ['mousedown', 'touchstart'].forEach(evt => whiteboardCanvas.addEventListener(evt, handleWbMouseDown, { passive: false }));
    ['mousemove', 'touchmove'].forEach(evt => whiteboardCanvas.addEventListener(evt, handleWbMouseMove, { passive: false }));
    ['mouseup', 'touchend', 'mouseout', 'touchcancel'].forEach(evt => whiteboardCanvas.addEventListener(evt, handleWbMouseUp));

    window.addEventListener('resize', resizeWhiteboardAndRedraw);

    if (wbCtx) {
        wbCtx.strokeStyle = (wbColorPicker && wbColorPicker.value) ? wbColorPicker.value : '#000000';
        wbCtx.lineWidth = (wbLineWidth && wbLineWidth.value) ? parseFloat(wbLineWidth.value) : 3;
        wbCtx.lineCap = 'round';
        wbCtx.lineJoin = 'round';
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

function getWbEventPosition(event) {
    if (!whiteboardCanvas) return { x: 0, y: 0 };
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

function handleWbMouseDown(e) {
    if (!wbCtx) return;
    e.preventDefault();
    const pos = getWbEventPosition(e);

    if (currentWbTool === 'text') {
        if (!wbTextInputArea || !wbActualTextInput) {
            console.error("WB: Text input elements not found in mousedown, cannot activate text tool.");
            return;
        }
        wbIsDrawing = false;
        wbTextInsertionPoint = { x: pos.x, y: pos.y }; 
        
        wbTextInputArea.classList.remove('hidden'); 
        wbActualTextInput.value = '';
        wbActualTextInput.focus();  
        return; 
    }

    if(wbTextInputArea && !wbTextInputArea.classList.contains('hidden')) {
        wbTextInputArea.classList.add('hidden');
    }
    wbTextInsertionPoint = null;

    wbIsDrawing = true;
    wbLastX = pos.x;
    wbLastY = pos.y;

    if (currentWbTool === 'rectangle' || currentWbTool === 'circle' || currentWbTool === 'line') {
        wbShapeStartX = pos.x;
        wbShapeStartY = pos.y;
    }
}

function handleSubmitWbText() {
    if (!wbTextInsertionPoint || !wbActualTextInput || !wbTextInputArea) {
        if(wbTextInputArea) wbTextInputArea.classList.add('hidden');
        wbTextInsertionPoint = null;
        return;
    }
    const textToDraw = wbActualTextInput.value;
    if (textToDraw.trim() === "") {
        wbActualTextInput.value = '';
        wbActualTextInput.focus();
        return;
    }

    const fontSize = 16;
    const textCmd = {
        type: 'text',
        text: textToDraw,
        x: wbTextInsertionPoint.x,
        y: wbTextInsertionPoint.y,
        color: (wbColorPicker && wbColorPicker.value) ? wbColorPicker.value : '#000000',
        font: `${fontSize}px sans-serif`
    };

    redrawWhiteboardFromHistory(); 
    applyDrawCommand(textCmd);
    whiteboardHistory.push(textCmd);

    if (sendDrawCommandDep) sendDrawCommandDep(textCmd);
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');

    wbActualTextInput.value = '';
    wbActualTextInput.focus();  
}

function handleWbMouseMove(e) {
    if (!wbIsDrawing || !wbCtx || currentWbTool === 'text') return;
    e.preventDefault();
    const pos = getWbEventPosition(e);
    const currentX = pos.x;
    const currentY = pos.y;
    const currentToolColor = (wbColorPicker && wbColorPicker.value) ? wbColorPicker.value : '#000000';
    const currentToolLineWidth = (wbLineWidth && wbLineWidth.value) ? parseFloat(wbLineWidth.value) : 3;

    if (currentWbTool === 'pen' || currentWbTool === 'eraser') {
        const drawCmdData = {
            type: currentWbTool,
            x0: wbLastX, y0: wbLastY,
            x1: currentX, y1: currentY,
            color: (currentWbTool === 'pen') ? currentToolColor : '#FFFFFF',
            lineWidth: (currentWbTool === 'pen') ? currentToolLineWidth : Math.max(10, currentToolLineWidth * 1.5)
        };
        applyDrawCommand(drawCmdData);
        whiteboardHistory.push(drawCmdData);
        if (sendDrawCommandDep) sendDrawCommandDep(drawCmdData);
    } else if (currentWbTool === 'rectangle' || currentWbTool === 'circle' || currentWbTool === 'line') {
        redrawWhiteboardFromHistory();
        let previewCmd = {};
        if (currentWbTool === 'rectangle') {
            previewCmd = { type: 'rectangle', x: wbShapeStartX, y: wbShapeStartY, width: currentX - wbShapeStartX, height: currentY - wbShapeStartY, color: currentToolColor, lineWidth: currentToolLineWidth };
        } else if (currentWbTool === 'circle') {
            const dX = currentX - wbShapeStartX; const dY = currentY - wbShapeStartY;
            previewCmd = { type: 'circle', cx: wbShapeStartX, cy: wbShapeStartY, radius: Math.sqrt(dX * dX + dY * dY), color: currentToolColor, lineWidth: currentToolLineWidth };
        } else if (currentWbTool === 'line') {
            previewCmd = { type: 'line', x0: wbShapeStartX, y0: wbShapeStartY, x1: currentX, y1: currentY, color: currentToolColor, lineWidth: currentToolLineWidth };
        }
        applyDrawCommand(previewCmd);
    }
    wbLastX = currentX; wbLastY = currentY;
}

function handleWbMouseUp() {
    if (!wbIsDrawing || !wbCtx || currentWbTool === 'text' || currentWbTool === 'pen' || currentWbTool === 'eraser') {
        if (currentWbTool !== 'text') wbIsDrawing = false; 
        return;
    }

    let finalShapeCmd = null;
    const currentX = wbLastX; const currentY = wbLastY;
    const currentToolColor = (wbColorPicker && wbColorPicker.value) ? wbColorPicker.value : '#000000';
    const currentToolLineWidth = (wbLineWidth && wbLineWidth.value) ? parseFloat(wbLineWidth.value) : 3;

    if (currentWbTool === 'rectangle') {
        finalShapeCmd = { type: 'rectangle', x: wbShapeStartX, y: wbShapeStartY, width: currentX - wbShapeStartX, height: currentY - wbShapeStartY, color: currentToolColor, lineWidth: currentToolLineWidth };
    } else if (currentWbTool === 'circle') {
        const dX = currentX - wbShapeStartX; const dY = currentY - wbShapeStartY;
        finalShapeCmd = { type: 'circle', cx: wbShapeStartX, cy: wbShapeStartY, radius: Math.sqrt(dX * dX + dY * dY), color: currentToolColor, lineWidth: currentToolLineWidth };
    } else if (currentWbTool === 'line') {
        finalShapeCmd = { type: 'line', x0: wbShapeStartX, y0: wbShapeStartY, x1: currentX, y1: currentY, color: currentToolColor, lineWidth: currentToolLineWidth };
    }
    if (finalShapeCmd) {
        redrawWhiteboardFromHistory();
        applyDrawCommand(finalShapeCmd); 
        whiteboardHistory.push(finalShapeCmd);
        if (sendDrawCommandDep) sendDrawCommandDep(finalShapeCmd);
        if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');
    }
    wbIsDrawing = false;
}

function applyDrawCommand(cmd) {
    if (!wbCtx || !whiteboardCanvas) return;
    // Save context state
    const originalStrokeStyle = wbCtx.strokeStyle, originalLineWidth = wbCtx.lineWidth, originalFillStyle = wbCtx.fillStyle,
          originalFont = wbCtx.font, originalTextAlign = wbCtx.textAlign, originalTextBaseline = wbCtx.textBaseline,
          originalLineCap = wbCtx.lineCap, originalLineJoin = wbCtx.lineJoin;
    wbCtx.strokeStyle = cmd.color;
    wbCtx.lineWidth = cmd.lineWidth; 
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';

    switch (cmd.type) {
        case 'pen': case 'draw':
            wbCtx.beginPath(); wbCtx.moveTo(cmd.x0, cmd.y0); wbCtx.lineTo(cmd.x1, cmd.y1); wbCtx.stroke(); break;
        case 'eraser':
            wbCtx.strokeStyle = '#FFFFFF'; // Eraser color
            wbCtx.beginPath(); wbCtx.moveTo(cmd.x0, cmd.y0); wbCtx.lineTo(cmd.x1, cmd.y1); wbCtx.stroke(); break;
        case 'rectangle':
            let rX = cmd.x, rY = cmd.y, rW = cmd.width, rH = cmd.height;
            if (rW < 0) { rX = cmd.x + rW; rW = -rW; } if (rH < 0) { rY = cmd.y + rH; rH = -rH; }
            wbCtx.beginPath(); wbCtx.rect(rX, rY, rW, rH); wbCtx.stroke(); break;
        case 'circle':
            wbCtx.beginPath(); wbCtx.arc(cmd.cx, cmd.cy, Math.abs(cmd.radius), 0, 2 * Math.PI); wbCtx.stroke(); break;
        case 'line':
            wbCtx.beginPath(); wbCtx.moveTo(cmd.x0, cmd.y0); wbCtx.lineTo(cmd.x1, cmd.y1); wbCtx.stroke(); break;
        case 'text':
            wbCtx.fillStyle = cmd.color; wbCtx.font = cmd.font;
            wbCtx.textAlign = 'left'; wbCtx.textBaseline = 'top';
            wbCtx.fillText(cmd.text, cmd.x, cmd.y); break;
        case 'clear':
            wbCtx.fillStyle = '#FFFFFF'; wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height); break;
        default: console.warn("WB: Unknown draw command type:", cmd.type);
    }
    // Restore context state
    wbCtx.strokeStyle = originalStrokeStyle; wbCtx.lineWidth = originalLineWidth; wbCtx.fillStyle = originalFillStyle;
    wbCtx.font = originalFont; wbCtx.textAlign = originalTextAlign; wbCtx.textBaseline = originalTextBaseline;
    wbCtx.lineCap = originalLineCap; wbCtx.lineJoin = originalLineJoin;
}

export function resizeWhiteboardAndRedraw() {
    if (!whiteboardCanvas || !whiteboardCanvas.offsetParent) return;
    const displayWidth = whiteboardCanvas.clientWidth, displayHeight = whiteboardCanvas.clientHeight;
    if (displayWidth <= 0 || displayHeight <= 0) return; 
    if (whiteboardCanvas.width !== displayWidth || whiteboardCanvas.height !== displayHeight) {
        whiteboardCanvas.width = displayWidth; whiteboardCanvas.height = displayHeight;
    }
    redrawWhiteboardFromHistory();
}

function clearWhiteboardAndBroadcast() {
    const clearCmd = { type: 'clear' };
    applyDrawCommand(clearCmd);
    whiteboardHistory = [clearCmd];
    if (sendDrawCommandDep) sendDrawCommandDep(clearCmd);
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('whiteboardSection');
    if(wbTextInputArea) wbTextInputArea.classList.add('hidden');
    wbTextInsertionPoint = null;
}

function redrawWhiteboardFromHistory() {
    if (!wbCtx || !whiteboardCanvas || whiteboardCanvas.width === 0 || whiteboardCanvas.height === 0) {
        return;
    }
    // Clear the canvas with white background
    const originalFill = wbCtx.fillStyle;
    wbCtx.fillStyle = '#FFFFFF';
    wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    wbCtx.fillStyle = originalFill;
    wbCtx.strokeStyle = (wbColorPicker && wbColorPicker.value) ? wbColorPicker.value : '#000000';
    wbCtx.lineWidth = (wbLineWidth && wbLineWidth.value) ? parseFloat(wbLineWidth.value) : 3;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';

    whiteboardHistory.forEach(cmd => {
        applyDrawCommand(cmd);
    });
}

export function redrawWhiteboardFromHistoryIfVisible(force = false) {
    if (whiteboardCanvas && (whiteboardCanvas.offsetParent || force)) {
        if (whiteboardCanvas.width > 0 && whiteboardCanvas.height > 0) {
            redrawWhiteboardFromHistory();
        } else {
            resizeWhiteboardAndRedraw();
        }
    }
}

function exportWhiteboardToPNG() {
    if (!whiteboardCanvas) { if (logStatusDep) logStatusDep("WB: Canvas not available for export.", true); return; }
    try {
        const dataURL = whiteboardCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL; link.download = `PeerSuite_Whiteboard_${new Date().toISOString().slice(0,10)}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        if (logStatusDep) logStatusDep("WB: Exported as PNG.");
    } catch (error) {
        console.error("WB: Error exporting to PNG:", error);
        if (logStatusDep) logStatusDep("WB: Error exporting: " + error.message, true);
    }
}

export function handleDrawCommand(cmd, peerId) {
    if (wbIsDrawing && (currentWbTool === 'rectangle' || currentWbTool === 'circle' || currentWbTool === 'line')) {
        redrawWhiteboardFromHistory();
    }
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
        if (logStatusDep) logStatusDep(`WB Client: Received initial history from ${nickname}, length: ${history.length}.`);
        whiteboardHistory = history;
        redrawWhiteboardFromHistoryIfVisible(true); // Force redraw
        if (logStatusDep) logStatusDep(`WB Client: State applied from ${nickname}.`);
    }
}

export function getWhiteboardHistory() {
    return whiteboardHistory;
}

export function loadWhiteboardData(importedHistory) {
    whiteboardHistory = importedHistory || [];
    redrawWhiteboardFromHistoryIfVisible(true);
}

export function resetWhiteboardState() {
    whiteboardHistory = [];
    if (wbCtx && whiteboardCanvas) { 
        const originalFill = wbCtx.fillStyle; wbCtx.fillStyle = '#FFFFFF';
        wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height); wbCtx.fillStyle = originalFill;
    }
    if (wbToolPalette) {
        const toolButtons = wbToolPalette.querySelectorAll('.wb-tool-btn');
        toolButtons.forEach(btn => btn.classList.remove('active'));
        const defaultToolButton = wbToolPalette.querySelector(`.wb-tool-btn[data-tool="pen"]`);
        if (defaultToolButton) defaultToolButton.classList.add('active');
        currentWbTool = 'pen';
        if (whiteboardCanvas) whiteboardCanvas.style.cursor = 'crosshair';
    }

    if(wbTextInputArea) wbTextInputArea.classList.add('hidden');
    if(wbActualTextInput) wbActualTextInput.value = '';
    wbTextInsertionPoint = null;
}

export function sendInitialWhiteboardStateToPeer(peerId, getIsHost) {
    if (getIsHost && getIsHost() && sendInitialWhiteboardDep) {
        if (logStatusDep) logStatusDep(`WB Host: Sending history to peer ${peerId.substring(0,6)}, length: ${whiteboardHistory.length}`);
        sendInitialWhiteboardDep(whiteboardHistory, peerId);
    }
}
