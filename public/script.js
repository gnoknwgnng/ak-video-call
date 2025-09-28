// DOM Elements
const landingPage = document.getElementById('landing-page');
const waitingPage = document.getElementById('waiting-page');
const callPage = document.getElementById('call-page');
const maleBtn = document.getElementById('male-btn');
const femaleBtn = document.getElementById('female-btn');
const otherBtn = document.getElementById('other-btn');
const cancelBtn = document.getElementById('cancel-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const soundToggleBtn = document.getElementById('sound-toggle');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const timerElement = document.getElementById('timer');
const waitingMessage = document.getElementById('waiting-message');

// Variables
let socket;
let localStream;
let remoteStream;
let peerConnection;
let userGender;
let timerInterval;
let seconds = 0;

// Configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Initialize Socket Connection
function initSocket() {
    // For Vercel deployment, connect to the same host
    const backendUrl = window.location.origin;
    socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        withCredentials: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('connect_error', (error) => {
        console.log('Connection error:', error);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
    });
    
    socket.on('matched', (data) => {
        console.log('Matched with partner:', data);
        soundManager.play('matched');
        startCall();
    });
    
    socket.on('offer', async (offer) => {
        try {
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.emit('answer', peerConnection.localDescription);
            }
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    });
    
    socket.on('answer', async (answer) => {
        try {
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    });
    
    socket.on('ice-candidate', async (candidate) => {
        try {
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    });
    
    socket.on('chat-message', (data) => {
        addMessageToChat(data.message, 'received');
        soundManager.play('notification');
    });
    
    socket.on('partner-disconnected', () => {
        soundManager.play('disconnected');
        alert('Your partner has disconnected');
        endCall();
        showWaitingPage();
    });
}

// Gender Selection
maleBtn.addEventListener('click', () => {
    userGender = 'male';
    joinQueue();
});

femaleBtn.addEventListener('click', () => {
    userGender = 'female';
    joinQueue();
});

otherBtn.addEventListener('click', () => {
    userGender = 'other';
    joinQueue();
});

// Join Queue
function joinQueue() {
    initSocket();
    socket.emit('join', { gender: userGender });
    showWaitingPage();
}

// Show Waiting Page
function showWaitingPage() {
    landingPage.classList.remove('active');
    callPage.classList.remove('active');
    waitingPage.classList.add('active');
    
    // Add dynamic waiting messages
    const waitingMessages = [
        'Searching for someone special...',
        'Finding the perfect match for you...',
        'Connecting you with interesting people...',
        'Almost there! Just a moment...',
        'Scanning the galaxy for your match...'
    ];
    
    let messageIndex = 0;
    waitingMessage.textContent = waitingMessages[messageIndex];
    
    const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % waitingMessages.length;
        waitingMessage.textContent = waitingMessages[messageIndex];
    }, 3000);
    
    // Store interval ID to clear later
    waitingPage.messageInterval = messageInterval;
}

// Cancel Waiting
cancelBtn.addEventListener('click', () => {
    socket.disconnect();
    
    // Clear waiting message interval
    if (waitingPage.messageInterval) {
        clearInterval(waitingPage.messageInterval);
    }
    
    waitingPage.classList.remove('active');
    landingPage.classList.add('active');
});

// Start Call
async function startCall() {
    waitingPage.classList.remove('active');
    callPage.classList.add('active');
    
    // Start timer
    startTimer();
    
    try {
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        localVideo.srcObject = localStream;
        
        // Create peer connection
        createPeerConnection();
        
        // Create offer if initiator
        if (userGender === 'male' || (userGender === 'other' && Math.random() > 0.5)) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', peerConnection.localDescription);
        }
    } catch (error) {
        console.error('Error starting call:', error);
        alert('Error accessing camera/microphone. Please check permissions.');
    }
}

// Create Peer Connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        remoteStream = event.streams[0];
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed') {
            console.log('Peer connection closed');
        }
    };
}

// End Call
function endCall() {
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Stop remote stream
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Stop timer
    stopTimer();
    
    // Clear chat
    chatMessages.innerHTML = '';
    
    // Add a fun animation effect
    callPage.style.animation = 'fadeOut 0.5s forwards';
    setTimeout(() => {
        callPage.style.animation = '';
    }, 500);
}

// Disconnect Button
disconnectBtn.addEventListener('click', () => {
    socket.emit('disconnect-call');
    endCall();
    showWaitingPage();
});

// Chat Functionality
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat-message', { message });
        addMessageToChat(message, 'sent');
        messageInput.value = '';
        soundManager.play('notification');
    }
}

function addMessageToChat(message, type) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Timer Functions
function startTimer() {
    seconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        seconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Sound toggle functionality
soundToggleBtn.addEventListener('click', () => {
    soundManager.toggle();
    soundToggleBtn.textContent = soundManager.enabled ? '🔊 Sound On' : '🔇 Sound Off';
    soundToggleBtn.classList.toggle('btn-secondary', soundManager.enabled);
    soundToggleBtn.classList.toggle('btn-danger', !soundManager.enabled);
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    landingPage.classList.add('active');
});