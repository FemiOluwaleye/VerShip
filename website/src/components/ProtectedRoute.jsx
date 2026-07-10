import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    const is_login = localStorage.getItem('is_login');
    console.log(token, "token", is_login, "is_login");
    if (!is_login) {
        console.log("Please login first");
        return <Navigate to="/login" replace state={{ message: "Please login first" }} />;
    }
    // if (!is_login) {
    //     return <Navigate to="/" replace state={{ message: "Please login first" }} />;
    // }
    return children;
};

export default ProtectedRoute;
