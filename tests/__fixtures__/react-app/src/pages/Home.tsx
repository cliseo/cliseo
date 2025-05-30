import React from 'react';

export default function Home() {
  return (
    <div>
      {/* Missing Helmet meta management */}
      <h1>React Fixture</h1>
      {/* Image missing alt attribute */}
      <img src="/logo.png" />
      {/* Non-descriptive link text */}
      <a href="https://example.com">click here</a>
    </div>
  );
} 