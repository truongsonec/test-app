'use client'
import { useState } from 'react'
import { FaTrash, FaCheck } from 'react-icons/fa'

type Todo = {
  id: number
  text: string
  completed: boolean
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputValue, setInputValue] = useState('')

  const addTodo = () => {
    if (inputValue.trim() !== '') {
      setTodos([
        ...todos,
        {
          id: Date.now(),
          text: inputValue,
          completed: false
        }
      ])
      setInputValue('')
    }
  }

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    )
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Việc cần làm ngay</h1>
        
        <div className="flex mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Thêm việc cần làm..."
            className="flex-grow px-4 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTodo}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r"
          >
            Thêm
          </button>
        </div>

        <ul className="space-y-2">
          {todos.length === 0 ? (
            <p className="text-gray-500 text-center">Chưa có Việc cần làm. Hãy tạo ngay!</p>
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
                  <span 
                    className={`ml-3 ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}
                  >
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
