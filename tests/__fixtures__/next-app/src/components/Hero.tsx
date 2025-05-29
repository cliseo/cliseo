import React from 'react';

export const Hero: React.FC = () => {
  return (
    <div className="hero">
      <div className="hero-content">
        <h1>Welcome to Our Next.js Site</h1>
        <p>Discover amazing things with us</p>
      </div>
      {/* Intentionally missing alt text */}
      <img src="/images/hero-banner.jpg" className="hero-image" />
      <div className="hero-features">
        <div className="feature">
          {/* Intentionally missing alt text */}
          <img src="/images/feature1.png" className="feature-icon" />
          <h3>Feature 1</h3>
        </div>
        <div className="feature">
          {/* Intentionally missing alt text */}
          <img src="/images/feature2.png" className="feature-icon" />
          <h3>Feature 2</h3>
        </div>
      </div>
    </div>
  );
}; 