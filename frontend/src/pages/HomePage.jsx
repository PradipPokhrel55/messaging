import React, { useState, useEffect, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const HomePage = () => {
    const { user, authTokens, logoutUser } = useContext(AuthContext);
    const navigateTo = useNavigate();

    const enterRoom = (e) => {
        e.preventDefault();
        navigateTo(`/${e.target.room.value}/${e.target.enterPassword.value}`);
    };

    const CreateRoom = async (e) => {
        e.preventDefault();
        await fetch(`${API_BASE_URL}/room/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authTokens.access}`,
            },
            body: JSON.stringify({
                name: e.target.name.value,
                password: e.target.password.value,
            }),
        })
            .then((response) => response.json())
            .then((data) => {
                data.status === 200
                    ? navigateTo(`/${e.target.name.value}/${e.target.password.value}`)
                    : alert('This room already exists');
            });
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
            <div className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.username}</h2>
                    <button
                        onClick={logoutUser}
                        className="text-red-600 font-semibold hover:underline"
                    >
                        Logout
                    </button>
                </div>

                <form onSubmit={enterRoom} className="space-y-4 mb-8">
                    <label htmlFor="room" className="block text-sm font-medium text-gray-700">
                        Enter Room Name
                    </label>
                    <input
                        type="text"
                        name="room"
                        placeholder="Room name..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                    <input
                        type="password"
                        name="enterPassword"
                        placeholder="Room Password..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200"
                    >
                        Enter Room
                    </button>
                </form>

                <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Or create a new room</h3>
                    <form onSubmit={CreateRoom} className="space-y-4">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Room Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            placeholder="Room Name..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        <input
                            type="password"
                            name="password"
                            placeholder="Room Password..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-red-400 text-black-50 py-2 rounded-lg hover:bg-red-700 transition duration-200"
                        >
                            Create Room
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
