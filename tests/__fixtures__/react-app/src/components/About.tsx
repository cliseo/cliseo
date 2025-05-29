import React from 'react';

const About = () => {
  return (
    <section className="about">
      {/* SEO Issue: Invalid heading hierarchy - skipping h2 */}
      <h3>About Our Company</h3>
      
      <div className="about-content">
        {/* SEO Issue: Using h4 before h2 */}
        <h4>Our Mission</h4>
        <p>We strive to provide the best products and services to our customers.</p>

        {/* SEO Issue: Using h2 after h4 */}
        <h2>Our History</h2>
        <p>Founded in 2020, we've grown to become a leading provider in our industry.</p>

        {/* SEO Issue: Inconsistent heading levels */}
        <h5>Our Values</h5>
        <ul>
          <li>Quality</li>
          <li>Innovation</li>
          <li>Customer Satisfaction</li>
        </ul>
      </div>
    </section>
  );
};

export default About; 