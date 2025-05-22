import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <header className="max-w-7xl mx-auto mb-12">
        <h1 className="text-4xl font-bold mb-4">Tech Store</h1>
        <nav className="flex gap-4">
          <a href="/" className="text-blue-600 hover:underline">Home</a>
          <a href="/products" className="text-blue-600 hover:underline">Products</a>
          <a href="/about" className="text-blue-600 hover:underline">About</a>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto">
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Featured Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="border rounded-lg p-4 shadow-sm">
              <img 
                src="https://picsum.photos/400/300" 
                alt="Premium Laptop"
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="text-xl font-semibold mb-2">Premium Laptop</h3>
              <p className="text-gray-600 mb-4">
                High-performance laptop with the latest specifications.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">$1,299</span>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Add to Cart
                </button>
              </div>
            </div>

            <div className="border rounded-lg p-4 shadow-sm">
              <img 
                src="https://picsum.photos/400/300" 
                alt="Wireless Headphones"
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="text-xl font-semibold mb-2">Wireless Headphones</h3>
              <p className="text-gray-600 mb-4">
                Noise-cancelling wireless headphones with premium sound.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">$299</span>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Add to Cart
                </button>
              </div>
            </div>

            <div className="border rounded-lg p-4 shadow-sm">
              <img 
                src="https://picsum.photos/400/300" 
                alt="Smart Watch"
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="text-xl font-semibold mb-2">Smart Watch</h3>
              <p className="text-gray-600 mb-4">
                Feature-rich smartwatch with health monitoring.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">$199</span>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gray-50 p-8 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">About Our Store</h2>
          <p className="text-gray-600">
            We offer the latest technology products with competitive prices and excellent customer service.
            Our mission is to make technology accessible to everyone.
          </p>
        </section>
      </div>

      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t">
        <p className="text-center text-gray-600">
          © 2024 Tech Store. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
