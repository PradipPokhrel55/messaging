import { useRef, useEffect, useState } from 'react';
import { startCall, endCall, initSignaling, cleanup } from './webrtc';

export default function VideoCall({ roomId, userId, remoteUserId }) {
    const localVideo = useRef();
    const remoteVideo = useRef();
    const [callActive, setCallActive] = useState(false);

    useEffect(() => {
        // Initialize signaling when component mounts
        if (roomId && userId) {
            initSignaling(roomId, userId);
        }

        // Cleanup on unmount
        return () => {
            cleanup();
        };
    }, [roomId, userId]);

    const handleStartCall = async () => {
        if (!remoteUserId) {
            alert('No remote user selected');
            return;
        }
        try {
            await startCall(localVideo.current, remoteVideo.current, remoteUserId);
            setCallActive(true);
        } catch (error) {
            console.error('Error starting call:', error);
        }
    };

    const handleEndCall = () => {
        endCall();
        setCallActive(false);
    };

    return(
        <div style={{ padding: '20px' }}>
            <h2>Video Call</h2>
            <div style={{ display: 'flex', gap: '20px' }}>
                <div>
                    <h3>Local Video</h3>
                    <video 
                        ref={localVideo} 
                        autoPlay 
                        muted 
                        style={{ width: '300px', backgroundColor: '#000' }} 
                    />
                </div>
                <div>
                    <h3>Remote Video</h3>
                    <video 
                        ref={remoteVideo} 
                        autoPlay 
                        style={{ width: '300px', backgroundColor: '#000' }} 
                    />
                </div>
            </div>
            <div style={{ marginTop: '20px' }}>
                <button 
                    onClick={handleStartCall}
                    disabled={callActive}
                    style={{ padding: '10px 20px', marginRight: '10px' }}
                >
                    Start Call
                </button>
                <button 
                    onClick={handleEndCall}
                    disabled={!callActive}
                    style={{ padding: '10px 20px' }}
                >
                    End Call
                </button>
            </div>
        </div>
    );
}