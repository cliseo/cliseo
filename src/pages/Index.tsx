import { useState } from 'react';
import { Helmet } from 'react-helmet';
import Navbar from '@/components/Navbar';
import Terminal from '@/components/Terminal';
import CodeBlock from '@/components/CodeBlock';
import Badge from '@/components/Badge';
import FeatureCard from '@/components/FeatureCard';
import { CommandDisplay } from '@/components/CommandDisplay';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompatibilityChecker from '@/components/CompatibilityChecker';
import { 
  FileCode, 
  Zap, 
  BarChartBig, 
  Terminal as TerminalIcon, 
  Github, 
  GitPullRequest, 
  FileText,
  Bot,
  LayoutDashboard,
  FileCheck,
  Download,
} from 'lucide-react';
import { motion } from 'framer-motion';

const Index = () => {
  const [activeTab, setActiveTab] = useState("scan");
  
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "cliseo - SEO Optimization Tool",
    "description": "Optimize your site's SEO in 30 seconds with AI-powered fixes",
    "url": window.location.href,
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "cliseo",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
  };

  const terminalCommands = [
    {
      command: "npm install -g cliseo",
      output: "Successfully installed cliseo v1.0.0",
      delay: 1000
    },
    {
      command: "cliseo scan --ai",
      output: "🔍 Scanning project files...\n✓ Found 127 files to analyze\n⚡ AI Analysis in progress...\n\n✨ Website optimized in 30 seconds!\n✅ Fixed 23 missing alt texts\n✅ Added meta descriptions to 7 pages\n✅ Generated structured data for 3 product pages\n✅ Optimized robots.txt",
      delay: 2000
    }
  ];

  const scanCommand = `# Start optimizing your site in 30 seconds
npm install -g cliseo
cliseo scan --ai`;

  const optimizeCommand = `# Apply AI-powered fixes
cliseo optimize --ai

# Preview changes without applying
cliseo optimize --ai --dry-run

# Create a PR with fixes
cliseo optimize --ai --git-pr`;

  const configExample = `{
  "ai": {
    "model": "gpt-4o",
    "temperature": 0.2
  },
  "scan": {
    "include": ["src/**/*.{tsx,jsx}", "public/**/*.html"],
    "exclude": ["node_modules", ".next"]
  },
  "optimize": {
    "createSeoDir": true,
    "autoInject": true
  }
}`;

  // Add a smooth scroll handler
  const handleScrollToQuickstart = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const el = document.getElementById('quickstart');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <Helmet>
        <title>cliseo - SEO Optimization Tool</title>
        <meta name="description" content="Optimize your site's SEO in 30 seconds with AI-powered fixes" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-[#050a12] via-[#060b13] to-[#010308] text-foreground before:fixed before:inset-0 before:bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] before:bg-[size:4rem_4rem] before:pointer-events-none before:z-0 before:content-[''] before:shadow-[0_0_15px_rgba(255,255,255,0.07)] before:[transform:perspective(500px)_rotateX(45deg)_scale(2.5)] before:origin-[50%_100%]">
        <Navbar />
        
        {/* Hero Section */}
        <motion.section
          className="container pt-12 pb-20 md:pt-20 md:pb-32 relative"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
            <div className="mt-[50px]"></div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight mt-[50px]">
              Optimize your site's SEO<br />
              <span className="text-primary">in 30 seconds</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl">
              Want powerful SEO without the hassle?
            </p>
            <div className="flex justify-center mb-16">
              <Button size="lg" className="group" onClick={handleScrollToQuickstart}>Get Started</Button>
            </div>
            
            {/* Centered Big Command Block */}
            <div className="flex justify-center mb-16">
              <pre className="text-2xl md:text-3xl whitespace-pre-wrap font-mono overflow-auto text-center drop-shadow-[0_0_16px_rgba(255,255,255,0.25)]">
                <code className="bg-gradient-to-r from-[#33ff33] to-[#a4c2f4] bg-clip-text text-transparent">
                  {`$ cliseo optimize`}
                </code>
              </pre>
            </div>
          </div>
        </motion.section>
        
        {/* Features Section (replaced with horizontal 3-step process) */}
        <motion.section
          className="container py-10 -mt-32 animate-fade-in-up"
          id="how-it-works"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center max-w-xs">
              <TerminalIcon className="h-10 w-10 text-cyan-400 mb-2" />
              <p className="font-bold text-lg mb-1 select-all">Run the command</p>
              <div className="font-mono text-base bg-black/30 rounded px-2 py-1 text-cyan-200">$ cliseo optimize</div>
            </div>
            {/* Arrow */}
            <div className="hidden md:block text-3xl text-gray-500">→</div>
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center max-w-xs">
              <GitPullRequest className="h-10 w-10 text-green-400 mb-2" />
              <p className="font-bold text-lg mb-1 select-all">cliseo improves your site's SEO</p>
              <div className="text-base text-gray-400">Automatic fixes & pull requests created</div>
            </div>
            {/* Arrow */}
            <div className="hidden md:block text-3xl text-gray-500">→</div>
            {/* Step 3 */}
            <div className="flex flex-col items-center text-center max-w-xs">
              <BarChartBig className="h-10 w-10 text-yellow-400 mb-2" />
              <p className="font-bold text-lg mb-1 select-all">SEO score skyrockets</p>
              <div className="text-base text-gray-400">
                Google Lighthouse: <span className="font-bold text-red-400 select-all">78</span> <span className="mx-1">→</span> <span className="font-bold text-green-400 select-all">100</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Why SEO Matters Section */}
        <motion.section
          className="container py-10 text-center max-w-3xl mx-auto mt-8"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
        >
          <h2 className="text-3xl font-bold mb-6">Why would I want to improve my SEO?</h2>
          <p className="text-2xl mb-6">
            SEO helps search engines understand your website's content. Sites that follow best practices are more likely to show up in search results, whether it's Google, Perplexity, Bing, or Brave. The higher you rank, the more traffic your site recieves.
          </p>
          <blockquote className="border-l-4 border-primary pl-4 italic text-m text-muted-foreground">
            "If you don't capture the clicks available in your niche, your competitors will" -Semrush
          </blockquote>
        </motion.section>

        {/* Quickstart Section */}
        <motion.section
          id="quickstart"
          className="container max-w-2xl mx-auto py-20 animate-fade-in-up"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
        >
          <h2 className="text-3xl font-bold text-center mb-10">Quickstart</h2>
          <ol className="space-y-8">
            {/* Step 1 */}
            <li className="flex items-start gap-4">
              <div className="flex-shrink-0 bg-yellow-700/20 rounded-full p-3">
                <Download className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="w-full">
                <div className="font-semibold text-lg mb-1">Install cliseo</div>
                <CommandDisplay command="npm install -g cliseo" />
              </div>
            </li>
            {/* Step 2 */}
            <li className="flex items-start gap-4">
              <div className="flex-shrink-0 bg-yellow-700/20 rounded-full p-3">
                <TerminalIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="w-full">
                <div className="font-semibold text-lg mb-1">Run the CLI</div>
                <CommandDisplay command="cliseo scan" />
                <CommandDisplay command="cliseo optimize" className="mb-2" />
                <div className="text-gray-400 text-sm mt-2">
                  <span className="font-mono">scan</span> shows suggestions without making changes.<br />
                  <span className="font-mono">optimize</span> applies fixes automatically.
                </div>
              </div>
            </li>
            {/* Step 3 */}
            <li className="flex items-start gap-4">
              <div className="flex-shrink-0 bg-yellow-700/20 rounded-full p-3">
                <Zap className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <div className="font-semibold text-lg mb-1">See instant results</div>
                <ul className="list-disc pl-5 text-gray-300 text-base">
                  <li>Meta tags added</li>
                  <li>Alt text fixed</li>
                  <li>robots.txt & sitemap.xml generated</li>
                  <li>SEO issues resolved</li>
                </ul>
              </div>
            </li>
            {/* Step 4 */}
            <li className="flex items-start gap-4">
              <div className="flex-shrink-0 bg-fuchsia-700/20 rounded-full p-3">
                <Bot className="h-6 w-6 text-fuchsia-400" />
              </div>
              <div className="w-full">
                <div className="font-semibold text-lg mb-1">Want even more?</div>
                <CommandDisplay command="cliseo optimize -ai" /><br></br>
                <div className="text-fuchsia-200 mb-2">Unlock advanced improvements with AI mode <span className="bg-fuchsia-900/30 text-xs px-2 py-0.5 rounded ml-2">Coming Soon</span></div>
                <ul className="list-disc pl-5 text-fuchsia-200 text-base space-y-1">
                  <li>Advanced meta</li>
                  <li>Content rewrite</li>
                  <li>Internal linking</li>
                  <li>Accessibility</li>
                  <li>Structured data</li>
                  <li>Keyword optimization</li>
                  <li>Duplicate detection</li>
                  <li>Personalized suggestions</li>
                </ul>
              </div>
            </li>
          </ol>
        </motion.section>
        
        {/* Compatibility Checker Section */}
        <motion.section
          className="container py-20"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Is My Site Compatible?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We support all major web frameworks including React, Angular, and Next.js. Check your site's compatibility below.
            </p>
          </div>
          <CompatibilityChecker />
        </motion.section>
        
        {/* Pricing Section */}
        <motion.section
          className="container py-20"
          id="pricing"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple Pricing Model</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Dual licensing with open source and commercial options
            </p>
          </div>
          
          <div className="flex gap-2 items-center justify-center mb-8 animate-fade-in-up">
            <Badge type="license" value="AGPL/Commercial" />
            <Badge type="downloads" value="10k+" />
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="border rounded-lg p-8 bg-card flex flex-col">
              <div className="mb-6">
                <div className="text-muted-foreground text-sm mb-2">
                  <FileCode className="inline-block mr-1 h-4 w-4" />
                  Open Source
                </div>
                <h3 className="text-2xl font-bold mb-2">Core CLI</h3>
                <p className="text-muted-foreground">
                  Rule-based SEO optimization features for developers
                </p>
              </div>
              <div className="text-3xl font-bold mb-6">Free</div>
              <ul className="mb-8 space-y-3 flex-grow">
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Rule-based SEO scanning
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Basic optimization features
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Open source (AGPL)
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Community support
                </li>
              </ul>
              <Button variant="outline" className="w-full" onClick={handleScrollToQuickstart}>
                Get Started
              </Button>
            </div>
            
            <div className="border rounded-lg p-8 bg-card shadow-xl relative flex flex-col border-primary/50 bg-primary/5">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg rounded-tr-lg">
                POPULAR
              </div>
              <div className="mb-6">
                <div className="text-primary text-sm mb-2">
                  <Bot className="inline-block mr-1 h-4 w-4" />
                  Pro
                </div>
                <h3 className="text-2xl font-bold mb-2">AI Optimization</h3>
                <p className="text-muted-foreground">
                  Full AI capabilities for individuals and startups
                </p>
              </div>
              <div className="text-3xl font-bold mb-6">$9.99<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="mb-8 space-y-3 flex-grow">
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Everything in Core
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  AI-powered analysis & fixes
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  GitHub integration
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  500 AI requests/month
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Email support
                </li>
              </ul>
              <Button className="w-full">Subscribe Now</Button>
            </div>
            
            <div className="border rounded-lg p-8 bg-card flex flex-col">
              <div className="mb-6">
                <div className="text-muted-foreground text-sm mb-2">
                  <LayoutDashboard className="inline-block mr-1 h-4 w-4" />
                  Enterprise
                </div>
                <h3 className="text-2xl font-bold mb-2">Team License</h3>
                <p className="text-muted-foreground">
                  Unlimited usage for teams and organizations
                </p>
              </div>
              <div className="text-3xl font-bold mb-6">$99<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="mb-8 space-y-3 flex-grow">
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Everything in Pro
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Unlimited AI requests
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  CI/CD integration
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  SEO performance dashboard
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  Priority support
                </li>
              </ul>
              <Button variant="secondary" className="w-full">Join the Waitlist</Button>
            </div>
          </div>
        </motion.section>
        
        {/* CTA Section */}
        <motion.section
          className="container py-20"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.4 }}
        >
          <div className="max-w-4xl mx-auto bg-black/40 backdrop-blur-sm rounded-2xl p-10 border border-white/10 text-center shadow-[0_0_50px_-12px_rgba(255,255,255,0.15)] ring-1 ring-white/10">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-[#33ff33] to-[#a4c2f4] bg-clip-text text-transparent">Ready to supercharge your SEO?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto text-gray-300">
              Join thousands of developers optimizing their sites with cliseo
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="group" onClick={handleScrollToQuickstart}>
                Get Started
              </Button>
              <Button size="lg" variant="outline" onClick={() => window.location.href = '/docs'}>
                View Documentation
              </Button>
            </div>
          </div>
        </motion.section>
        
        {/* Footer */}
        <footer className="py-12">
          <div className="container">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-6 md:mb-0">
                <div className="flex items-center">
                  <a href="/" className="flex items-center gap-2">
                    <img src="/logo.png" alt="cliseo logo" className="h-8 w-auto" />
                  </a>
                  <div className="flex gap-2 ml-2">
                    <Badge type="license" value="AGPL/Commercial" />
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
      </div>
    </>
  );
};

export default Index;
