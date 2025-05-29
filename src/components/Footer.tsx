import { Badge } from '@/components/ui/badge';

const Footer = () => {
  return (
    <footer className="py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <div className="flex items-center">
              <a href="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="cliseo logo" className="h-8 w-auto" />
              </a>
              <div className="flex gap-2 ml-2">
                <Badge variant="outline">AGPL/Commercial</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              © 2025 cliseo. All rights reserved. cliseo is an abbreviation for command line interface + search engine optimization.
            </p>
          </div>
          <div className="flex gap-8">
            <div>
              <h3 className="font-semibold mb-2">Product</h3>
              <ul className="space-y-1">
                <li><a href="#features" className="text-sm text-muted-foreground hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="text-sm text-muted-foreground hover:text-primary">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Resources</h3>
              <ul className="space-y-1">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Documentation</a></li>
                <li><a href="/blog" className="text-sm text-muted-foreground hover:text-primary">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Connect</h3>
              <ul className="space-y-1">
                <li><a href="https://github.com/ryanjhermes/cliseo" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary">GitHub</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Reddit</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 