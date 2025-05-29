import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => {
    // If we're not on the homepage, navigate there first
    if (window.location.pathname !== '/') {
      navigate('/');
      // Wait for navigation to complete before scrolling
      setTimeout(() => {
        const quickstartSection = document.getElementById('quickstart');
        if (quickstartSection) {
          quickstartSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      // If we're already on the homepage, just scroll
      const quickstartSection = document.getElementById('quickstart');
      if (quickstartSection) {
        quickstartSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 py-4 transition-all duration-300 ${
      scrolled ? 'bg-background/80 backdrop-blur-md border-b' : 'bg-transparent'
    }`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="cliseo logo" className="h-8 w-auto" />
          </Link>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <a href="/docs" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary transition-colors">Documentation</a>
          <Link to="/about" className="text-sm hover:text-primary transition-colors">About</Link>
          <a href="/blog" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary transition-colors">Blog</a>
          <a 
            href="https://github.com/ryanjhermes/cliseo" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-primary transition-colors flex items-center"
          >
            <Github className="h-5 w-5" />
          </a>
          <Button size="sm" onClick={handleGetStarted}>Get Started</Button>
        </div>
        
        <Button size="sm" className="md:hidden" variant="outline">
          Menu
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;
