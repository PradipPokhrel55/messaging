import { createContext, useState, useEffect } from 'react'
import jwt_decode from "jwt-decode";
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext()

export default AuthContext;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const AuthProvider = ({children}) => {
    let [authTokens, setAuthTokens] = useState(() =>
        localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null
    );
    let [user, setUser] = useState(() =>
        localStorage.getItem('authTokens') ? jwt_decode(localStorage.getItem('authTokens')) : null
    );
    let [loading, setLoading] = useState(true);

    const navigateTo = useNavigate();

    let loginUser = async (e) => {
        e.preventDefault();
        let response = await fetch(`${API_BASE_URL}/api/token/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'username': e.target.username.value,
                'password': e.target.password.value
            })
        });
        let data = await response.json();

        if (response.status === 200) {
            setAuthTokens(data);
            setUser(jwt_decode(data.access));
            localStorage.setItem('authTokens', JSON.stringify(data));
            navigateTo('/');
        } else {
            console.log(response);
            alert('Something went wrong!');
        }
    };

    let logoutUser = () => {
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem('authTokens');
    };

    let updateToken = async () => {
        let response = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 'refresh': authTokens?.refresh })
        });

        let data = await response.json();

        if (response.status === 200) {
            setAuthTokens(data);
            setUser(jwt_decode(data.access));
            localStorage.setItem('authTokens', JSON.stringify(data));
        } else {
            logoutUser();
        }

        if (loading) {
            setLoading(false);
        }
    };

    let contextData = {
        user: user,
        authTokens: authTokens,
        loginUser: loginUser,
        logoutUser: logoutUser,
    };

    useEffect(() => {
        if (loading) {
            updateToken();
        }

        let fourMinutes = 1000 * 60 * 4;

        let interval = setInterval(() => {
            if (authTokens) {
                updateToken();
            }
        }, fourMinutes);
        return () => clearInterval(interval);

    }, [authTokens, loading]);

    return (
        <AuthContext.Provider value={contextData}>
            {loading ? null : children}
        </AuthContext.Provider>
    );
}
