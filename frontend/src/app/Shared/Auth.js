"use client"
import React, { useState } from 'react'
import LoginForm from '../Components/Login'
import SignUpForm from '../Components/Signup'

const Auth = () => {
    
    const [isLogin, setIsLogin] = useState(true);

  return (
    <>
    {isLogin ? (
      <LoginForm onSwitch={() => setIsLogin(false)} />
    ) : (
      <SignUpForm onSwitch={() => setIsLogin(true)} />
    )}
    </>
  )
}

export default Auth
