import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Terminal from '@/components/Terminal';
import CodeBlock from '@/components/CodeBlock';
import Badge from '@/components/Badge';
import FeatureCard from '@/components/FeatureCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const Index = () => {
  const [activeTab, setActiveTab] = useState("scan");
  
  const terminalCommands = [
    {
      command: "npm install -g ezseo",
      output: "Successfully installed ezseo v1.0.0",
      delay: 1000
    },
    {
      command: "ezseo scan --ai",
      output: "🔍 Scanning project files...\n✓ Found 127 files to analyze\n⚡ AI Analysis in progress...\n\n✨ Website optimized in 30 seconds!\n✅ Fixed 23 missing alt texts\n✅ Added meta descriptions to 7 pages\n✅ Generated structured data for 3 product pages\n✅ Optimized robots.txt",
      delay: 2000
    }
  ];

  const scanCommand = `# Start optimizing your site in 30 seconds
npm install -g ezseo
ezseo scan --ai`;

  const optimizeCommand = `# Apply AI-powered fixes
ezseo optimize --ai

# Preview changes without applying
ezseo optimize --ai --dry-run

# Create a PR with fixes
ezseo optimize --ai --git-pr`;

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1820] via-[#0a1920] to-[#051014] text-foreground">
      <Navbar />
      
      {/* Hero Section */}
      <section className="container pt-12 pb-20 md:pt-20 md:pb-32 relative">
        <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
          <div className="mt-[50px]"></div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Optimize your site's SEO<br />
            <span className="text-primary">in 30 seconds</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl">
            Want powerful SEO without the hassle?
          </p>
          <div className="flex justify-center mb-16">
            <a href="#quickstart"><Button size="lg" className="group">Get Started</Button></a>
          </div>
          
          {/* Centered Big Command Block */}
          <div className="flex justify-center mb-16">
            <pre className="text-2xl md:text-3xl bg-gradient-to-r from-[#FFF59D] to-[#FFE082] bg-clip-text text-transparent whitespace-pre-wrap font-mono overflow-auto text-center drop-shadow-[0_0_16px_rgba(255,255,255,0.25)]">
              <code>
                {`$ ezseo optimize`}
              </code>
            </pre>
          </div>
        </div>
      </section>
      
      {/* Features Section (replaced with horizontal 3-step process) */}
      <section className="container py-10 -mt-32 animate-fade-in-up" id="how-it-works">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center max-w-xs">
            <TerminalIcon className="h-10 w-10 text-cyan-400 mb-2" />
            <div className="font-bold text-lg mb-1">Run the command</div>
            <div className="font-mono text-base bg-black/30 rounded px-2 py-1 text-cyan-200">$ ezseo optimize</div>
          </div>
          {/* Arrow */}
          <div className="hidden md:block text-3xl text-gray-500">→</div>
          {/* Step 2 */}
          <div className="flex flex-col items-center text-center max-w-xs">
            <GitPullRequest className="h-10 w-10 text-green-400 mb-2" />
            <div className="font-bold text-lg mb-1">ezseo improves your site's SEO</div>
            <div className="text-base text-gray-400">Automatic fixes & pull requests created</div>
          </div>
          {/* Arrow */}
          <div className="hidden md:block text-3xl text-gray-500">→</div>
          {/* Step 3 */}
          <div className="flex flex-col items-center text-center max-w-xs">
            <BarChartBig className="h-10 w-10 text-yellow-400 mb-2" />
            <div className="font-bold text-lg mb-1">SEO score skyrockets</div>
            <div className="text-base text-gray-400">
              Google Lighthouse: <span className="font-bold text-red-400">78</span> <span className="mx-1">→</span> <span className="font-bold text-green-400">100</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Quickstart Section */}
      <section id="quickstart" className="container max-w-2xl mx-auto py-20 animate-fade-in-up">
        <h2 className="text-3xl font-bold text-center mb-10">Quickstart</h2>
        <ol className="space-y-8">
          {/* Step 1 */}
          <li className="flex items-start gap-4">
            <div className="flex-shrink-0 bg-cyan-700/20 rounded-full p-3">
              <Download className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <div className="font-semibold text-lg mb-1">Install ezseo</div>
              <pre className="bg-black/40 rounded px-3 py-2 font-mono text-cyan-200 text-base">$ npm install -g ezseo</pre>
            </div>
          </li>
          {/* Step 2 */}
          <li className="flex items-start gap-4">
            <div className="flex-shrink-0 bg-green-700/20 rounded-full p-3">
              <TerminalIcon className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <div className="font-semibold text-lg mb-1">Run the CLI</div>
              <pre className="bg-black/40 rounded px-3 py-2 font-mono text-green-200 text-base mb-2">$ ezseo optimize</pre>
              <pre className="bg-black/40 rounded px-3 py-2 font-mono text-green-200 text-base">$ ezseo scan</pre>
              <div className="text-gray-400 text-sm mt-2">
                <span className="font-mono">optimize</span> applies fixes automatically.<br />
                <span className="font-mono">scan</span> only shows suggestions, no changes made.
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
            <div>
              <div className="font-semibold text-lg mb-1">Want even more?</div>
              <pre className="bg-black/40 rounded px-3 py-2 font-mono text-fuchsia-200 text-base inline-block mb-2">$ ezseo optimize <span className="text-fuchsia-400 drop-shadow-[0_0_8px_rgba(200,100,255,0.7)] animate-pulse">-ai</span></pre>
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
      </section>
      
      {/* Pricing Section */}
      <section className="container py-20" id="pricing">
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
            <Button variant="outline" className="w-full">
              <Github className="mr-2 h-4 w-4" />
              Clone Repository
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
            <div className="text-3xl font-bold mb-6">$10<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
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
            <Button variant="secondary" className="w-full">Contact Sales</Button>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-10 border text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to supercharge your SEO?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join the devs who are optimizing their sites in 30 seconds with ezseo
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="group">
              <Download className="mr-2 h-4 w-4" />
              Install ezseo Now
            </Button>
            <Button size="lg" variant="outline">Read Documentation</Button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <div className="flex items-center">
                <span className="text-2xl font-bold mr-2">⚡️ezseo</span>
                <div className="flex gap-2">
                  <Badge type="license" value="AGPL/Commercial" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                © 2025 ezseo. All rights reserved.
              </p>
            </div>
            <div className="flex gap-8">
              <div>
                <h3 className="font-semibold mb-2">Product</h3>
                <ul className="space-y-1">
                  <li><a href="#features" className="text-sm text-muted-foreground hover:text-primary">Features</a></li>
                  <li><a href="#pricing" className="text-sm text-muted-foreground hover:text-primary">Pricing</a></li>
                  <li><a href="#faq" className="text-sm text-muted-foreground hover:text-primary">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Resources</h3>
                <ul className="space-y-1">
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Documentation</a></li>
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">API Reference</a></li>
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Blog</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Connect</h3>
                <ul className="space-y-1">
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">GitHub</a></li>
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Twitter</a></li>
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Discord</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
