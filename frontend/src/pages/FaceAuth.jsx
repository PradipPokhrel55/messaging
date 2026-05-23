import React, { useState, useRef, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const FaceAuth = () => {
    const navigateTo = useNavigate();
    const { loginWithTokens } = useContext(AuthContext);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [frames, setFrames] = useState([]);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState('enroll');

    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [stream]);

    const startCamera = async () => {
        setError('');
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setStream(mediaStream);
        } catch (err) {
            setError('Camera access denied or unavailable.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
    };

    const captureFrame = () => {
        if (!videoRef.current || !canvasRef.current) return null;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg');
    };

    const captureSamples = async () => {
        setError('');
        if (!stream) {
            await startCamera();
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const captured = [];
        for (let i = 0; i < 3; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            const frame = captureFrame();
            if (frame) captured.push(frame);
        }

        setFrames(captured);
        setStatus('frames_ready');
    };

    const submitFaceAuth = async () => {
        setError('');
        if (!username) {
            setError('Please enter a username.');
            return;
        }
        if (mode === 'enroll' && !password) {
            setError('Please enter a password for enrollment.');
            return;
        }
        if (frames.length < 2) {
            setError('Please capture at least two frames for liveness detection.');
            return;
        }

        const endpoint = mode === 'enroll' ? 'face/enroll/' : 'face/login/';
        const body = {
            username,
            frames,
        };
        if (mode === 'enroll') {
            body.password = password;
        }

        setStatus('sending');
        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.message || data.error || 'Face authentication failed.');
                setStatus('idle');
                return;
            }

            if (mode === 'login') {
                loginWithTokens(data);
            } else {
                setStatus('enrolled');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            setStatus('idle');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 px-4 py-8">
            <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-3xl overflow-hidden">
                <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/2 p-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Face Recognition Auth</h1>
                        <p className="text-sm text-gray-600 mb-6">
                            Use FaceNet + liveness detection to enroll or login with face.
                        </p>

                        <div className="flex gap-2 mb-6">
                            <button
                                type="button"
                                onClick={() => setMode('enroll')}
                                className={`px-4 py-2 rounded-full ${mode === 'enroll' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                            >
                                Enroll
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('login')}
                                className={`px-4 py-2 rounded-full ${mode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                            >
                                Login
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Username</label>
                                <input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            {mode === 'enroll' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={startCamera}
                                    className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700"
                                >
                                    Start Camera
                                </button>
                                <button
                                    type="button"
                                    onClick={captureSamples}
                                    className="w-full rounded-xl bg-green-600 px-4 py-3 text-white hover:bg-green-700"
                                >
                                    Capture Frames
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={submitFaceAuth}
                                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
                            >
                                {mode === 'enroll' ? 'Enroll Face' : 'Login with Face'}
                            </button>

                            {status === 'enrolled' && (
                                <div className="rounded-xl bg-green-100 p-4 text-green-800">
                                    Face enrollment successful. You can now login with face.
                                </div>
                            )}

                            {error && (
                                <div className="rounded-xl bg-red-100 p-4 text-red-800">{error}</div>
                            )}

                            <div className="text-sm text-gray-500">
                                Capture at least two frames with natural motion for liveness detection.
                            </div>

                            <div className="mt-4 text-sm text-gray-700">
                                <Link to="/login" className="text-blue-600 hover:underline">Back to password login</Link>
                                {' | '}
                                <Link to="/register" className="text-blue-600 hover:underline">Back to register</Link>
                            </div>
                        </div>
                    </div>
                    <div className="md:w-1/2 bg-gray-50 p-8 flex flex-col items-center justify-center">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full rounded-3xl bg-black object-cover"
                            style={{ minHeight: '320px' }}
                        />
                        <canvas ref={canvasRef} width={320} height={240} className="hidden" />
                        <div className="mt-4 text-sm text-gray-600">
                            {frames.length > 0 ? `${frames.length} frames captured` : 'No frames captured yet'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FaceAuth;
