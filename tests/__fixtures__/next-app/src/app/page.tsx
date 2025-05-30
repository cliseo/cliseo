// Intentionally missing basic SEO elements
export default function HomePage() {
  return (
    <main>
      <h1>Welcome</h1>
      <p>This is a test page for Next.js.</p>
      <img src="/placeholder.png" /> {/* Missing alt text */}
      <a href="/another-page">Link</a> {/* Potentially non-descriptive */} 
    </main>
  )
} 