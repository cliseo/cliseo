import React from 'react';

// SEO Issue: Missing schema.org markup for products
const Products = () => {
  const products = [
    {
      id: 1,
      name: 'Premium Widget',
      price: 99.99,
      description: 'A high-quality widget for all your needs',
      image: '/images/widget.jpg'
    },
    {
      id: 2,
      name: 'Super Gadget',
      price: 149.99,
      description: 'The latest in gadget technology',
      image: '/images/gadget.jpg'
    },
    {
      id: 3,
      name: 'Mega Tool',
      price: 79.99,
      description: 'Professional-grade tool for experts',
      image: '/images/tool.jpg'
    }
  ];

  return (
    <section className="products">
      <h2>Our Products</h2>
      <div className="product-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            {/* SEO Issue: Missing alt text */}
            <img src={product.image} className="product-image" />
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <p className="price">${product.price}</p>
            <button>Add to Cart</button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Products; 