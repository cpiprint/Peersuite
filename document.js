// document.js

// --- Global variables for document.js ---
let documents = [];
let currentActiveDocumentId = null;

// --- Dependencies (will be set in initDocumentFeatures) ---
let sendInitialDocumentsDep, sendCreateDocumentDep, sendRenameDocumentDep;
let sendDeleteDocumentDep, sendDocumentContentUpdateDep;
let logStatusDep, showNotificationDep;
let getPeerNicknamesDep, localGeneratedPeerIdDep, getIsHostDep;

// --- DOM Elements (selected within this module) ---
let documentsSection, documentListDiv, newDocBtn, renameDocBtn, deleteDocBtn, collaborativeEditor;
let docBoldBtn, docItalicBtn, docUnderlineBtn, docUlBtn, docOlBtn, downloadTxtBtn;


function selectDocumentDomElements() {
    documentsSection = document.getElementById('documentsSection');
    documentListDiv = document.getElementById('documentList');
    newDocBtn = document.getElementById('newDocBtn');
    renameDocBtn = document.getElementById('renameDocBtn');
    deleteDocBtn = document.getElementById('deleteDocBtn');
    collaborativeEditor = document.getElementById('collaborativeEditor');
    docBoldBtn = document.getElementById('docBoldBtn');
    docItalicBtn = document.getElementById('docItalicBtn');
    docUnderlineBtn = document.getElementById('docUnderlineBtn');
    docUlBtn = document.getElementById('docUlBtn');
    docOlBtn = document.getElementById('docOlBtn');
    downloadTxtBtn = document.getElementById('downloadTxtBtn');
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

const debouncedSendActiveDocumentContentUpdate = debounce(() => {
    if (sendDocumentContentUpdateDep && currentActiveDocumentId && collaborativeEditor) {
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (activeDoc && collaborativeEditor.innerHTML !== activeDoc.htmlContent) {
            activeDoc.htmlContent = collaborativeEditor.innerHTML; 
            sendDocumentContentUpdateDep({ documentId: currentActiveDocumentId, htmlContent: activeDoc.htmlContent });
            if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('documentsSection');
        }
    }
}, 750);


export function initDocumentFeatures(dependencies) {
    selectDocumentDomElements();

    sendInitialDocumentsDep = dependencies.sendInitialDocuments; 
    sendCreateDocumentDep = dependencies.sendCreateDocument;
    sendRenameDocumentDep = dependencies.sendRenameDocument;
    sendDeleteDocumentDep = dependencies.sendDeleteDocument;
    sendDocumentContentUpdateDep = dependencies.sendDocumentContentUpdate;
    logStatusDep = dependencies.logStatus;
    showNotificationDep = dependencies.showNotification;
    getPeerNicknamesDep = dependencies.getPeerNicknames;
    localGeneratedPeerIdDep = dependencies.localGeneratedPeerId;
    getIsHostDep = dependencies.getIsHost;

    if (!collaborativeEditor || !newDocBtn || !renameDocBtn || !deleteDocBtn || !docBoldBtn || !downloadTxtBtn || !documentListDiv) {
        console.warn("Document DOM elements not found, Document feature might be partially disabled.");
    } else {
        collaborativeEditor.addEventListener('input', debouncedSendActiveDocumentContentUpdate);
        const execFormatCommand = (command) => { document.execCommand(command, false, null); collaborativeEditor.focus(); debouncedSendActiveDocumentContentUpdate(); };
        docBoldBtn.addEventListener('click', () => execFormatCommand('bold'));
        docItalicBtn.addEventListener('click', () => execFormatCommand('italic'));
        docUnderlineBtn.addEventListener('click', () => execFormatCommand('underline'));
        docUlBtn.addEventListener('click', () => execFormatCommand('insertUnorderedList'));
        docOlBtn.addEventListener('click', () => execFormatCommand('insertOrderedList'));
        downloadTxtBtn.addEventListener('click', () => {
            if (!currentActiveDocumentId) { if(logStatusDep) logStatusDep("No active document to download.", true); return; }
            const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
            if (!activeDoc) { if(logStatusDep) logStatusDep("Active document not found.", true); return; }
            const tempDiv = document.createElement('div'); tempDiv.innerHTML = activeDoc.htmlContent;
            const text = tempDiv.innerText || tempDiv.textContent || ""; tempDiv.remove();
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const filename = `${activeDoc.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename;
            document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
        });

        newDocBtn.addEventListener('click', () => uiActionCreateNewDocument());
        renameDocBtn.addEventListener('click', uiActionRenameDocument);
        deleteDocBtn.addEventListener('click', uiActionDeleteDocument);
    }
    
    renderDocumentList(); 
    loadActiveDocumentContent();

    return {
        handleInitialDocuments,
        handleCreateDocument,
        handleRenameDocument,
        handleDeleteDocument,
        handleDocumentContentUpdate,
        renderDocumentsIfActive,
        ensureDefaultDocument,
        getDocumentShareData,
        loadDocumentData,
        resetDocumentState,
        sendInitialDocumentsStateToPeer // Added for explicitness
    };
}

export function renderDocumentsIfActive(force = false) {
     if (documentsSection && ( (!documentsSection.classList.contains('hidden')) || force)) {
        renderDocumentList(); loadActiveDocumentContent();
    }
}

function renderDocumentList() {
    if (!documentListDiv) return;
    documentListDiv.innerHTML = '';
    if (documents.length === 0 && getIsHostDep && getIsHostDep() && sendCreateDocumentDep) {
       
    }
    documents.forEach(doc => {
        const docItem = document.createElement('span');
        docItem.classList.add('document-list-item'); docItem.textContent = doc.name; docItem.dataset.documentId = doc.id;
        if (doc.id === currentActiveDocumentId) docItem.classList.add('active');
        docItem.addEventListener('click', () => setActiveDocument(doc.id));
        documentListDiv.appendChild(docItem);
    });
    if (collaborativeEditor) {
        if (!currentActiveDocumentId || !documents.find(d => d.id === currentActiveDocumentId)) {
            collaborativeEditor.innerHTML = '<p>Select or create a document.</p>'; collaborativeEditor.contentEditable = "false";
        } else collaborativeEditor.contentEditable = "true";
    }
}
function loadActiveDocumentContent() {
    if (!collaborativeEditor) return;
    if (!currentActiveDocumentId && documents.length > 0) currentActiveDocumentId = documents[0].id;
    const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
    if (activeDoc) {
        if (collaborativeEditor.innerHTML !== activeDoc.htmlContent) collaborativeEditor.innerHTML = activeDoc.htmlContent;
        collaborativeEditor.contentEditable = "true";
    } else if (documents.length > 0) {
        currentActiveDocumentId = documents[0].id;
        if (collaborativeEditor.innerHTML !== documents[0].htmlContent) collaborativeEditor.innerHTML = documents[0].htmlContent;
        collaborativeEditor.contentEditable = "true";
    } else { // No documents exist
        collaborativeEditor.innerHTML = '<p>Select or create a document to start editing.</p>';
        collaborativeEditor.contentEditable = "false";
    }
    renderDocumentList(); 
}
function setActiveDocument(documentId) {
    if (currentActiveDocumentId && collaborativeEditor) {  
        const currentDocObj = documents.find(d => d.id === currentActiveDocumentId);
        if (currentDocObj && collaborativeEditor.innerHTML !== currentDocObj.htmlContent) {
             currentDocObj.htmlContent = collaborativeEditor.innerHTML;
        }
    }
    currentActiveDocumentId = documentId; 
    loadActiveDocumentContent();
}

function uiActionCreateNewDocument(defaultName = null, defaultContent = null, broadcast = true) {
    const docName = defaultName || prompt("Enter name for the new document:", `Document ${documents.length + 1}`);
    if (!docName) return;
    const newDoc = { id: `doc-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, name: docName, htmlContent: defaultContent || '<p>Start typing...</p>' };
    documents.push(newDoc); 
    setActiveDocument(newDoc.id); 
    if (broadcast && sendCreateDocumentDep) {
        sendCreateDocumentDep(newDoc);
        if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('documentsSection');
    }
    return newDoc; 
}
export function ensureDefaultDocument() {
    if (getIsHostDep && getIsHostDep() && documents.length === 0) {
        return uiActionCreateNewDocument("Shared Notes", "<p>Welcome!</p>", true);
    }
    return null;
}
function uiActionRenameDocument() {
    if (!currentActiveDocumentId) { if(logStatusDep) logStatusDep("No active document selected to rename.", true); return; }
    const docToRename = documents.find(d => d.id === currentActiveDocumentId);
    if (!docToRename) { if(logStatusDep) logStatusDep("Selected document not found.", true); return; }
    const newName = prompt("Enter new name for the document:", docToRename.name);
    if (newName && newName.trim() && newName !== docToRename.name) {
        docToRename.name = newName.trim(); 
        renderDocumentList(); // Update UI
        if (sendRenameDocumentDep) {
            sendRenameDocumentDep({ documentId: currentActiveDocumentId, newName: docToRename.name });
            if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && showNotificationDep) showNotificationDep('documentsSection');
        }
    }
}
function uiActionDeleteDocument() {
    if (!currentActiveDocumentId) { if(logStatusDep) logStatusDep("No active document selected to delete.", true); return; }
    const docToDelete = documents.find(d => d.id === currentActiveDocumentId);
    if (!docToDelete) { if(logStatusDep) logStatusDep("Selected document not found.", true); return; }
    if (!confirm(`Are you sure you want to delete the document "${docToDelete.name}"? This cannot be undone.`)) return;
    
    const deletedDocId = currentActiveDocumentId;
    documents = documents.filter(doc => doc.id !== deletedDocId);
    
    if (sendDeleteDocumentDep) sendDeleteDocumentDep({ documentId: deletedDocId });
    
    currentActiveDocumentId = null; 
    if (documents.length > 0) {
        setActiveDocument(documents[0].id); 
    } else { 
        if (getIsHostDep && getIsHostDep()) { 
            ensureDefaultDocument();
        } else { 
             if(collaborativeEditor) { 
                collaborativeEditor.innerHTML = '<p>No documents available.</p>'; 
                collaborativeEditor.contentEditable = "false"; 
            }
            renderDocumentList(); 
        }
    }
    if (getPeerNicknamesDep && Object.keys(getPeerNicknamesDep()).length > 0 && deletedDocId && showNotificationDep) showNotificationDep('documentsSection');
}

export function handleInitialDocuments(data, peerId) {
    if (getIsHostDep && !getIsHostDep()) { 
        documents = data.docs || [];
        currentActiveDocumentId = data.activeId || (documents.length > 0 ? documents[0].id : null);
        renderDocumentList(); 
        loadActiveDocumentContent();
        if(logStatusDep) logStatusDep(`Received documents state from ${(getPeerNicknamesDep && getPeerNicknamesDep()[peerId]) ? getPeerNicknamesDep()[peerId] : 'host'}.`);
    }
}
export function handleCreateDocument(newDocData, peerId) {
    if (!documents.find(d => d.id === newDocData.id)) { 
        documents.push(newDocData); 
        renderDocumentList();
        if (documents.length === 1 && !currentActiveDocumentId) { 
            setActiveDocument(newDocData.id);
        }
        if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');
    }
}
export function handleRenameDocument(renameData, peerId) {
    const doc = documents.find(d => d.id === renameData.documentId);
    if (doc) { 
        doc.name = renameData.newName; 
        renderDocumentList(); 
        if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');
    }
}
export function handleDeleteDocument(deleteData, peerId) {
    documents = documents.filter(d => d.id !== deleteData.documentId);
    if (currentActiveDocumentId === deleteData.documentId) { 
        currentActiveDocumentId = documents.length > 0 ? documents[0].id : null;
        loadActiveDocumentContent(); 
    }
    renderDocumentList(); 
    if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');
}
export function handleDocumentContentUpdate(data, peerId) {
    const doc = documents.find(d => d.id === data.documentId);
    if (doc && collaborativeEditor) {
        doc.htmlContent = data.htmlContent;
        if (currentActiveDocumentId === data.documentId && collaborativeEditor.innerHTML !== data.htmlContent) {
            collaborativeEditor.innerHTML = data.htmlContent; 
        }
        if (peerId !== localGeneratedPeerIdDep && showNotificationDep) showNotificationDep('documentsSection');
    }
}

export function getDocumentShareData() {
    if (currentActiveDocumentId && collaborativeEditor) { 
        const activeDoc = documents.find(d => d.id === currentActiveDocumentId);
        if (activeDoc && collaborativeEditor.innerHTML !== activeDoc.htmlContent) {
            activeDoc.htmlContent = collaborativeEditor.innerHTML;
        }
    }
    return { docs: documents, activeId: currentActiveDocumentId };
}

export function loadDocumentData(importedDocs, activeId) {
    documents = importedDocs || []; 
    currentActiveDocumentId = activeId || null;
    if (documents.length > 0 && (!currentActiveDocumentId || !documents.find(d => d.id === currentActiveDocumentId))) {
        currentActiveDocumentId = documents[0].id;
    }
}

export function resetDocumentState() {
    documents = []; 
    currentActiveDocumentId = null;
    if (documentListDiv) documentListDiv.innerHTML = '';
    if (collaborativeEditor) { 
        collaborativeEditor.innerHTML = '<p>Select or create a document.</p>'; 
        collaborativeEditor.contentEditable = "false"; 
    }
}

export function sendInitialDocumentsStateToPeer(peerId, getIsHost) {
    if (getIsHost && getIsHost() && sendInitialDocumentsDep) {
        sendInitialDocumentsDep(getDocumentShareData(), peerId);
    }
}
