'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import LoginForm from '../../components/auth/LoginForm';
import SignupForm from '../../components/auth/SignupForm';

const AuthPage: React.FC = () => {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);

  // --- Login Handler (Adapted from old login page) ---
  const handleLogin = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!supabaseError) {
        router.push('/'); // Redirect to home on successful login
        router.refresh();
        return { error: null };
      }
      return { error: supabaseError.message };
    } catch (error) {
      console.error('Login failed:', error);
      if (error instanceof Error) {
        return { error: error.message };
      }
      return { error: 'An unexpected client-side error occurred.' };
    }
  };

  // --- Signup Handler (Adapted from old signup page) ---
  const handleSignup = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      // Call Supabase signUp
      const { error } = await supabase.auth.signUp({
        email,
        password,
        // Optional: Add options like redirect URL if needed
        // options: {
        //   emailRedirectTo: `${window.location.origin}/`,
        // },
      });

      // Return only the error message. SignupForm handles the success message.
      return { error: error?.message ?? null };

    } catch (error: unknown) {
      console.error('Signup failed:', error);
      if (error instanceof Error) {
        return { error: error.message };
      }
      return { error: 'An unexpected error occurred.' };
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-semibold mb-6 text-center">
          {isLoginMode ? 'Login' : 'Sign Up'}
        </h2>

        {isLoginMode ? (
          <LoginForm onLogin={handleLogin} />
        ) : (
          <SignupForm onSignup={handleSignup} />
        )}

        <div className="mt-6 text-center">
          {isLoginMode ? (
            <p className="text-sm text-gray-600">
              Need an account?{' '}
              <button
                onClick={() => setIsLoginMode(false)}
                className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline transition ease-in-out duration-150"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => setIsLoginMode(true)}
                className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline transition ease-in-out duration-150"
              >
                Log In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
