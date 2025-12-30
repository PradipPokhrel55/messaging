let peerConnection = null;
let localStream = null;
let signalingSocket = null;
let remoteUserId = null;

// STUN servers for NAT traversal
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// Initialize WebSocket signaling
export function initSignaling(roomId, userId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}/ws/signal/${roomId}/`;
    
    signalingSocket = new WebSocket(socketUrl);
    
    signalingSocket.onopen = () => {
        console.log('Signaling connected');
    };
    
    signalingSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'offer') {
            remoteUserId = message.from;
            await handleOffer(message.offer);
        } else if (message.type === 'answer') {
            await handleAnswer(message.answer);
        } else if (message.type === 'ice') {
            await handleIceCandidate(message.candidate);
        }
    };
    
    signalingSocket.onerror = (error) => {
        console.error('Signaling error:', error);
    };
    
    signalingSocket.onclose = () => {
        console.log('Signaling disconnected');
    };
}

// Start a call
export async function startCall(localVideoElement, remoteVideoElement, remoteUserId) {
    try {
        // Get local media
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true
        });
        
        // Display local video
        if (localVideoElement) {
            localVideoElement.srcObject = localStream;
        }
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(iceServers);
        
        // Add local tracks to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event.track.kind);
            if (remoteVideoElement) {
                remoteVideoElement.srcObject = event.streams[0];
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignalingMessage({
                    type: 'ice',
                    candidate: event.candidate,
                    to: remoteUserId
                });
            }
        };
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        sendSignalingMessage({
            type: 'offer',
            offer: offer,
            to: remoteUserId
        });
        
        console.log('Offer sent');
    } catch (error) {
        console.error('Error starting call:', error);
        alert('Could not access camera/microphone: ' + error.message);
    }
}

// Handle incoming offer
async function handleOffer(offer) {
    try {
        if (!peerConnection) {
            peerConnection = new RTCPeerConnection(iceServers);
            
            // Get local media if not already obtained
            if (!localStream) {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720 },
                    audio: true
                });
            }
            
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            peerConnection.ontrack = (event) => {
                console.log('Remote track received:', event.track.kind);
            };
            
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignalingMessage({
                        type: 'ice',
                        candidate: event.candidate,
                        to: remoteUserId
                    });
                }
            };
        }
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        sendSignalingMessage({
            type: 'answer',
            answer: answer,
            to: remoteUserId
        });
        
        console.log('Answer sent');
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle incoming answer
async function handleAnswer(answer) {
    try {
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Remote description set');
        }
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

// Handle ICE candidate
async function handleIceCandidate(candidate) {
    try {
        if (peerConnection && candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
}

// Send signaling message via WebSocket
function sendSignalingMessage(message) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify(message));
    } else {
        console.error('Signaling socket not connected');
    }
}

// End call
export function endCall() {
    // Stop local tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    localStream = null;
    remoteUserId = null;
    
    // Notify remote peer
    if (signalingSocket) {
        sendSignalingMessage({
            type: 'end-call',
            to: remoteUserId
        });
    }
    
    console.log('Call ended');
}

// Cleanup on page unload
export function cleanup() {
    endCall();
    if (signalingSocket) {
        signalingSocket.close();
    }
}
