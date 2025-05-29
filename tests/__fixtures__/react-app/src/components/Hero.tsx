import React from 'react';

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>Welcome to Our Store</h1>
        <p>Discover amazing products at great prices</p>
        
        {/* SEO Issue: Missing alt text on images */}
        <div className="hero-images">
          <img src="/images/product1.jpg" className="hero-image" />
          <img src="/images/product2.jpg" className="featured-image" />
          <img src="/images/banner.jpg" className="banner" />
        </div>
      </div>
    </section>
  );
};

export default Hero; 