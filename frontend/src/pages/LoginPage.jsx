import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import AuthContext from '../context/AuthContext'

const LoginPage = () => {
    let { loginUser } = useContext(AuthContext)

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 px-4">
            {/* Register Link */}
            <Link
                to="/register"
                className="absolute top-4 right-4 text-blue-600 hover:underline"
            >
                Register
            </Link>

            {/* Login Form Container */}
            <form
                onSubmit={loginUser}
                className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md space-y-4"
            >
                <h2 className="text-2xl font-bold text-center text-gray-800">Login</h2>

                <input
                    type="text"
                    name="username"
                    placeholder="Enter Username"
                    className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                />
                <input
                    type="password"
                    name="password"
                    placeholder="Enter Password"
                    className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                />

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
                >
                    Login
                </button>
            </form>
        </div>
    )
}

export default LoginPage

