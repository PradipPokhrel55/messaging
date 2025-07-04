import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

import Back from '../assets/back.svg';
import axios from 'axios';

const Chat = () => {
    const { user, authTokens } = useContext(AuthContext);
    const { name, password } = useParams();
    const navigateTo = useNavigate();
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            await fetch(`http://localhost:8000/room/${name}/${password}/`, {
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
    }, [name, password, authTokens.access, navigateTo]);

    const Send = async (e) => {
        e.preventDefault();
        let data = new FormData();
        data.append('message', e.target.message.value);
        data.append('image', e.target.image.files[0]);
        await axios(`http://localhost:8000/room/${name}/${password}/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authTokens.access}`,
                'Content-Type': 'multipart/form-data',
            },
            data: data,
        });
        e.target.reset();
        let messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.scrollTo(0, 0);
    };

    const deleteMessage = async (id) => {
        const confirmed = window.confirm("Are you sure you want to delete this message?");
        if (!confirmed) return;

        try {
            await fetch(`http://localhost:8000/message/delete/${id}/`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${authTokens.access}`,
                },
            });
            // Remove the message from the current list
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
                                    src={`http://localhost:8000${message.image}`}
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
