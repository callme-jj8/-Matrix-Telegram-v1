const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs'); 
app.use(express.static(__dirname));

const SECRET_KEY = "matrix77";
const ADMIN_KEY = "neo123";
const BAN_FILE = './bannedUsers.json';
const HISTORY_FILE = './chatHistory.json';

let onlineUsers = 0;
let userMap = {}; 

// Resilience Layer: Load Bans
let bannedUsers = [];
if (fs.existsSync(BAN_FILE)) {
    try { bannedUsers = JSON.parse(fs.readFileSync(BAN_FILE, 'utf8')); } catch (e) { bannedUsers = []; }
}

// Resilience Layer: Load History
let chatHistory = [];
if (fs.existsSync(HISTORY_FILE)) {
    try { chatHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch (e) { chatHistory = []; }
}

const glyphs = {'A': 'α', 'B': 'β', 'C': 'γ', 'D': 'δ', 'E': 'ε', 'Z': 'ζ', 'H': 'η', 'Q': 'θ', 'I': 'ι', 'K': 'κ', 'L': 'λ', 'M': 'μ', 'N': 'ν', 'X': 'ξ', 'O': 'ο', 'P': 'π', 'R': 'ρ', 'S': 'σ', 'T': 'τ', 'U': 'υ', 'F': 'φ', 'C': 'χ', 'Y': 'ψ', 'W': 'ω'};

io.on('connection', (socket) => {
    onlineUsers++;
    
    socket.on('request history', (data) => {
        if(data.key === SECRET_KEY || data.key === ADMIN_KEY) {
            userMap[data.name] = socket.id; 
            // TELEMETRY: Monitor Identity Sync
            console.log(`SYNC: ${data.name} mapped to ID: ${socket.id}`);
            
            socket.emit('chat history load', chatHistory);
            socket.emit('chat message', { text: 'SYSTEM: Access Granted.', color: '#00ff41' });
        } else {
            socket.emit('chat message', { text: 'SYSTEM: Access Denied.', color: '#ff0000' });
        }
    });

    socket.on('chat message', (data) => {
        if(bannedUsers.includes(data.name)) {
            socket.emit('chat message', { text: 'SYSTEM: You are in Permanent Exile.', color: '#ff0000' });
            return;
        }

        userMap[data.name] = socket.id;

        if(data.text === "/who" && data.key === ADMIN_KEY) {
            socket.emit('chat message', { 
                text: `SYSTEM: Online: ${onlineUsers} | Blacklist: [${bannedUsers.join(", ")}]`, 
                color: '#ffff00' 
            });
            return;
        }

        if(data.text === "/clear" && data.key === ADMIN_KEY) {
            chatHistory = [];
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory));
            io.emit('chat message', { text: 'SYSTEM: History Purged by Admin.', color: '#ff0000' });
            return;
        }
        
        // NEW: Private Messaging Protocol
        if(data.text.startsWith("/msg ") && (data.key === SECRET_KEY || data.key === ADMIN_KEY)) {
            let parts = data.text.split(" ");
            let targetName = parts[1];
            let privateMsg = parts.slice(2).join(" ");
            let targetSocket = userMap[targetName];

            if(targetSocket) {
                let msgObject = { text: `[PRIVATE] From ${data.name}: ${privateMsg}`, color: '#00ccff' };
                // Send to Target
                io.to(targetSocket).emit('chat message', msgObject);
                // Send back to Sender for confirmation
                socket.emit('chat message', { text: `[PRIVATE] To ${targetName}: ${privateMsg}`, color: '#00ccff' });
            } else {
                socket.emit('chat message', { text: `SYSTEM: User ${targetName} not found or offline.`, color: '#ff0000' });
            }
            return;
        }



        if(data.text.startsWith("/ban ") && data.key === ADMIN_KEY) {
            let target = data.text.split(" ")[1]; // Fix: Target index 1
            if(target && !bannedUsers.includes(target)) {
                bannedUsers.push(target);
                fs.writeFileSync(BAN_FILE, JSON.stringify(bannedUsers));
                io.emit('chat message', { text: `SYSTEM: ${target} has been Exiled.`, color: '#ff0000' });
                
                if(userMap[target]) {
                    io.to(userMap[target]).emit('chat message', { text: 'SYSTEM: EXILE TERMINATED CONNECTION.', color: '#ff0000' });
                }
            }
            return;
        }

        if(data.key === SECRET_KEY || data.key === ADMIN_KEY) {
            let firstLetter = data.name.charAt(0).toUpperCase();
            let avatar = glyphs[firstLetter] || '⧉';
            let now = new Date();
            let time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
            let msgObject = { text: `[${time}] [${avatar}] ${data.name}: ${data.text}`, color: '#00ff41' };
            chatHistory.push(msgObject);
            if(chatHistory.length > 30) chatHistory.shift(); 
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory));
            io.emit('chat message', msgObject);
        }
    });
    
    socket.on('disconnect', () => { 
        onlineUsers--; 
        for(let name in userMap) {
            if(userMap[name] === socket.id) {
                console.log(`SYNC: ${name} disconnected. Purging Map.`);
                delete userMap[name];
            }
        }
    });
});

http.listen(3001, () => { console.log('DUAL-KEY ENGINE LIVE ON 3001'); });





