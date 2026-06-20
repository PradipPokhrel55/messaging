import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

import Back from '../assets/back.svg';
import axios from 'axios';

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const Chat = () => {
    const { user, authTokens } = useContext(AuthContext);

    const { name, password } = useParams();

    const navigateTo = useNavigate();

    const [messages, setMessages] = useState([]);
    const messagesRef = useRef(messages);
    const [initialized, setInitialized] = useState(false);
    const [hasMoreOlder, setHasMoreOlder] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);

    const [isCalling, setIsCalling] = useState(false);
    const [isCaller, setIsCaller] = useState(false);

    const [incomingOffer, setIncomingOffer] = useState(null);

    const [callStatus, setCallStatus] = useState('idle');

    const [callError, setCallError] = useState('');

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const pcRef = useRef(null);

    const pollingRef = useRef(null);
    const localStreamRef = useRef(null)

    const messagesContainerRef = useRef(null);
    const initialLoadRef = useRef(true);
    const [autoScroll, setAutoScroll] = useState(true);

    const handleScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        // consider user at bottom if within 100px
        const isAtBottom = distanceFromBottom <= 100;
        setAutoScroll(isAtBottom);
        // if user scrolls near the top, load older messages
        if (el.scrollTop <= 120 && hasMoreOlder && !isLoadingOlder) {
            loadOlderMessages();
        }
    };

    const PAGE_SIZE = 50;

    const fetchLatestMessages = async () => {
        try {
            const resp = await fetch(`${API_BASE_URL}/room/${name}/${password}/?limit=${PAGE_SIZE}`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${authTokens?.access}` },
            });
            if (!resp.ok) return;
            const data = await resp.json();
            setMessages(data);
            messagesRef.current = data;
            // jump to bottom instantly before revealing UI to avoid visible scroll animation
            requestAnimationFrame(() => {
                const el = messagesContainerRef.current;
                if (el) {
                    el.scrollTop = el.scrollHeight;
                    // force layout/paint
                    void el.offsetHeight;
                }
                initialLoadRef.current = false;
                // small delay to ensure browser painted the scrolled position
                setTimeout(() => setInitialized(true), 20);
            });

            setHasMoreOlder(data.length === PAGE_SIZE);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchNewMessages = async (afterId) => {
        if (!afterId) return [];
        try {
            const resp = await fetch(`${API_BASE_URL}/room/${name}/${password}/?after=${afterId}`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${authTokens?.access}` },
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            return data;
        } catch (err) {
            console.error(err);
            return [];
        }
    };

    const loadOlderMessages = async () => {
        if (isLoadingOlder || !hasMoreOlder) return;
        const el = messagesContainerRef.current;
        if (!el) return;

        setIsLoadingOlder(true);

        const oldestId = messages[0]?.id;
        try {
            const prevScrollHeight = el.scrollHeight;
            const prevScrollTop = el.scrollTop;

            const resp = await fetch(`${API_BASE_URL}/room/${name}/${password}/?before=${oldestId}&limit=${PAGE_SIZE}`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${authTokens?.access}` },
            });
            if (!resp.ok) {
                setIsLoadingOlder(false);
                return;
            }
            const data = await resp.json();
            if (!data.length) {
                setHasMoreOlder(false);
                setIsLoadingOlder(false);
                return;
            }

            setMessages((prev) => {
                const next = [...data, ...prev];
                messagesRef.current = next;
                return next;
            });

            // preserve scroll position after prepending
            requestAnimationFrame(() => {
                const newScrollHeight = el.scrollHeight;
                el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
            });

            setHasMoreOlder(data.length === PAGE_SIZE);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingOlder(false);
        }
    };

    const appendNewMessages = (newMsgs) => {
        if (!newMsgs || !newMsgs.length) return;
        const el = messagesContainerRef.current;
        const prevScrollHeight = el?.scrollHeight || 0;
        const prevScrollTop = el?.scrollTop || 0;

        setMessages((prev) => {
            const next = [...prev, ...newMsgs];
            messagesRef.current = next;
            return next;
        });

        requestAnimationFrame(() => {
            const newScrollHeight = el?.scrollHeight || 0;
            if (!el) return;
            if (autoScroll) {
                el.scrollTo({ top: newScrollHeight, behavior: 'smooth' });
            } else {
                // preserve user's viewport position
                el.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
            }
        });
    };

    useEffect(() => {
        if (!autoScroll) return;
        const el = messagesContainerRef.current;
        if (!el) return;
        if (initialLoadRef.current) {
            // Jump to bottom instantly on first load to avoid visible scroll animation
            el.scrollTo({ top: el.scrollHeight });
            initialLoadRef.current = false;
        } else {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    // FETCH MESSAGES (paginated)

    useEffect(() => {
        if (!authTokens?.access) {
            navigateTo('/login');
            return;
        }

        let mounted = true;

        // load latest messages once
        (async () => {
            await fetchLatestMessages();
        })();

        // polling for new messages
        pollingRef.current = setInterval(async () => {
            if (!mounted) return;
            const lastId = messagesRef.current[messagesRef.current.length - 1]?.id;
            if (!lastId) return;
            const newMsgs = await fetchNewMessages(lastId);
            if (newMsgs?.length) {
                appendNewMessages(newMsgs);
            }
        }, 1000);

        return () => {
            mounted = false;
            if (pollingRef.current) clearInterval(pollingRef.current);
        };

    }, [name, password, authTokens, navigateTo]);

    // CHECK INCOMING CALL

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

                if (
                    data.offer &&
                    data.caller !== user.username
                ) {
                    setIncomingOffer(data);
                }

            } catch (error) {
                console.error(error);
            }
        };

        checkIncomingOffer();

        const interval = setInterval(checkIncomingOffer, 2000);

        return () => clearInterval(interval);

    }, [
        authTokens,
        isCalling,
        name,
        password,
        user.username,
    ]);

    // POLL ICE CANDIDATES

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

    }, [isCalling]);

    // CHECK ANSWER

    useEffect(() => {
        if (
            !isCalling ||
            !isCaller ||
            !authTokens?.access ||
            !pcRef.current
        )
            return;

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

                if (!response.ok) return;

                const data = await response.json();

                if (data.answer?.sdp) {
                    await pcRef.current.setRemoteDescription(
                        new RTCSessionDescription(data.answer)
                    );

                    setCallStatus('in-call');
                }

            } catch (error) {
                console.error(error);
            }
        };

        checkForAnswer();

        const interval = setInterval(checkForAnswer, 2000);

        return () => clearInterval(interval);

    }, [
        isCalling,
        isCaller,
        authTokens,
        name,
        password,
    ]);

    // CREATE PEER CONNECTION

    const createPeerConnection = async () => {

        setCallError('');

        const pc = new RTCPeerConnection({
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com:19302',
                },
            ],
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
                            body: JSON.stringify({
                                candidate: event.candidate.toJSON(),
                            }),
                        }
                    );

                } catch (error) {
                    console.error(error);
                }
            }
        };

        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject =
                    event.streams[0];
            }
        };

        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
        localStreamRef.current = stream;

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        pcRef.current = pc;

        return pc;
    };

    // CLEANUP CALL

    const cleanupCall = async () => {

        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        if (localStreamRef.current) {

            localStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());

            localStreamRef.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            if (remoteVideoRef.current.srcObject) {
                remoteVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
            }
            remoteVideoRef.current = null;
        }

        setIsCalling(false);

        setIsCaller(false);

        setIncomingOffer(null);

        setCallStatus('idle');
    };

    // POLL REMOTE ICE

    const pollRemoteCandidates = async () => {

        if (!pcRef.current || !authTokens?.access) return;

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

            if (!response.ok) return;

            const data = await response.json();

            data.candidates?.forEach(async ({ candidate }) => {
                try {
                    await pcRef.current.addIceCandidate(
                        new RTCIceCandidate(candidate)
                    );

                } catch (error) {
                    console.error(error);
                }
            });

        } catch (error) {
            console.error(error);
        }
    };

    // START CALL

    const startCall = async () => {

        try {

            const pc = await createPeerConnection();

            const offer = await pc.createOffer();

            await pc.setLocalDescription(offer);

            await fetch(
                `${API_BASE_URL}/room/${name}/${password}/call/offer/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authTokens.access}`,
                    },
                    body: JSON.stringify({
                        offer: {
                            type: offer.type,
                            sdp: offer.sdp,
                        },
                    }),
                }
            );

            setIsCalling(true);

            setIsCaller(true);

            setCallStatus('calling');

        } catch (error) {
            console.error(error);

            setCallError('Unable to start call.');
        }
    };

    // JOIN CALL

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
                setCallError('No incoming call.');
                return;
            }

            const data = await response.json();

            const pc = await createPeerConnection();

            await pc.setRemoteDescription(
                new RTCSessionDescription(data.offer)
            );

            const answer = await pc.createAnswer();

            await pc.setLocalDescription(answer);

            await fetch(
                `${API_BASE_URL}/room/${name}/${password}/call/answer/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authTokens.access}`,
                    },
                    body: JSON.stringify({
                        answer: {
                            type: answer.type,
                            sdp: answer.sdp,
                        },
                    }),
                }
            );

            setIsCalling(true);

            setIsCaller(false);

            setCallStatus('in-call');

            setIncomingOffer(null);

        } catch (error) {
            console.error(error);

            setCallError('Unable to join call.');
        }
    };

    // HANGUP

    const hangUp = async () => {

        try {

            await fetch(
                `${API_BASE_URL}/room/${name}/${password}/call/hangup/`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authTokens.access}`,
                    },
                }
            );

        } catch (error) {
            console.error(error);
        }

        await cleanupCall();
    };

    // SEND MESSAGE

    const Send = async (e) => {

        e.preventDefault();

        let data = new FormData();

        data.append('message', e.target.message.value);

        data.append('image', e.target.image.files[0]);

        await axios(`${API_BASE_URL}/room/${name}/${password}/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authTokens.access}`,
                'Content-Type': 'multipart/form-data',
            },
            data,
        });

        e.target.reset();
    };

    // DELETE MESSAGE

    const deleteMessage = async (id) => {

        const confirmed = window.confirm(
            'Delete this message?'
        );

        if (!confirmed) return;

        try {

            await fetch(
                `${API_BASE_URL}/message/delete/${id}/`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${authTokens.access}`,
                    },
                }
            );

            setMessages((prev) => {
                const next = prev.filter((msg) => msg.id !== id);
                messagesRef.current = next;
                return next;
            });

        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100 overflow-y-auto">

            {/* NAVBAR */}

            <nav className="flex items-center gap-3 px-4 py-3 bg-black shadow-md sticky top-0 z-50 flex-shrink-0">

                <Link
                    to="/"
                    className="hover:opacity-80 transition bg-white"
                >
                    <img
                        src={Back}
                        alt="Back"
                        width={28}
                        height={28}
                    
                    />
                </Link>

                <h2 className="text-lg md:text-xl font-semibold text-white truncate">
                    {name}
                </h2>

            </nav>
            {/* CALL CONTROLS */}

<div className="bg-white border-b border-gray-200 p-3 md:p-4 flex-shrink-0">

    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">

        <div>
            <h3 className="text-lg font-semibold text-gray-800">
                Video Call
            </h3>

            <p className="text-sm text-gray-600">

                {callStatus === 'idle' &&
                    'No active call'}

                {callStatus === 'calling' &&
                    'Calling...'}

                {callStatus === 'in-call' &&
                    'In call'}

            </p>
        </div>

        <div className="flex gap-2 flex-wrap">

            {!isCalling && !incomingOffer && (
                <button
                    onClick={startCall}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition"
                >
                    Start Call
                </button>
            )}

        </div>
    </div>

    {callError && (
        <p className="text-red-600 text-sm mt-2">
            {callError}
        </p>
    )}
</div>


{/* INCOMING CALL POPUP */}

{incomingOffer && !isCalling && (

    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4">

        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center animate-pulse">

            {/* CALLER INFO */}

            <div className="flex flex-col items-center">

                <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center text-white text-3xl font-bold mb-4">

                    {incomingOffer.caller?.charAt(0).toUpperCase()}

                </div>

                <h2 className="text-2xl font-bold text-gray-800">
                    Incoming Call
                </h2>

                <p className="text-gray-600 mt-2 mb-6">

                    {incomingOffer.caller} is calling you

                </p>
            </div>

            {/* ACTION BUTTONS */}

            <div className="flex justify-center gap-4">

                {/* DECLINE */}

                <button
                    onClick={() => setIncomingOffer(null)}
                    className="px-6 py-3 rounded-full bg-gray-300 hover:bg-gray-400 transition font-medium"
                >
                    Decline
                </button>

                {/* ACCEPT */}

                <button
                    onClick={joinCall}
                    className="px-6 py-3 rounded-full bg-green-600 text-white hover:bg-green-700 transition font-medium shadow-lg"
                >
                    Join Call
                </button>

            </div>
        </div>
    </div>
)}


{/* FULLSCREEN VIDEO CALL */}

{isCalling && (

    <div className="fixed inset-0 bg-black z-[100] flex flex-col">

        {/* TOP BAR */}

        <div className="flex items-center justify-between p-4 bg-black/70 backdrop-blur-sm">

            <div>

                <h3 className="text-white text-lg font-semibold">

                    {callStatus === 'calling'
                        ? 'Calling...'
                        : 'Video Call'}

                </h3>

                <p className="text-gray-300 text-sm">

                    {callStatus === 'calling'
                        ? 'Waiting for user to join'
                        : 'Connected'}

                </p>
            </div>

            {/* END CALL */}

            <button
                onClick={hangUp}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-full transition shadow-lg"
            >
                End
            </button>
        </div>


        {/* REMOTE VIDEO */}

        <div className="flex-1 relative overflow-hidden bg-black">

            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />


            {/* WAITING SCREEN */}

            {callStatus === 'calling' && (

                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">

                    <div className="w-24 h-24 rounded-full border-4 border-white border-t-transparent animate-spin mb-6" />

                    <h2 className="text-white text-2xl font-semibold">
                        Calling...
                    </h2>

                </div>
            )}


            {/* LOCAL VIDEO */}

            <div className="absolute bottom-4 right-4 w-32 h-48 md:w-48 md:h-64 rounded-2xl overflow-hidden border-2 border-white shadow-2xl bg-black">

                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                />
            </div>


            {/* MOBILE CONTROL BAR */}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl">

                {/* END */}

                <button
                    onClick={hangUp}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white text-xl transition shadow-xl"
                >

                    📞

                </button>

            </div>

        </div>
    </div>
)}
           
            {/* MESSAGES */}

            <div
                id="messagesContainer"
                ref={messagesContainerRef}
                onScroll={handleScroll}
                style={{ visibility: initialized ? 'visible' : 'hidden' }}
                className={`flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-gray-50 ${initialized ? 'scroll-smooth' : ''}`}
            >
                {messages.map((message) => (

                    <div
                        key={message.id}
                        className={`max-w-[85%] md:max-w-md p-3 rounded-2xl shadow-sm ${
                            user.username === message.user
                                ? 'bg-blue-100 ml-auto'
                                : 'bg-white'
                        }`}
                    >

                        <h3 className="font-semibold text-sm text-gray-600 mb-1">
                            {message.user}
                        </h3>

                        <p className="text-gray-800 break-words">
                            {message.message}
                        </p>

                        {message.image && (
                            <img
                                src={`${API_BASE_URL}${message.image}`}
                                alt="uploaded"
                                className="mt-2 rounded-xl w-full max-h-72 object-cover"
                            />
                        )}

                        {user.username === message.user && (
                            <button
                                onClick={() =>
                                    deleteMessage(message.id)
                                }
                                className="mt-2 text-xs text-red-600 hover:underline"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* INPUT */}

            <form
                onSubmit={Send}
                className="flex items-center gap-2 p-3 bg-white border-t border-gray-200 flex-shrink-0"
            >

                <input
                    type="text"
                    name="message"
                    placeholder="Type a message..."
                    required
                    className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                    type="file"
                    name="image"
                    accept="image/*"
                    className="text-sm w-24"
                />

                <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full font-medium transition"
                >
                    Send
                </button>

            </form>
        </div>
    );
};

export default Chat;
