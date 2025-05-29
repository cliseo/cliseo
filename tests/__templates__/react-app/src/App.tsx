import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import { Hero } from './components/Hero';
import { About } from './components/About';
import Products from './components/Products';

// Missing proper meta tags and document title management
function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <Routes>
          <Route path="/" element={
            <>
              {/* Missing alt text on images */}
              <Hero />
              {/* Invalid heading hierarchy */}
              <About />
              {/* Missing schema markup */}
              <Products />
            </>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 