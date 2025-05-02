'use client'
import { useState, useEffect } from 'react'
import { FaTrash, FaCheck } from 'react-icons/fa'
import { supabase } from '../lib/supabase'

type Todo = {
  id: number
  text: string
  completed: boolean
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    fetchTodos()
    const subscription = supabase
      .channel('todos')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'todos' 
      }, () => fetchTodos())
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching todos:', error)
        return
      }
      setTodos(data || [])
    } catch (error) {
      console.error("fetchTodos", error)
    }
  }

  const addTodo = async () => {
    if (!inputValue.trim()) return

    const newTodo = {
      id: Date.now(),
      text: inputValue,
      completed: false,
    }

    setTodos([newTodo, ...todos])
    setInputValue('')

    try {
      const { error } = await supabase
        .from('todos')
        .insert([{ 
          text: inputValue, 
          completed: false,
        }])

      if (error) {
        console.error('Error adding todo:', error)
        setTodos(todos.filter(todo => todo.id !== newTodo.id))
      }
    } catch (error) {
      console.error("addTodo", error)
    }
  }

  const toggleTodo = async (id: number) => {
    try {
      setTodos(todos.map(todo => {
        console.log(`Toggling todo with id ${id}. Current todo id: ${todo.id}, completed: ${todo.completed}`)
        return todo.id === id ? { ...todo, completed: !todo.completed } : todo
      }))

      const { error } = await supabase
        .from('todos')
        .update({ completed: !todos.find(todo => todo.id === id)?.completed })
        .eq('id', id)

      if (error) {
        console.error('Error toggling todo:', error)
        fetchTodos()
      }
    } catch (error) {
      console.error("toggleTodo", error)
    }
  }

  const deleteTodo = async (id: number) => {
    try {
      setTodos(todos.filter(todo => todo.id !== id))

      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting todo:', error)
        fetchTodos()
      }
    } catch (error) {
      console.error("deleteTodo",error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Todo List</h1>
        
        <div className="flex mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo"
            className="flex-grow px-4 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTodo}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {todos.length === 0 ? (
            <p className="text-gray-500 text-center">No todos yet. Add one!</p>
          ) : (
            todos.map(todo => (
              <li 
                key={todo.id} 
                className={`flex items-center justify-between p-3 border rounded ${todo.completed ? 'bg-gray-50' : ''}`}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 flex items-center">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="h-5 w-5 text-blue-500 rounded focus:ring-blue-400"
                    />
                  </div>
                  <span className={`ml-3 ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {todo.text}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="text-green-500 hover:text-green-600"
                  >
                    <FaCheck />
                  </button>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="text-red-500 hover:text-red-600"
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
  )
}
