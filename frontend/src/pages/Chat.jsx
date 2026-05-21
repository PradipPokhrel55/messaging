import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

import Back from '../assets/back.svg';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const Chat = () => {
    const { user, authTokens } = useContext(AuthContext);
    const { name, password } = useParams();
    const navigateTo = useNavigate();
    const [messages, setMessages] = useState([]);
    const [isCalling, setIsCalling] = useState(false);
    const [isCaller, setIsCaller] = useState(false);
    const [incomingOffer, setIncomingOffer] = useState(null);
    const [callStatus, setCallStatus] = useState('idle');
    const [callError, setCallError] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const pcRef = useRef(null);
    const pollingRef = useRef(null);

    useEffect(() => {
        if (!authTokens?.access) {
            navigateTo('/login');
            return;
        }

        const fetchData = async () => {
            await fetch(`${API_BASE_URL}/room/${name}/${password}/`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${authTokens.access}`,
                },
            })
                .then((response) => response.json())
                .then((data) => setMessages(data))
                .catch((err) => navigateTo('/'));
        };
        const timer = setInterval(() => {
            fetchData();
        }, 1000);
        fetchData();
        return () => clearInterval(timer);
    }, [name, password, authTokens, navigateTo]);

    useEffect(() => {
        if (!authTokens?.access || isCalling) return;

        const checkIncomingOffer = async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/room/${name}/${password}/call/offer/`,
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${authTokens.access}`,
                        },
                    }
                );
                if (!response.ok) {
                    setIncomingOffer(null);
                    return;
                }

                const data = await response.json();
                if (data.offer && data.caller !== user.username) {
                    setIncomingOffer(data);
                }
            } catch (error) {
                console.error('Incoming offer polling failed:', error);
            }
        };

        const interval = setInterval(checkIncomingOffer, 2000);
        checkIncomingOffer();
        return () => clearInterval(interval);
    }, [authTokens, isCalling, name, password, user.username]);

    useEffect(() => {
        if (!isCalling || !authTokens?.access) return;

        pollingRef.current = setInterval(() => {
            pollRemoteCandidates();
        }, 2000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [isCalling, authTokens, name, password]);

    useEffect(() => {
        if (!isCalling || !isCaller || !authTokens?.access || !pcRef.current) return;

        const checkForAnswer = async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/room/${name}/${password}/call/answer/`,
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${authTokens.access}`,
                        },
                    }
                );
                if (!response.ok) {
                    return;
                }
                const data = await response.json();
                if (data.answer?.sdp) {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    setCallStatus('in-call');
                }
            } catch (error) {
                console.error('Answer polling failed:', error);
            }
        };

        const interval = setInterval(checkForAnswer, 2000);
        checkForAnswer();
        return () => clearInterval(interval);
    }, [isCalling, isCaller, authTokens, name, password]);

    const createPeerConnection = async () => {
        setCallError('');
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    await fetch(
                        `${API_BASE_URL}/room/${name}/${password}/call/candidate/`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${authTokens.access}`,
                            },
                            body: JSON.stringify({ candidate: event.candidate.toJSON() }),
                        }
                    );
                } catch (error) {
                    console.error('Failed to send ICE candidate:', error);
                }
            }
        };

        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pcRef.current = pc;
        return pc;
    };

    const cleanupCall = async () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localVideoRef.current?.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current?.srcObject) {
            remoteVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
            remoteVideoRef.current.srcObject = null;
        }
        setIsCalling(false);
        setIsCaller(false);
        setIncomingOffer(null);
        setCallStatus('idle');
    };

    const pollRemoteCandidates = async () => {
        if (!pcRef.current || !authTokens?.access) {
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/room/${name}/${password}/call/candidate/`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${authTokens.access}`,
                    },
                }
            );
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            data.candidates?.forEach(async ({ candidate }) => {
                try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Failed to add ICE candidate:', error);
                }
            });
        } catch (error) {
            console.error('Candidate polling error:', error);
        }
    };

    const startCall = async () => {
        if (!authTokens?.access) {
            return;
        }

        try {
            const pc = await createPeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await fetch(`${API_BASE_URL}/room/${name}/${password}/call/offer/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authTokens.access}`,
                },
                body: JSON.stringify({ offer: { type: offer.type, sdp: offer.sdp } }),
            });

            setIsCalling(true);
            setIsCaller(true);
            setCallStatus('calling');
        } catch (error) {
            console.error('Start call failed:', error);
            setCallError('Unable to start video call.');
        }
    };

    const joinCall = async () => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/room/${name}/${password}/call/offer/`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${authTokens.access}`,
                    },
                }
            );
            if (!response.ok) {
                setCallError('No active incoming call found.');
                return;
            }

            const data = await response.json();
            if (!data.offer?.sdp) {
                setCallError('Invalid offer received.');
                return;
            }

            const pc = await createPeerConnection();
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await fetch(`${API_BASE_URL}/room/${name}/${password}/call/answer/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authTokens.access}`,
                },
                body: JSON.stringify({ answer: { type: answer.type, sdp: answer.sdp } }),
            });

            setIsCalling(true);
            setIsCaller(false);
            setCallStatus('in-call');
            setIncomingOffer(null);
        } catch (error) {
            console.error('Join call failed:', error);
            setCallError('Unable to join the video call.');
        }
    };

    const hangUp = async () => {
        try {
            if (authTokens?.access) {
                await fetch(`${API_BASE_URL}/room/${name}/${password}/call/hangup/`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authTokens.access}`,
                    },
                });
            }
        } catch (error) {
            console.error('Hang up failed:', error);
        }
        await cleanupCall();
    };

    const Send = async (e) => {
        e.preventDefault();
        let data = new FormData();
        data.append('message', e.target.message.value);
        data.append('image', e.target.image.files[0]);
        await axios(`${API_BASE_URL}/room/${name}/${password}/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authTokens?.access}`,
                'Content-Type': 'multipart/form-data',
            },
            data,
        });
        e.target.reset();
        let messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.scrollTo(0, 0);
    };

    const deleteMessage = async (id) => {
        const confirmed = window.confirm("Are you sure you want to delete this message?");
        if (!confirmed) return;

        try {
            await fetch(`${API_BASE_URL}/message/delete/${id}/`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${authTokens.access}`,
                },
            });
            setMessages((prev) => prev.filter((msg) => msg.id !== id));
        } catch (error) {
            console.error("Failed to delete message:", error);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-black-100">
            <nav className="flex items-center gap-4 px-4 py-3 bg-black shadow">
                <Link to="/" className="hover:opacity-75 bg-green-500 z-1">
                    <img src={Back} alt="Back" width={32} height={32} />
                </Link>
                <h2 className="text-xl font-semibold text-gray-800">{name}</h2>
            </nav>

            <div className="p-4 bg-white border-b border-gray-200">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Video Call</h3>
                        <p className="text-sm text-gray-600">
                            {callStatus === 'idle' && 'No active call.'}
                            {callStatus === 'calling' && 'Starting call...'}
                            {callStatus === 'in-call' && 'In a video call.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {!isCalling && (
                            <>
                                <button
                                    type="button"
                                    onClick={startCall}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    Start Call
                                </button>
                                {incomingOffer && (
                                    <button
                                        type="button"
                                        onClick={joinCall}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                    >
                                        Join Call
                                    </button>
                                )}
                            </>
                        )}
                        {isCalling && (
                            <button
                                type="button"
                                onClick={hangUp}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                                Hang Up
                            </button>
                        )}
                    </div>
                </div>
                {callError && (
                    <p className="mt-3 text-sm text-red-600">{callError}</p>
                )}
                {(isCalling || incomingOffer) && (
                    <div className="grid gap-4 mt-4 md:grid-cols-2">
                        <div className="rounded-lg bg-gray-100 p-3">
                            <h4 className="text-sm font-medium text-gray-700">Local video</h4>
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-64 rounded-lg bg-black"
                            />
                        </div>
                        <div className="rounded-lg bg-gray-100 p-3">
                            <h4 className="text-sm font-medium text-gray-700">Remote video</h4>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-64 rounded-lg bg-black"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div
                id="messagesContainer"
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
            >
                {messages &&
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`max-w-md p-4 rounded-lg shadow ${
                                user.username === message.user
                                    ? 'bg-blue-100 ml-auto'
                                    : 'bg-gray-200'
                            }`}
                        >
                            <h3 className="font-bold text-sm text-gray-600">
                                {message.user}
                            </h3>
                            <p className="text-gray-800 break-words">{message.message}</p>
                            {message.image && (
                                <img
                                    src={`${API_BASE_URL}${message.image}`}
                                    alt="uploaded"
                                    className="mt-2 rounded-lg w-auto h-32 object-cover"
                                    loading="lazy"
                                />
                            )}
                            {user.username === message.user && (
                                <button
                                    onClick={() => deleteMessage(message.id)}
                                    className="mt-2 text-xs text-red-600 hover:underline"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    ))}
            </div>

            <form
                className="flex items-center gap-2 p-4 bg-white shadow"
                onSubmit={Send}
            >
                <input
                    type="text"
                    name="message"
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
                <input
                    type="file"
                    name="image"
                    className="text-sm"
                    accept="image/*"
                />
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
                >
                    Send
                </button>
            </form>
        </div>
    );
};

export default Chat;
