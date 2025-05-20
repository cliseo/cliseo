import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 py-4 transition-all duration-300 ${
      scrolled ? 'bg-background/80 backdrop-blur-md border-b' : 'bg-transparent'
    }`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="/" className="text-2xl font-bold hover:text-primary transition-colors">⚡️ezseo</a>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm hover:text-primary transition-colors">Features</a>
          <a href="#commands" className="text-sm hover:text-primary transition-colors">Commands</a>
          <a href="#pricing" className="text-sm hover:text-primary transition-colors">Pricing</a>
          <a href="#faq" className="text-sm hover:text-primary transition-colors">FAQ</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" 
            className="hover:text-primary transition-colors flex items-center">
            <Github className="h-5 w-5" />
          </a>
          <Button size="sm">Get Started</Button>
        </div>
        
        <Button size="sm" className="md:hidden" variant="outline">
          Menu
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;
