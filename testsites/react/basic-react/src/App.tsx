import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <header>
        <h1>My Tech Blog</h1>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>

      <main>
        <article>
          <h2>Welcome to My Blog</h2>
          <img src="https://picsum.photos/800/400" alt="Random tech image" />
          <p>
            This is a sample blog post to test SEO optimizations. We'll be discussing
            various topics related to web development and technology.
          </p>
          <div className="meta">
            <span>Published: March 2024</span>
            <span>Author: John Doe</span>
          </div>
        </article>

        <section className="featured-posts">
          <h2>Featured Posts</h2>
          <div className="post-grid">
            <div className="post-card">
              <img src="https://picsum.photos/400/300" alt="React development" />
              <h3>Getting Started with React</h3>
              <p>Learn the basics of React development...</p>
              <a href="/posts/react-basics">Read More</a>
            </div>
            <div className="post-card">
              <img src="https://picsum.photos/400/300" alt="TypeScript tutorial" />
              <h3>TypeScript Tips & Tricks</h3>
              <p>Advanced TypeScript patterns for better code...</p>
              <a href="/posts/typescript-tips">Read More</a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <p>&copy; 2024 My Tech Blog. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
