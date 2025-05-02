'use client';

import { useState, useEffect } from 'react';
import { FaTrash, FaCheck } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import LogoutButton from '@/components/auth/LogoutButton';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'; // Import RealtimeChannel

type Todo = {
  id: number;
  text: string;
  completed: boolean;
  user_id: string;
};


export default function TodoApp() {
  const { user, loading } = useAuth(); // Keep these
  const router = useRouter();
  // const [isLoading, setIsLoading] = useState(true); // Remove this - use 'loading' from useAuth
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    console.log('EFFECT: Todos state changed:', todos);
  }, [todos]);

  const fetchTodos = async () => {
    // Make sure user exists before fetching
    if (!user) {
      console.log("fetchTodos called without user, returning.");
      setTodos([]); // Ensure todos are empty if no user
      return;
    }
    console.log(`Fetching todos for user: ${user.id}`);
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id) // Filter by user ID
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching todos:', error);
        // Potentially handle specific errors, e.g., RLS violation (though less likely on SELECT with .eq)
        return;
      }
      console.log("Fetched data:", data);
      setTodos(data || []);
    } catch (error) {
      console.error("fetchTodos client-side error:", error);
    }
  };

  // Effect for auth check and redirect (This one is okay)
  useEffect(() => {
    if (!loading) {
      // setIsLoading(false); // Remove this line
      if (!user) {
        router.push("/auth");
      }
    }
  }, [user, loading, router]);


  // Effect for Data Fetching and Realtime Subscription
  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    // Function to handle incoming payload for state updates
    const handleRealtimeUpdate = (payload: RealtimePostgresChangesPayload<Todo>) => {
      console.log('Realtime payload received:', payload);
      const { eventType, new: newRecord, old: oldRecord, errors } = payload;

      if (errors) {
        console.error('Realtime subscription error:', errors);
        return;
      }

      // Ensure the change involves the current user before updating state
      // Check user_id in 'new' for INSERT/UPDATE, and 'old' for DELETE
      const relevantUserId = eventType === 'DELETE' ? oldRecord?.user_id : newRecord?.user_id;
      if (!user || relevantUserId !== user.id) {
        console.log('Realtime event not for current user, ignoring.');
        return; // Ignore if not relevant to the current user
      }

      setTodos((currentTodos) => {
        let updatedTodos = [...currentTodos]; // Create a mutable copy

        if (eventType === 'INSERT') {
          // Check if the item isn't already there (from optimistic update + .select())
          if (newRecord && !updatedTodos.some(todo => todo.id === newRecord.id)) {
            console.log('Realtime INSERT: Adding new todo', newRecord);
            updatedTodos = [newRecord, ...updatedTodos]; // Add to beginning (or sort if needed)
          } else if (newRecord) {
            console.log('Realtime INSERT: Todo already exists, potentially updating', newRecord);
            // Optionally replace just in case data differs slightly
            updatedTodos = updatedTodos.map(todo => todo.id === newRecord.id ? newRecord : todo);
          }
        } else if (eventType === 'UPDATE') {
          console.log('Realtime UPDATE: Updating todo', newRecord);
          if (newRecord) {
            updatedTodos = updatedTodos.map(todo =>
              todo.id === newRecord.id ? { ...todo, ...newRecord } : todo // Merge updates
            );
          }
        } else if (eventType === 'DELETE') {
          // Use the ID from the 'old' record for deletes
          const deletedId = oldRecord?.id;
          if (deletedId) {
            console.log('Realtime DELETE: Removing todo', newRecord);
            updatedTodos = updatedTodos.filter(todo => todo.id !== deletedId);
          }
        }
        // Re-sort based on creation time or other criteria if needed after updates
        // updatedTodos.sort((a, b) => /* Your sorting logic */);
        return updatedTodos;
      });
    };

    // Only fetch and subscribe if loading is done and user exists
    if (!loading && user) {
      console.log("User is logged in, fetching initial todos...");
      fetchTodos(); // Fetch initial list

      console.log("Setting up realtime subscription...");
      subscription = supabase
        .channel(`todos_user_${user.id}`) // More specific channel name (optional)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all event types
            schema: 'public',
            table: 'todos',
            filter: `user_id=eq.${user.id}` // Filter events on the server
          },
          handleRealtimeUpdate
        )
        .subscribe((status, err) => { // Optional: Add status/error logging for the subscription itself
          if (err) {
            console.error(`Realtime subscription error for channel todos_user_${user.id}:`, err);
          }
          console.log(`Realtime subscription status for channel todos_user_${user.id}:`, status);
        });

      console.log("Subscribed to todos channel");

    } else if (!loading && !user) {
      // If loading is done and user is logged out, clear todos
      setTodos([]);
      console.log("User logged out, cleared todos.");
    }

    // Cleanup function
    return () => {
      if (subscription) {
        console.log("Unsubscribing from todos channel");
        supabase.removeChannel(subscription)
          .then(status => console.log("Unsubscribe status:", status))
          .catch(err => console.error("Unsubscribe error:", err));
      }
    };
    // Re-run this effect if the user logs in/out OR loading state changes
  }, [user, loading]);

  const addTodo = async () => {
    // Ensure user exists and input is not empty
    if (!inputValue.trim() || !user) return;

    const optimisticTodoId = Date.now(); // Generate temporary ID for optimistic update
    const currentInputValue = inputValue; // Capture value before clearing

    const optimisticTodo: Todo = { // Add type annotation
      id: optimisticTodoId, // Use temporary ID
      text: currentInputValue,
      completed: false,
      user_id: user.id // Include user_id for optimistic data structure consistency
    };

    // Optimistic UI update: Add todo with temporary ID
    setTodos(prevTodos => [optimisticTodo, ...prevTodos]);
    setInputValue('');

    try {
      // Insert the new todo and immediately select it back
      const { data: newTodoData, error } = await supabase
        .from('todos')
        .insert([{
          text: currentInputValue,
          completed: false,
          user_id: user.id, // Use the actual user ID
        }])
        .select() // Select the newly inserted row(s)
        .single<Todo>(); // Expecting only one row back, specify the type <Todo>

      if (error) {
        console.error('Error adding todo:', error);
        // Rollback optimistic update: remove the todo with the temporary ID
        setTodos(prevTodos => prevTodos.filter(todo => todo.id !== optimisticTodoId));
        setInputValue(currentInputValue); // Optional: Restore input value
      } else if (newTodoData) {
        console.log("Todo added successfully, received:", newTodoData);
        // Update state: Replace optimistic todo with the real one from DB
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === optimisticTodoId ? newTodoData : todo // Use the real data
          )
        );
      } else {
        // Handle case where insert succeeded but select didn't return data
        console.warn('Todo added but no data returned from select.');
        // Fallback: Remove the optimistic one and refetch? Or just remove.
        setTodos(prevTodos => prevTodos.filter(todo => todo.id !== optimisticTodoId));
        fetchTodos(); // Refetch as a safer fallback in this edge case
      }

    } catch (catchError) { // Renamed catch variable
      console.error("addTodo client-side error:", catchError);
      // Rollback optimistic update on unexpected error
      setTodos(prevTodos => prevTodos.filter(todo => todo.id !== optimisticTodoId));
      setInputValue(currentInputValue);
    }
  };

  // toggleTodo and deleteTodo remain the same as RLS handles the user check
  // You might add checks like if (!user) return; at the start of these functions for robustness.

  const toggleTodo = async (id: number) => {
    if (!user) return; // Add user check

    console.log('toggleTodo ID:', id);

    const todoToToggle = todos.find(todo => todo.id === id);
    if (!todoToToggle) return;

    console.log('todoToToggle:', todoToToggle);
    console.log('originalCompleted:', todoToToggle.completed);

    const originalCompleted = todoToToggle.completed;

    // Optimistic UI Update
    console.log('Todos before setTodos:', todos);
    setTodos(todos.map(todo => {
      console.log('Mapping todo:', todo.id, todo.completed);
      return todo.id === id ? { ...todo, completed: !todo.completed } : todo;
    }));
    console.log('Todos after setTodos:', todos);
    console.log('originalCompleted:', originalCompleted);

    try {
      console.log('supabase update id:', id, 'completed:', !originalCompleted);
      // RLS ensures this only works if the row's user_id matches auth.uid()
      const { error } = await supabase
        .from('todos')
        .update({ completed: !originalCompleted })
        .eq('id', id);

      if (error) {
        console.error('Error toggling todo:', error);
        // Rollback optimistic update
        setTodos(todos.map(todo =>
          todo.id === id ? { ...todo, completed: originalCompleted } : todo
        ));
        // fetchTodos(); // Refetch as a fallback if rollback fails or state is complex
      }
    } catch (error) {
      console.error("toggleTodo client-side error:", error);
      // Rollback optimistic update
      setTodos(todos.map(todo =>
        todo.id === id ? { ...todo, completed: originalCompleted } : todo
      ));
    }
  };


  const deleteTodo = async (id: number) => {
    if (!user) return; // Add user check

    const todoToDelete = todos.find(todo => todo.id === id);
    if (!todoToDelete) return;

    const originalTodos = [...todos]; // Store original state for rollback

    // Optimistic UI update
    setTodos(todos.filter(todo => todo.id !== id));

    try {
      // RLS ensures this only works if the row's user_id matches auth.uid()
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting todo:', error);
        // Rollback optimistic update
        setTodos(originalTodos);
        // fetchTodos(); // Refetch as a fallback
      }
    } catch (error) {
      console.error("deleteTodo client-side error:", error);
      // Rollback optimistic update
      setTodos(originalTodos);
    }
  };


  // --- Conditional Rendering (includes loading state from previous review) ---

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  // If loading is done, but there's no user, rely on the redirect effect.
  // Returning null prevents rendering the main app structure prematurely.
  if (!user) {
    return null;
  }

  // Render the app UI (Add return statement here)
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Position Logout Button (Example) */}
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>
      {/* Use loading state from useAuth */}
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 mt-16"> {/* Added margin */}
        <h1 className="text-2xl font-bold text-center mb-6">Todo List</h1>
        <p className="text-center text-gray-500 text-sm mb-4">Welcome, {user.email}</p> {/* Display user email */}

        <div className="flex mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo"
            // Ensure text is visible in input
            className="flex-grow px-4 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
          <button
            onClick={addTodo}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r disabled:opacity-50"
            disabled={!inputValue.trim()} // Disable if input is empty
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {/* Use state 'todos' which is now user-specific */}
          {todos.length === 0 ? (
            <p className="text-gray-500 text-center">No todos yet. Add one!</p>
          ) : (
            todos.map(todo => (
              <li
                key={todo.id}
                className={`flex items-center justify-between p-3 border rounded transition-colors duration-200 ${todo.completed ? 'bg-green-50 border-green-200' : 'bg-white'}`}
              >
                <div className="flex items-center flex-grow mr-2 min-w-0"> {/* Ensure text can wrap */}
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                    className="h-5 w-5 text-blue-500 rounded focus:ring-blue-400 flex-shrink-0"
                  />
                  <span className={`ml-3 break-words ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {todo.text}
                  </span>
                </div>
                <div className="flex space-x-2 flex-shrink-0">
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="text-green-500 hover:text-green-600 p-1 rounded"
                    title={todo.completed ? "Mark as Incomplete" : "Mark as Complete"}
                  >
                    <FaCheck />
                  </button>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="text-red-500 hover:text-red-600 p-1 rounded"
                    title="Delete Todo"
                  >
                    <FaTrash />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
