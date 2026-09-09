// ==============================================
// LUCAS - CHAT APP SCRIPT
// Wired to index.html + Flask backend
// ==============================================

// ==============================================
// HELPERS
// ==============================================

function $(id){
    return document.getElementById(id);
}

function esc(text){
    return String(text)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

// ==============================================
// ELEMENTS
// ==============================================

const app          = $("app");
const sidebar      = $("sidebar");
const closeSidebarBtn = $("closeSidebarBtn");
const mobileMenuBtn   = $("mobileMenuBtn");
const mobileHeader    = $("mobileHeader");
const overlay      = $("overlay");
const newChatBtn   = $("newChatBtn");
const searchInput  = $("searchChats");
const historyEl    = $("chatHistory");

const profileBtn   = $("profileBtn");
const accountMenu  = $("accountMenu");

const welcomeScreen = $("welcomeScreen");
const chatBox       = $("chatBox");
const typing        = $("typing");
const toast         = $("toast");

const toolsMenu    = $("toolsMenu");
const plusBtn      = $("plusBtn");
const micBtn       = $("micBtn");
const voiceBar     = $("voiceBar");
const voiceText    = $("voiceText");
const stopVoiceBtn = $("stopVoiceBtn");

const messageInput = $("messageInput");
const sendBtn      = $("sendBtn");

const themeSelect  = $("themeSelect");

// ==============================================
// TOAST
// ==============================================

let toastTimer;

function showToast(message){
    if(!toast) return;

    toast.textContent = message;
    toast.classList.remove("hidden");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{
        toast.classList.add("hidden");
    },2000);
}

// ==============================================
// SIDEBAR (MOBILE)
// ==============================================

function openSidebar(){
    sidebar.classList.add("open");
    overlay.classList.remove("hidden");
}

function closeSidebar(){
    sidebar.classList.remove("open");
    overlay.classList.add("hidden");
}

if(closeSidebarBtn){
    closeSidebarBtn.addEventListener("click",()=>{
        sidebar.classList.toggle("collapsed");
    });
}

if(mobileMenuBtn){
    mobileMenuBtn.addEventListener("click",openSidebar);
}

if(overlay){
    overlay.addEventListener("click",closeSidebar);
}

// ==============================================
// ACCOUNT MENU
// ==============================================

if(profileBtn){
    profileBtn.addEventListener("click",(e)=>{
        e.stopPropagation();
        accountMenu.classList.toggle("hidden");
    });
}

document.addEventListener("click",(e)=>{
    if(
        accountMenu &&
        !accountMenu.contains(e.target) &&
        !profileBtn.contains(e.target)
    ){
        accountMenu.classList.add("hidden");
    }
});

// ==============================================
// MODALS
// ==============================================

function openModal(id){
    const modal = $(id);
    if(modal){
        modal.classList.remove("hidden");
        accountMenu.classList.add("hidden");
    }
}

function closeAllModals(){
    document.querySelectorAll(".modal")
    .forEach(m=>m.classList.add("hidden"));
}

document.querySelectorAll("[data-modal]").forEach(btn=>{
    btn.addEventListener("click",()=>{
        openModal(btn.dataset.modal);
    });
});

document.querySelectorAll(".modal").forEach(modal=>{
    modal.addEventListener("click",(e)=>{
        if(e.target === modal){
            modal.classList.add("hidden");
        }
    });
});

document.querySelectorAll(".modal-close").forEach(btn=>{
    btn.addEventListener("click",()=>{
        closeAllModals();
    });
});

document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape"){
        closeAllModals();
        toolsMenu.classList.add("hidden");
        accountMenu.classList.add("hidden");
    }
});

// ==============================================
// TOOLS POPOVER
// ==============================================

if(plusBtn){
    plusBtn.addEventListener("click",(e)=>{
        e.stopPropagation();
        toolsMenu.classList.toggle("hidden");
    });
}

document.addEventListener("click",(e)=>{
    if(
        toolsMenu &&
        !toolsMenu.contains(e.target) &&
        e.target !== plusBtn
    ){
        toolsMenu.classList.add("hidden");
    }
});

document.querySelectorAll("#toolsMenu button").forEach(btn=>{
    btn.addEventListener("click",()=>{
        const tool = btn.dataset.tool;

        if(tool === "Upload File"){
            $("fileInput").click();
            return;
        }

        if(tool === "Create Image"){
            messageInput.value = "Create an image of ";
            messageInput.dispatchEvent(new Event("input"));
            messageInput.focus();
            toolsMenu.classList.add("hidden");
            return;
        }

        showToast(tool + " selected");
        toolsMenu.classList.add("hidden");
    });
});

if($("fileInput")){
    $("fileInput").addEventListener("change",()=>{
        const files = $("fileInput").files;
        if(files.length > 0){
            showToast(files.length + " file(s) attached");
            $("fileInput").value = "";
        }
    });
}

// ==============================================
// THEME
// ==============================================

function applyTheme(theme){
    document.body.classList.toggle("light",theme === "light");
    localStorage.setItem("lucas_theme",theme);

    if(themeSelect){
        themeSelect.value = theme;
    }
}

if(themeSelect){
    themeSelect.addEventListener("change",()=>{
        applyTheme(themeSelect.value);
    });

    applyTheme(
        localStorage.getItem("lucas_theme") || "dark"
    );
}

// ==============================================
// MESSAGES
// ==============================================

function scrollToBottom(){
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addUserMessage(text,messageId = null){
    const row = document.createElement("div");
    row.classList.add("message-row","user");

    if(messageId){
        row.dataset.messageId = messageId;
    }

    const bubble = document.createElement("div");
    bubble.classList.add("user-bubble");
    bubble.textContent = text;

    // hover actions: copy + edit
    const actions = document.createElement("div");
    actions.classList.add("user-actions");

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.title = "Copy";
    copyBtn.innerHTML =
        '<span class="material-symbols-rounded">content_copy</span>';

    copyBtn.addEventListener("click",()=>{
        navigator.clipboard.writeText(text);
        showToast("Copied to clipboard");
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.title = "Edit";
    editBtn.innerHTML =
        '<span class="material-symbols-rounded">edit</span>';

    editBtn.addEventListener("click",()=>{
        startEditing(row,text);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(editBtn);

    row.appendChild(bubble);
    row.appendChild(actions);
    chatBox.appendChild(row);
}

// ==============================================
// READ ALOUD (TEXT TO SPEECH)
// ==============================================

function stopSpeaking(){
    if(window.speechSynthesis){
        window.speechSynthesis.cancel();
    }

    document.querySelectorAll(".read-aloud-btn.speaking")
    .forEach(btn=>{
        btn.classList.remove("speaking");
        btn.innerHTML =
            '<span class="material-symbols-rounded">volume_up</span>';
    });
}

function readAloud(text,btn){
    if(!window.speechSynthesis){
        showToast("Read aloud not supported in this browser");
        return;
    }

    // clicking again stops playback
    if(btn.classList.contains("speaking")){
        stopSpeaking();
        return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    const icon = btn.querySelector(".material-symbols-rounded");

    utterance.onend = ()=>{
        btn.classList.remove("speaking");
        icon.textContent = "volume_up";
    };

    utterance.onerror = ()=>{
        btn.classList.remove("speaking");
        icon.textContent = "volume_up";
    };

    btn.classList.add("speaking");
    icon.textContent = "stop";

    window.speechSynthesis.speak(utterance);
}

// ==============================================
// EDIT USER MESSAGE
// ==============================================

function startEditing(row,originalText){
    // only one editor at a time
    document.querySelectorAll(".edit-box").forEach(box=>{
        box.closest(".message-row").remove();
    });

    stopSpeaking();

    const editorRow = document.createElement("div");
    editorRow.classList.add("message-row","user");

    const box = document.createElement("div");
    box.classList.add("edit-box");

    const textarea = document.createElement("textarea");
    textarea.value = originalText;
    textarea.rows = 1;

    const btns = document.createElement("div");
    btns.classList.add("edit-buttons");

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.classList.add("edit-cancel");
    cancel.textContent = "Cancel";

    const save = document.createElement("button");
    save.type = "button";
    save.classList.add("edit-save");
    save.textContent = "Send";

    btns.appendChild(cancel);
    btns.appendChild(save);

    box.appendChild(textarea);
    box.appendChild(btns);
    editorRow.appendChild(box);

    row.style.display = "none";
    row.parentNode.insertBefore(editorRow,row.nextSibling);
    textarea.focus();
    textarea.setSelectionRange(
        textarea.value.length,
        textarea.value.length
    );

    textarea.addEventListener("input",()=>{
        textarea.style.height = "auto";
        textarea.style.height =
            Math.min(textarea.scrollHeight,180) + "px";
    });
    textarea.style.height =
        Math.min(textarea.scrollHeight,180) + "px";

    textarea.addEventListener("keydown",(e)=>{
        if(e.key === "Enter" && !e.shiftKey){
            e.preventDefault();
            save.click();
        }
        if(e.key === "Escape"){
            cancel.click();
        }
    });

    cancel.addEventListener("click",()=>{
        editorRow.remove();
        row.style.display = "";
    });

    save.addEventListener("click",()=>{
        const newText = textarea.value.trim();

        if(newText === "" || newText === originalText){
            editorRow.remove();
            row.style.display = "";
            return;
        }

        const messageId = Number(row.dataset.messageId);

        // remove everything after the edited message
        let sibling = row.nextSibling;
        while(sibling){
            const next = sibling.nextSibling;
            sibling.remove();
            sibling = next;
        }

        editorRow.remove();
        row.style.display = "";

        bubble = row.querySelector(".user-bubble");
        bubble.textContent = newText;

        if(messageId){
            // persist the edit and get a fresh reply
            fetch("/edit_message",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({
                    message_id:messageId,
                    new_text:newText
                })
            })
            .then(r=>r.json())
            .then(data=>{
                hideTyping();

                if(data.chat_id){
                    currentChatId = data.chat_id;
                }

                const reply = data.reply || "Error: no reply.";
                addAssistantMessage(
                    reply,
                    reply.startsWith("Error:")
                );
                scrollToBottom();
                loadChatHistory();
            })
            .catch(()=>{
                hideTyping();
                addAssistantMessage(
                    "Error: could not reach the server.",
                    true
                );
            });

            showTyping();
        }else{
            // not saved yet - resend as a new message
            messageInput.value = newText;
            messageInput.dispatchEvent(new Event("input"));
            sendMessage();
        }
    });
}

// renders text or a generated image into a content container
function addMessageContent(text,container){
    const str = String(text);

    if(str.startsWith("IMAGE::")){
        const img = document.createElement("img");
        img.src = "/" + str.slice(7).trim();
        img.alt = "Generated image";
        img.classList.add("chat-image");

        img.addEventListener("error",()=>{
            const p = document.createElement("p");
            p.classList.add("msg-error");
            p.textContent = "Image could not be loaded.";
            container.appendChild(p);
        });

        container.appendChild(img);
        return;
    }

    renderSimpleMarkdown(str,container);
}

function addAssistantMessage(text,isError = false){
    const row = document.createElement("div");
    row.classList.add("message-row","assistant-row");

    const content = document.createElement("div");
    content.classList.add("assistant-content");

    if(isError){
        const p = document.createElement("p");
        p.classList.add("msg-error");
        p.textContent = text;
        content.appendChild(p);
    }else{
        addMessageContent(text,content);
    }

    // actions: copy + read aloud
    const actions = document.createElement("div");
    actions.classList.add("message-actions");

    const plainText = String(text)
    .replace(/^IMAGE::\S+\s*/,"")
    .trim();

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.title = "Copy";
    copyBtn.innerHTML =
        '<span class="material-symbols-rounded">content_copy</span>';

    copyBtn.addEventListener("click",()=>{
        navigator.clipboard.writeText(plainText);
        showToast("Copied to clipboard");
    });

    actions.appendChild(copyBtn);

    const readBtn = document.createElement("button");
    readBtn.type = "button";
    readBtn.title = "Read aloud";
    readBtn.classList.add("read-aloud-btn");
    readBtn.innerHTML =
        '<span class="material-symbols-rounded">volume_up</span>';

    readBtn.addEventListener("click",()=>{
        readAloud(plainText,readBtn);
    });

    if(plainText !== ""){
        actions.appendChild(readBtn);
    }

    content.appendChild(actions);

    row.appendChild(content);
    chatBox.appendChild(row);
}

// very small markdown: **bold**, `code`, ```blocks```
function renderSimpleMarkdown(text,container){
    const parts = String(text).split(/```/);

    parts.forEach((part,index)=>{

        if(index % 2 === 1){
            // code block
            const pre = document.createElement("pre");
            const code = document.createElement("code");
            code.textContent = part.replace(/^\w*\n/,"");
            pre.appendChild(code);
            container.appendChild(pre);
            return;
        }

        // plain text; lines starting with IMAGE:: render as images
        const lines = part.split("\n");
        let buffer = "";

        const flushBuffer = ()=>{
            if(buffer.trim() === "") return;

            const p = document.createElement("p");
            const tokens =
                buffer.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

            tokens.forEach(token=>{
                if(!token) return;

                if(token.startsWith("**")){
                    const b = document.createElement("strong");
                    b.textContent = token.slice(2,-2);
                    p.appendChild(b);
                }
                else if(token.startsWith("`")){
                    const c = document.createElement("code");
                    c.textContent = token.slice(1,-1);
                    p.appendChild(c);
                }
                else{
                    p.appendChild(
                        document.createTextNode(token)
                    );
                }
            });

            container.appendChild(p);
            buffer = "";
        };

        lines.forEach(line=>{
            const t = line.trim();

            if(t.startsWith("IMAGE::")){
                flushBuffer();

                const img = document.createElement("img");
                img.src = "/" + t.slice(7).trim();
                img.alt = "Generated image";
                img.classList.add("chat-image");
                container.appendChild(img);
            }
            else{
                buffer += line + "\n";
            }
        });

        flushBuffer();
    });
}

// ==============================================
// TYPING INDICATOR
// ==============================================

function showTyping(){
    typing.classList.remove("hidden");
    scrollToBottom();
}

function hideTyping(){
    typing.classList.add("hidden");
}

// ==============================================
// CHAT WITH BACKEND
// ==============================================

let currentChatId = null;
let isSending = false;

async function sendToServer(text){
    isSending = true;
    sendBtn.disabled = true;

    showTyping();

    try{
        const res = await fetch("/chat",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                message:text,
                chat_id:currentChatId
            })
        });

        const data = await res.json();

        hideTyping();

        if(data.chat_id){
            currentChatId = data.chat_id;
        }

        if(data.user_message_id){
            const rows =
                document.querySelectorAll(".message-row.user");
            const lastUserRow = rows[rows.length - 1];

            if(lastUserRow){
                lastUserRow.dataset.messageId =
                    data.user_message_id;
            }
        }

        const reply = data.reply || "Error: no reply from server.";
        const isError = reply.startsWith("Error:");

        addAssistantMessage(reply,isError);
        scrollToBottom();

        if(currentChatId){
            loadChatHistory();
        }
    }
    catch(err){
        hideTyping();
        addAssistantMessage(
            "Error: could not reach the server.",
            true
        );
    }
    finally{
        isSending = false;
        updateSendState();
    }
}

function sendMessage(){
    const text = messageInput.value.trim();

    if(text === "" || isSending) return;

    stopSpeaking();
    welcomeScreen.classList.add("hidden");
    chatBox.classList.remove("hidden");
    typing.classList.remove("hidden");

    addUserMessage(text);
    messageInput.value = "";
    messageInput.style.height = "auto";
    updateSendState();

    scrollToBottom();

    sendToServer(text);
}

// ==============================================
// SEND BUTTON STATE
// ==============================================

function updateSendState(){
    if(!sendBtn) return;
    sendBtn.disabled =
        messageInput.value.trim() === "" || isSending;
}

messageInput.addEventListener("input",()=>{
    messageInput.style.height = "auto";
    messageInput.style.height =
        Math.min(messageInput.scrollHeight,180) + "px";

    updateSendState();
});

sendBtn.addEventListener("click",sendMessage);

messageInput.addEventListener("keydown",(e)=>{
    if(e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        sendMessage();
    }
});

// ==============================================
// SUGGESTIONS
// ==============================================

document.querySelectorAll(".suggestion").forEach(btn=>{
    btn.addEventListener("click",()=>{
        messageInput.value = btn.dataset.prompt;
        messageInput.dispatchEvent(new Event("input"));
        sendMessage();
    });
});

// ==============================================
// CONNECTION STATUS
// ==============================================

const connectionStatus = $("connectionStatus");
const connectionText = $("connectionText");

function updateConnectionStatus(){
    if(!connectionStatus) return;

    if(navigator.onLine){
        connectionText.textContent = "Connected";
        connectionStatus.classList.remove("offline");
    }else{
        connectionText.textContent = "Offline";
        connectionStatus.classList.add("offline");
    }
}

window.addEventListener("online",updateConnectionStatus);
window.addEventListener("offline",updateConnectionStatus);
updateConnectionStatus();

// ==============================================
// CHAT HISTORY (SIDEBAR)
// ==============================================

async function loadChatHistory(){
    try{
        const res = await fetch("/chats");
        const chats = await res.json();

        historyEl.innerHTML = "";

        if(chats.length === 0){
            const empty = document.createElement("div");
            empty.classList.add("history-empty");
            empty.textContent = "No chats yet";
            historyEl.appendChild(empty);
            return;
        }

        chats.forEach(chat=>{
            const item = document.createElement("button");
            item.classList.add("history-item");
            item.type = "button";
            item.dataset.chatId = chat.id;

            if(chat.id === currentChatId){
                item.classList.add("active");
            }

            item.innerHTML = `
                <span class="material-symbols-rounded">
                    chat_bubble_outline
                </span>
                <span class="history-name"></span>
            `;

            item.querySelector(".history-name").textContent =
                chat.title || "New Chat";

            item.addEventListener("click",()=>{
                openChat(chat.id);
            });

            historyEl.appendChild(item);
        });
    }
    catch(err){
        // not logged in or server error - ignore
    }
}

async function openChat(id){
    currentChatId = id;

    stopSpeaking();
    document.querySelectorAll(".history-item").forEach(el=>{
        el.classList.toggle(
            "active",
            Number(el.dataset.chatId) === Number(id)
        );
    });

    welcomeScreen.classList.add("hidden");
    chatBox.classList.remove("hidden");
    chatBox.innerHTML = "";

    try{
        const res = await fetch("/load_chat/" + id);
        const messages = await res.json();

        messages.forEach(m=>{
            if(m.role === "user"){
                addUserMessage(m.content,m.id);
            }else{
                addAssistantMessage(m.content);
            }
        });
    }
    catch(err){
        addAssistantMessage("Error: could not load chat.",true);
    }

    scrollToBottom();
}

if(newChatBtn){
    newChatBtn.addEventListener("click",()=>{
        stopSpeaking();
        currentChatId = null;
        chatBox.innerHTML = "";
        chatBox.classList.add("hidden");
        welcomeScreen.classList.remove("hidden");
        closeSidebar();
        messageInput.focus();
    });
}

// search filter
if(searchInput){
    searchInput.addEventListener("input",()=>{
        const query = searchInput.value.toLowerCase();

        document.querySelectorAll(".history-item").forEach(item=>{
            const name = item
                .querySelector(".history-name")
                .textContent.toLowerCase();

            item.style.display = name.includes(query)
                ? ""
                : "none";
        });
    });
}

// ==============================================
// VOICE INPUT
// ==============================================

let recognition = null;
let isListening = false;

if("webkitSpeechRecognition" in window){
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
}

if(micBtn){
    micBtn.addEventListener("click",()=>{
        if(!recognition){
            showToast("Voice input not supported in this browser");
            return;
        }

        if(isListening){
            recognition.stop();
            return;
        }

        recognition.start();
    });
}

if(recognition){
    recognition.onstart = ()=>{
        isListening = true;
        micBtn.classList.add("active");
        voiceText.textContent = "Speak to Lucas";
        voiceBar.classList.remove("hidden");
    };

    recognition.onresult = (event)=>{
        let transcript = "";

        for(let i = 0; i < event.results.length; i++){
            transcript += event.results[i][0].transcript;
        }

        messageInput.value = transcript;
        messageInput.dispatchEvent(new Event("input"));
    };

    recognition.onend = ()=>{
        isListening = false;
        micBtn.classList.remove("active");
        voiceBar.classList.add("hidden");
    };

    recognition.onerror = ()=>{
        isListening = false;
        micBtn.classList.remove("active");
        voiceBar.classList.add("hidden");
    };
}

if(stopVoiceBtn){
    stopVoiceBtn.addEventListener("click",()=>{
        if(recognition){
            recognition.stop();
        }
    });
}

// ==============================================
// STARTUP
// ==============================================

chatBox.classList.add("hidden");
updateSendState();
loadChatHistory();
