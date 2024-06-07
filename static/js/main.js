const socket = io();
let replyMessageContent = null;
let can_record = false;
let is_recording = false;
let is_removed = false;
let recorder = null;
let chunks = [];

function generateUniqueId() {
    return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

let userId = localStorage.getItem("userId");
if (!userId) {
    userId = generateUniqueId();
    localStorage.setItem("userId", userId);
}

function setUpAudio(){
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
        console.log("Setup");
        navigator.mediaDevices.getUserMedia({audio:true}).then(setUpStream).catch(err => {console.error(err)});
    }
}

setUpAudio();

function setUpStream(stream) {
    recorder = new MediaRecorder(stream);
    let chunks = [];

    recorder.ondataavailable = e => {chunks.push(e.data);};

    recorder.onstop = e => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        chunks = [];
        
        if(is_removed){
            is_removed = false;
            document.querySelector("#send img").src = (document.getElementById("message").value.trim() === "") ? recordImgUrl : sendImgUrl;
            document.getElementById("send_button_span").removeChild(document.getElementById("send_button_span").querySelector("#terminate"));
            document.getElementById("send").click();
        }
        else{
            document.getElementById("send_button_span").removeChild(document.getElementById("send_button_span").querySelector("#terminate"));
            let username = document.getElementById("username").value || `User${userId}`;
            document.getElementById("username").value = username;
            const message = "";
            const time = new Date().toISOString();

            if (username) {
                if (blob.size > 0) {
                    const fileName = `audio_${Date.now()}.wav`;
                    const chunkSize = 1 * 1024 * 1024;
                    let start = 0;
                    const uploadProgress = document.getElementById("upload-progress");
                    uploadProgress.style.display = "block";

                    const sendNextChunk = () => {
                        const maxChunkSize = 512 * 1024; // Maximum chunk size in bytes (512KB)
                        const sliceStart = start;
                        const sliceEnd = Math.min(start + maxChunkSize, blob.size);
                        const slice = blob.slice(sliceStart, sliceEnd);
                        const reader = new FileReader();
                        reader.onload = e => {
                            socket.emit("file", {
                                userId, username, fileName, chunkData: e.target.result,
                                start: sliceStart, totalSize: blob.size, time, message
                            });
                            start += sliceEnd - sliceStart;
                            if (start < blob.size) {
                                uploadProgress.value = (start / blob.size) * 100;
                                sendNextChunk();
                            } else {
                                uploadProgress.value = 0;
                                uploadProgress.style.display = "none";
                                document.getElementById("file-info").style.display = "none";
                                if (document.getElementById("message").value.trim() === "") {
                                    document.querySelector("#send img").src = recordImgUrl;
                                } else {
                                    document.querySelector("#send img").src = sendImgUrl;
                                }
                                replyMessageContent = null;
                                updateReplyPreview(null);
                            }
                        };
                        reader.onerror = err => {
                            console.error('File reading error:', err);
                        };
                        reader.readAsArrayBuffer(slice);
                    };
                    sendNextChunk();
                } else if (message) {
                    socket.send({ userId, username, message, time, reply: replyMessageContent });
                    document.querySelector("#send img").src = (document.getElementById("message").value.trim() === "") ? recordImgUrl : sendImgUrl;
                    replyMessageContent = null;
                    updateReplyPreview(null);
                }
            }
        }
    };

    can_record = true;
}


function ToggleMic(){
    if(!can_record) return;

    is_recording = !is_recording;

    if(is_recording){
        const sendButtonImg = document.querySelector("#send img");
        sendButtonImg.src = terminateImgUrl;

        const sendGroup = document.getElementById("send_button_span");
        const remove = document.createElement("button");
        const removeImg = document.createElement("img");

        remove.id = "terminate";
        removeImg.src = removeImgUrl;

        remove.addEventListener("click", ()=>{
            is_removed = true;
            recorder.stop();
        });

        remove.appendChild(removeImg);
        
        sendGroup.appendChild(remove);

        
        recorder.start();
    }
    else{
        
        recorder.stop();
    }
    
}


document.getElementById("send").addEventListener("click", () => {
    const fileInput = document.getElementById("file-input");
    if(document.getElementById("message").value.trim() != "" && !is_recording || fileInput.files.length > 0){
        let username = document.getElementById("username").value || `User${userId}`;
        document.getElementById("username").value = username;
        const message = document.getElementById("message").value;
        const time = new Date().toISOString();

        if (username) {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const chunkSize = 1 * 1024 * 1024;
                let start = 0;
                const uploadProgress = document.getElementById("upload-progress");
                uploadProgress.style.display = "block";

                const sendNextChunk = () => {
                    const maxChunkSize = 512 * 1024; // Maximum chunk size in bytes (512KB)
                    const sliceStart = start;
                    const sliceEnd = Math.min(start + maxChunkSize, file.size);
                    const slice = file.slice(sliceStart, sliceEnd);
                    const reader = new FileReader();
                    reader.onload = e => {
                        socket.emit("file", {
                            userId, username, fileName: file.name, chunkData: e.target.result,
                            start: sliceStart, totalSize: file.size, time, message
                        });
                        start += sliceEnd - sliceStart;
                        if (start < file.size) {
                            uploadProgress.value = (start / file.size) * 100;
                            sendNextChunk();
                        } else {
                            uploadProgress.value = 0;
                            uploadProgress.style.display = "none";
                            fileInput.value = "";
                            document.getElementById("file-info").style.display = "none";
                            document.getElementById("message").value = "";
                            document.querySelector("#send img").src = (document.getElementById("message").value.trim() === "" && !is_recording) ? recordImgUrl : (document.getElementById("message").value.trim() !== "" && !is_recording) ? sendImgUrl : document.querySelector("#send img").src;
                            replyMessageContent = null;
                            updateReplyPreview(null);
                        }
                    };
                    reader.onerror = err => {console.error('File reading error:', err);};
                    reader.readAsArrayBuffer(slice);
                };
                sendNextChunk();
            } else if (message) {
                socket.send({ userId, username, message, time, reply: replyMessageContent });
                document.getElementById("message").value = "";
                document.querySelector("#send img").src = (document.getElementById("message").value.trim() === "" && !is_recording) ? recordImgUrl : (document.getElementById("message").value.trim() !== "" && !is_recording) ? sendImgUrl : document.querySelector("#send img").src;
                replyMessageContent = null;
                updateReplyPreview(null);
            }
        }
    }
    else{
        ToggleMic();
    }
});

const escapeHtml = unsafe => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
socket.on("message", msg => displayMessage(msg));
socket.on("file", fileMsg => displayMessage(fileMsg, true));

const displayMessage = (msg, isFile = false) => {
    const messages = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", msg.userId === userId ? "right" : "left");

    let messageContent;
    if (isFile) {
        const fileUrl = escapeHtml(msg.url);
        const fileName = escapeHtml(msg.fileName);
        const fileExtension = fileName.split('.').pop().toLowerCase();

        switch (fileExtension) {
            case 'jpg': case 'jpeg': case 'png': case 'gif':
                messageContent = `<div class="file-message"><img src="${fileUrl}" alt="${fileName}" class="responsive-image"><br><span>${escapeHtml(msg.message)}</span></div>`;
                break;
            case 'mp4': case 'webm': case 'ogg':
                messageContent = `<div class="file-message"><video controls class="responsive-video"><source src="${fileUrl}" type="video/${fileExtension}">Your browser does not support the video tag.</video><br><span>${escapeHtml(msg.message)}</span></div>`;
                break;
            case 'mp3': case 'wav': case 'ogg':
                messageContent = `<div class="file-message"><audio controls class="responsive-audio"><source src="${fileUrl}" type="audio/${fileExtension}">Your browser does not support the audio element.</audio><br><span>${escapeHtml(msg.message)}</span></div>`;
                break;
            default:
                messageContent = `<a href="${fileUrl}" download="${fileName}">${fileName}</a><br><span>${escapeHtml(msg.message)}</span>`;
                break;
        }
    } else {
        messageContent = escapeHtml(msg.message);
    }

    const timeString = new Date(msg.time).toLocaleString();

    let messageHTML = `
        ${msg.userId !== userId ? `<div class="username">${escapeHtml(msg.username)}</div>` : ""}
        <div class="text">${messageContent}</div>
        <div class="time">${escapeHtml(timeString)}</div>
    `;

    if (msg.reply) {
        const replyClass = msg.userId === userId ? "reply-inner-right" : "reply-inner-left";
        let replyText = escapeHtml(msg.reply.message);
        const maxLength = 50;
        if (replyText.length > maxLength) replyText = replyText.substring(0, maxLength) + "...";
        messageHTML = `<div class="reply-inner ${replyClass}"><div class="reply-username">${escapeHtml(msg.reply.username)}</div><div class="reply-text">${replyText}</div></div>${messageHTML}`;
    }

    messageElement.innerHTML = messageHTML;

    const effectiveMessageElement = document.createElement("div");
    effectiveMessageElement.className = "message-container";
    effectiveMessageElement.classList.add(msg.userId === userId ? "right" : "left");

    const replyButton = document.createElement("div");
    replyButton.className = "reply-button";
    replyButton.innerHTML = `<img src="${replyImgUrl}" alt="Reply" class="reply-image">`;
    replyButton.addEventListener("click", () => {
        replyMessageContent = { id: msg.id, username: msg.username, message: isFile ? `File: ${msg.fileName}` : msg.message };
        updateReplyPreview(replyMessageContent);
        document.getElementById("message").focus();
    });

    if (msg.userId === userId) {
        effectiveMessageElement.appendChild(replyButton);
        effectiveMessageElement.appendChild(messageElement);
    } else {
        effectiveMessageElement.appendChild(messageElement);
        effectiveMessageElement.appendChild(replyButton);
    }

    effectiveMessageElement.addEventListener("dblclick", () => {
        replyMessageContent = { id: msg.id, username: msg.username, message: isFile ? `File: ${msg.fileName}` : msg.message };
        updateReplyPreview(replyMessageContent);
        document.getElementById("message").focus();
    });

    messages.appendChild(effectiveMessageElement);
    messages.scrollTop = messages.scrollHeight;
};

//scroll to message if you click on a message with a reply, looking at the id of the message
document.addEventListener("click", event => {
    if (event.target.classList.contains("reply-inner")) {
        const id = event.target.parentElement.parentElement.id;
        const message = document.getElementById(id);
        message.scrollIntoView({ behavior: "smooth" });
    }
});

const updateReplyPreview = reply => {
    const replyPreview = document.getElementById("reply-preview");
    if (reply) {
        let truncatedMessage = reply.message;
        const maxLength = 50;
        if (truncatedMessage.length > maxLength) truncatedMessage = truncatedMessage.substring(0, maxLength) + "...";
        replyPreview.innerHTML = `<span id="cancel-reply">&times; <span style="margin-top:-5px;color:cyan;">Replying to ${escapeHtml(reply.username)}</span></span><br><br><span style="margin-left:25px">${escapeHtml(truncatedMessage)}</span>`;
        replyPreview.style.display = "block";
        document.getElementById("cancel-reply").addEventListener("click", () => {
            replyMessageContent = null;
            updateReplyPreview(null);
        });
    } else {
        replyPreview.style.display = "none";
    }
};

document.getElementById("message").addEventListener("keypress", e => {
    if (e.key === "Enter") document.getElementById("send").click();
});

document.addEventListener("keyup", e => {
    if (e.keyCode == 9) document.getElementById("menu-bars").click();
    if (e.key === "Escape") document.getElementById("closebtn").click();
});

document.getElementById("menu-bars").onclick = () => {
    document.getElementById("menu").style.width = "250px";
    ["menu", "chat-input", "messages", "reply-preview"].forEach(id => document.getElementById(id).classList.add("open"));
};

document.getElementById("closebtn").onclick = () => {
    document.getElementById("menu").style.width = "0";
    ["menu", "chat-input", "messages", "reply-preview"].forEach(id => document.getElementById(id).classList.remove("open"));
};

window.addEventListener("resize", () => {
    const isOpen = document.getElementById("menu").classList.contains("open");
    ["chat-input", "messages", "reply-preview"].forEach(id => document.getElementById(id).classList.toggle("open", isOpen));
});

document.getElementById("file-input").addEventListener("click", (event)=>{
    if(is_recording){
        alert("can't attach files while recording");
        event.preventDefault();
        return;
    }

    
});

document.getElementById("file-input").addEventListener("change", () => {
    const fileInput = document.getElementById("file-input");
    const sendButtonImg = document.querySelector("#send img");
    if(fileInput.files.length > 0){
        sendButtonImg.src = sendImgUrl;
    }

    const file = document.getElementById("file-input").files[0];
    const fileInfo = document.getElementById("file-info");
    const fileName = document.getElementById("file-name");
    if (file) {
        fileName.textContent = file.name;
        fileInfo.style.display = "block";
        if (window.innerWidth < 600) {
            fileInfo.style.overflow = "hidden";
            fileInfo.style.maxHeight = "30px";
            fileInfo.style.maxWidth = "50px";
            if (window.innerWidth < 400) fileName.textContent = "";
        } else {
            fileInfo.style.maxHeight = "none";
            fileInfo.style.maxWidth = "none";
        }
    } else {
        fileName.textContent = "";
        fileInfo.style.display = "none";
    }

    
});

document.getElementById("remove-file").addEventListener("click", () => {
    document.getElementById("file-input").value = "";
    document.getElementById("file-name").textContent = "";
    document.getElementById("file-info").style.display = "none";

    const messageInput = document.getElementById("message").value;
    const sendButtonImg = document.querySelector("#send img");
    if (messageInput.trim() === "" && !is_recording) {
        sendButtonImg.src = recordImgUrl;
    } else if(messageInput.trim() !== "" && !is_recording){
        sendButtonImg.src = sendImgUrl;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("menu-bars").click();
    fetchPreviousMessages();
});

document.getElementById("light-mode").addEventListener("click", () => {
    const lightMode = document.getElementById("light-mode").checked;
    const elements = [
        { id: "chat-header", style: lightMode ? "#8bb984" : "#4d4d4d" },
        { id: "menu", style: lightMode ? "#419fd9" : "#161616" },
        { id: "messages", style: lightMode ? "white" : "#272727" },
        { id: "username", style: lightMode ? { background: "white", color: "black", border: "2px solid black" } : { background: "#272727", color: "cyan", border: "2px solid white" } },
        { id: "message", style: lightMode ? { background: "white", color: "black" } : { background: "#272727", color: "white" } },
        { id: "chat-input", style: lightMode ? "#8bb984" : "#4d4d4d" },
        { id: "send", style: lightMode ? "#8bb984" : "#4d4d4d" }
    ];
    elements.forEach(({ id, style }) => {
        const element = document.getElementById(id);
        if (typeof style === "string") element.style.background = style;
        else Object.assign(element.style, style);
    });
});

document.addEventListener("click", event => {
    const menu = document.getElementById("menu");
    const menuBars = document.getElementById("menu-bars");
    const input = document.getElementById("chat-input");
    const isClickInside = target => target.contains(event.target);
    if (!isClickInside(menu) && !isClickInside(menuBars) && !isClickInside(input) && menu.classList.contains("open")) {
        menu.style.width = "0";
        ["menu", "chat-input", "messages", "reply-preview"].forEach(
            id => document.getElementById(id).classList.remove("open")
        );
    }
});

function fetchPreviousMessages() {
    fetch('/messages')
        .then(response => response.json())
        .then(data => {
            const allMessages = [...data.messages, ...data.files]; // Combine messages and files
            allMessages.sort((a, b) => new Date(a.time) - new Date(b.time)); // Sort messages by time
            allMessages.forEach(msg => {
                if (msg.fileName) {
                    displayMessage(msg, true); // Display files separately
                } else {
                    displayMessage(msg); // Display regular messages
                }
            });
        });
}

document.getElementById("message").addEventListener("input", () => {
    const messageInput = document.getElementById("message").value;
    document.querySelector("#send img").src = (messageInput.trim() === "" && !is_recording) ? recordImgUrl : (messageInput.trim() !== "" && !is_recording) ? sendImgUrl : none;
});