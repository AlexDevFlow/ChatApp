const socket = io();
let replyMessageContent = null;

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

let uniqueUserNumber = getRandomInt(getRandomInt(getRandomInt(100000)));


document.getElementById("send").addEventListener("click", () => {
    let username = document.getElementById("username").value;
    if (!username) {
      username = "UserNumber"+uniqueUserNumber.toString();
      document.getElementById("username").value = username;
    }
    const message = document.getElementById("message").value;
    const fileInput = document.getElementById("file-input");
    const time = new Date().toLocaleTimeString();
  
  if (username) {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const chunkSize = 1 * 1024 * 1024;
      let start = 0;
      const uploadProgress = document.getElementById("upload-progress");
      uploadProgress.style.display = "block";

      function sendNextChunk() {
        const slice = file.slice(start, start + chunkSize);
        const reader = new FileReader();
        reader.onload = function (e) {
          const chunkData = e.target.result;
          socket.emit("file", {
            username,
            fileName: file.name,
            chunkData,
            start,
            totalSize: file.size,
            time,
          });
          start += chunkSize;
          if (start < file.size) {
            uploadProgress.value = (start / file.size) * 100;
            sendNextChunk();
          } else {
            uploadProgress.value = 0;
            uploadProgress.style.display = "none";
            fileInput.value = "";
            document.getElementById("file-info").style.display = "none";
          }
        };
        reader.readAsArrayBuffer(slice);
      }

      sendNextChunk();
    } else if (message) {
      const msg = { username, message, time, reply: replyMessageContent };
      socket.send(msg);
      document.getElementById("message").value = "";
      replyMessageContent = null;
      updateReplyPreview(null);
    }
  }
});

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

socket.on("message", (msg) => {
  displayMessage(msg);
});

socket.on("file", (fileMsg) => {
  displayMessage(fileMsg, true);
});

function displayMessage(msg, isFile = false) {
    const messages = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    const isCurrentUser =
      msg.username === document.getElementById("username").value;
    messageElement.classList.add(isCurrentUser ? "right" : "left");
  
    let messageContent = isFile
      ? `<a href="${escapeHtml(msg.url)}" download="${escapeHtml(
          msg.fileName
        )}">${escapeHtml(msg.fileName)}</a>`
      : escapeHtml(msg.message);
  
    let messageHTML = `
          ${
            !isCurrentUser
              ? `<div class="username">${escapeHtml(msg.username)}</div>`
              : ""
          }
          <div class="text">
              ${messageContent}
          </div>
          <div class="time">${escapeHtml(msg.time)}</div>
          
      `;
  
    if (msg.reply) {
      const replyClass = isCurrentUser ? "reply-inner-right" : "reply-inner-left";
  
      let replyText = escapeHtml(msg.reply.message);
      const maxLength = 50;
      if (replyText.length > maxLength) {
        replyText = replyText.substring(0, maxLength) + "...";
      }
  
      messageHTML = `
              <div class="reply-inner ${replyClass}">
                  <div class="reply-username">${escapeHtml(
                    msg.reply.username
                  )}</div>
                  <div class="reply-text">${replyText}</div>
              </div>
              ${messageHTML}
          `;
    }
    
    messageElement.innerHTML = messageHTML;

    let effectiveMessageElement = document.createElement("div");
    effectiveMessageElement.className = "message-container";
    effectiveMessageElement.classList.add(isCurrentUser ? "right" : "left");
    effectiveMessageElement.id = "message-container";

    let replyButton = document.createElement("div");
    replyButton.className = "reply-button";
    replyButton.innerHTML = `
      <img src="${replyImgUrl}" alt="Reply" class="reply-image">
    `;

    replyButton.addEventListener("click", () => {
      replyMessageContent = {
        username: msg.username,
        message: isFile ? `File: ${msg.fileName}` : msg.message,
      };
      updateReplyPreview(replyMessageContent);
      document.getElementById("message").focus();
  });
  

    if (isCurrentUser) {
        effectiveMessageElement.appendChild(replyButton);
        effectiveMessageElement.appendChild(messageElement);
    } else {
        effectiveMessageElement.appendChild(messageElement);
        effectiveMessageElement.appendChild(replyButton);
    }
    
    effectiveMessageElement.addEventListener("dblclick", () => {
      replyMessageContent = {
        username: msg.username,
        message: isFile ? `File: ${msg.fileName}` : msg.message,
      };
      updateReplyPreview(replyMessageContent);
      document.getElementById("message").focus();
    });
  
    messages.appendChild(effectiveMessageElement);
    messages.scrollTop = messages.scrollHeight;
  }
  

function updateReplyPreview(reply) {
  const replyPreview = document.getElementById("reply-preview");
  if (reply) {
    let truncatedMessage = reply.message;
    const maxLength = 50;

    if (truncatedMessage.length > maxLength) {
      truncatedMessage = truncatedMessage.substring(0, maxLength) + "...";
    }

    replyPreview.innerHTML = `
            <span id="cancel-reply">&times; <span style="marging-top:-5px;color:cyan;">Replying to ${escapeHtml(reply.username)}</span> </span>
            <br><br>
            <span style="margin-left:25px">${escapeHtml(truncatedMessage)}</span>
        `;
    replyPreview.style.display = "block";

    document.getElementById("cancel-reply").addEventListener("click", () => {
      replyMessageContent = null;
      updateReplyPreview(null);
    });
  } else {
    replyPreview.style.display = "none";
  }
}

document.getElementById("message").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("send").click();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.keyCode == 9) {
    document.getElementById("menu-bars").click();
  }
  if(e.key === "Escape"){
    document.getElementById("closebtn").click();
  }
});

document.getElementById("menu-bars").onclick = function () {
    document.getElementById("menu").style.width = "250px";
    document.getElementById("menu").classList.add("open");
    document.getElementById("chat-input").classList.add("open");
    document.getElementById("messages").classList.add("open");
    document.getElementById("reply-preview").classList.add("open");
};

document.getElementById("closebtn").onclick = function () {
    document.getElementById("menu").style.width = "0";
    document.getElementById("menu").classList.remove("open");
    document.getElementById("chat-input").classList.remove("open");
    document.getElementById("messages").classList.remove("open");
    document.getElementById("reply-preview").classList.remove("open");
};

window.addEventListener("resize", () => {
    if (document.getElementById("menu").classList.contains("open")) {
        document.getElementById("chat-input").classList.add("open");
        document.getElementById("messages").classList.add("open");
        document.getElementById("reply-preview").classList.add("open");
    } else {
        document.getElementById("chat-input").classList.remove("open");
        document.getElementById("messages").classList.remove("open");
        document.getElementById("reply-preview").classList.remove("open"); 
    }

    
});


document.getElementById("file-input").addEventListener("change", () => {
    const file = document.getElementById("file-input").files[0];
    if (file) {
      document.getElementById("file-name").textContent = file.name;
      document.getElementById("file-info").style.display = "block";
      if (window.innerWidth < 600) {
        document.getElementById("file-info").style.overflow = "hidden";
        document.getElementById("file-info").style.maxHeight = "30px";
        document.getElementById("file-info").style.maxWidth = "50px";
        if(window.innerWidth < 400){
            document.getElementById("file-name").textContent = "";
        }
      }
      else{
        document.getElementById("file-info").style.maxHeight = "none";
        document.getElementById("file-info").style.maxWidth = "none";
      }
      
    } else {
      document.getElementById("file-name").textContent = "";
      document.getElementById("file-info").style.display = "none";
    }
  });
  

document.getElementById("remove-file").addEventListener("click", () => {
  document.getElementById("file-input").value = "";
  document.getElementById("file-name").textContent = "";
  document.getElementById("file-info").style.display = "none";
});


document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("menu-bars").click();
});
  
document.getElementById("light-mode").addEventListener("click", ()=>{
  if(document.getElementById("light-mode").checked){
    document.getElementById("chat-header").style.background = "#8bb984";
    document.getElementById("menu").style.background = "#419fd9";
    document.getElementById("messages").style.background = "white";
    document.getElementById("username").style.background = "white";
    document.getElementById("username").style.color = "black";
    document.getElementById("username").style.border = "2px solid black";
    document.getElementById("message").style.background= "white";
    document.getElementById("message").style.color= "black";
    document.getElementById("chat-input").style.background = "#8bb984";
    document.getElementById("send").style.background = "#8bb984";
  }
  else{
    document.getElementById("chat-header").style.background = "#4d4d4d";
    document.getElementById("menu").style.background = "#161616";
    document.getElementById("messages").style.background  = "#272727";
    document.getElementById("username").style.background = "#272727";
    document.getElementById("username").style.color = "cyan";
    document.getElementById("username").style.border = "2px solid white";
    document.getElementById("message").style.background= "#272727";
    document.getElementById("message").style.color= "white";
    document.getElementById("chat-input").style.background = "#4d4d4d";
    document.getElementById("send").style.background = "#4d4d4d";
  }
});

document.addEventListener("click", (event) => {
  const menu = document.getElementById("menu");
  const menuBars = document.getElementById("menu-bars");
  const input = document.getElementById("chat-input");
  const isClickInsideInput = input.contains(event.target);
  const isClickInsideMenu = menu.contains(event.target);
  const isClickOnMenuBars = menuBars.contains(event.target);

  if (!isClickInsideMenu && !isClickOnMenuBars && !isClickInsideInput && menu.classList.contains("open")) {
      menu.style.width = "0";
      menu.classList.remove("open");
      document.getElementById("chat-input").classList.remove("open");
      document.getElementById("messages").classList.remove("open");
      document.getElementById("reply-preview").classList.remove("open");
  }
});