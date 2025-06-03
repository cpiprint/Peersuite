let kanbanData = { columns: [] };
let draggedCardElement = null;
let draggedCardData = null;
let kanbanCurrentlyAddingCardToColumnId = null; // For new add card UI

let sendKanbanUpdateDep, sendInitialKanbanDep;
let logStatusDep, showNotificationDep;
let getPeerNicknamesDep; // For notifications

// --- DOM Elements (selected within this module) ---
let kanbanBoard, newColumnNameInput, addColumnBtn;

function selectKanbanDomElements() {
    kanbanBoard = document.getElementById('kanbanBoard');
    newColumnNameInput = document.getElementById('newColumnNameInput');
    addColumnBtn = document.getElementById('addColumnBtn');
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function initKanbanFeatures(dependencies) {
    selectKanbanDomElements();

    sendKanbanUpdateDep = dependencies.sendKanbanUpdate;
    sendInitialKanbanDep = dependencies.sendInitialKanban;
    logStatusDep = dependencies.logStatus;
    showNotificationDep = dependencies.showNotification;
    getPeerNicknamesDep = dependencies.getPeerNicknames;

    if (!addColumnBtn || !kanbanBoard || !newColumnNameInput) {
        console.warn("Kanban DOM elements not found, Kanban feature might be partially disabled.");
    } else {
        addColumnBtn.addEventListener('click', handleAddKanbanColumn);
    }
    
    renderKanbanBoard();

    return {
        handleKanbanUpdate,
        handleInitialKanban,
        renderKanbanBoardIfActive,
        getKanbanData,
        loadKanbanData,
        resetKanbanState,
        sendInitialKanbanStateToPeer
    };
}

export function renderKanbanBoard() {
    if (!kanbanBoard) return;
    kanbanBoard.innerHTML = '';
    if (!kanbanData || !kanbanData.columns) kanbanData = { columns: [] };

    kanbanData.columns.forEach(column => {
        const columnDiv = document.createElement('div');
        columnDiv.classList.add('kanban-column');
        columnDiv.dataset.columnId = column.id;
        
        let cardsHtml = (column.cards || []).map(card => {
            const cardPriority = card.priority || 1;
            const escapedText = escapeHtml(card.text);
            return `
                <div class="kanban-card priority-${cardPriority}" draggable="true" data-card-id="${card.id}" data-parent-column-id="${column.id}" data-priority="${cardPriority}">
                    <div class="kanban-card-content">
                        <p>${escapedText}</p>
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
            <h3>${escapeHtml(column.title)}<button class="delete-column-btn" data-column-id="${column.id}" title="Delete column">🗑️</button></h3>
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
                targetCol.cards.push(movedCard); 
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
    if (!kanbanBoard) return;
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
        
        kanbanCurrentlyAddingCardToColumnId = null; 
        renderKanbanBoard(); 
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
            renderKanbanBoard(); 
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

export function handleKanbanUpdate(update, peerId, localGeneratedPeerId) {
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

                if (existingCardIndex > -1) { 
                    col.cards[existingCardIndex] = { ...col.cards[existingCardIndex], ...cardData };
                } else { 
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
        if (peerId !== localGeneratedPeerId && showNotificationDep) showNotificationDep('kanbanSection');
    }
}
export function handleInitialKanban(initialData, peerId, getIsHost, localGeneratedPeerId) {
    if (getIsHost && !getIsHost()) { // Only non-hosts process this
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

export function getKanbanData() {
    return kanbanData;
}

export function loadKanbanData(importedData) {
    kanbanData = importedData || { columns: [] };
    if (kanbanData && kanbanData.columns) {
        kanbanData.columns.forEach(column => {
            if (column.cards) {
                column.cards.forEach(card => card.priority = card.priority || 1);
            }
        });
    }
}

export function resetKanbanState() {
    kanbanData = { columns: [] }; 
    kanbanCurrentlyAddingCardToColumnId = null; 
    if (kanbanBoard) kanbanBoard.innerHTML = '';
}

export function sendInitialKanbanStateToPeer(peerId, getIsHost) {
    if (getIsHost && getIsHost() && sendInitialKanbanDep && (kanbanData.columns && kanbanData.columns.length > 0)) {
        sendInitialKanbanDep(kanbanData, peerId);
    }
}