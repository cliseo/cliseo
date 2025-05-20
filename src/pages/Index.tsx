
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
  License,
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
      command: "cd my-nextjs-project",
      delay: 500
    },
    {
      command: "ezseo scan --ai",
      output: "🔍 Scanning project files...\n✓ Found 127 files to analyze\n⚡ AI Analysis in progress...\n\n🚨 SEO Issues Found:\n- 23 images missing alt text\n- Meta descriptions missing on 7 pages\n- No structured data for 3 product pages\n- robots.txt needs optimization\n\n💡 Run 'ezseo optimize --ai' to automatically fix these issues",
      delay: 2000
    }
  ];

  const scanCommand = `# Perform basic SEO audit
ezseo scan

# Run AI-powered deep analysis
ezseo scan --ai`;

  const optimizeCommand = `# Apply rule-based fixes only
ezseo optimize

# Apply AI-powered fixes
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
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      {/* Hero Section */}
      <section className="container pt-32 pb-20 md:pt-40 md:pb-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background z-[-1]"></div>
        <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
          <div className="flex gap-2 items-center mb-6">
            <Badge type="license" value="AGPL/Commercial" />
            <Badge type="downloads" value="10k+" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Instant AI-Powered<br />
            <span className="text-primary">SEO Optimization</span> CLI
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl">
            Automate SEO best practices for your JavaScript/TypeScript projects in seconds with AI
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Button size="lg" className="group">
              Get Started
              <Zap className="ml-2 h-4 w-4 group-hover:animate-pulse" />
            </Button>
            <Button size="lg" variant="outline">
              <Github className="mr-2 h-4 w-4" />
              View on GitHub
            </Button>
          </div>
          <div className="w-full">
            <Terminal commands={terminalCommands} />
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="container py-20" id="features">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Developer-First SEO Toolkit</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Optimize your website's SEO without disrupting your development workflow
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={Bot}
            title="AI-Powered Analysis"
            description="Deep SEO analysis of your codebase with actionable suggestions using OpenAI's GPT models."
          />
          <FeatureCard 
            icon={Zap}
            title="Instant Optimization"
            description="Auto-apply SEO fixes with a single command, from alt tags to structured data."
          />
          <FeatureCard 
            icon={GitPullRequest}
            title="GitHub Integration"
            description="Create pull requests with SEO improvements directly from the command line."
          />
          <FeatureCard 
            icon={FileCheck}
            title="SEO Asset Generation"
            description="Auto-generate structured data, sitemaps, and robots.txt files for optimal indexing."
          />
          <FeatureCard 
            icon={TerminalIcon}
            title="Cross-Platform CLI"
            description="Works on Windows, macOS, and Linux with support for all major JS/TS frameworks."
          />
          <FeatureCard 
            icon={BarChartBig}
            title="Impact Metrics"
            description="Track your SEO improvements with before/after performance metrics."
          />
        </div>
      </section>
      
      {/* Commands Section */}
      <section className="py-20 bg-muted/30" id="commands">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Commands</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Just two simple commands to transform your website's SEO
            </p>
          </div>
          
          <Tabs defaultValue="scan" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="scan">ezseo scan</TabsTrigger>
              <TabsTrigger value="optimize">ezseo optimize</TabsTrigger>
            </TabsList>
            <TabsContent value="scan" className="border rounded-lg p-6 bg-card shadow-md">
              <h3 className="text-xl font-semibold mb-4">Scan Your Project</h3>
              <p className="mb-6 text-muted-foreground">
                Identify SEO issues across your codebase with detailed reports and recommendations.
              </p>
              <CodeBlock language="bash" code={scanCommand} />
              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-md">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sample Output
                </h4>
                <pre className="text-sm text-muted-foreground">
                  <code>
                    {`🔍 Scanning project files...
✓ Found 127 files to analyze
⚡ AI Analysis in progress...

🚨 SEO Issues Found:
- 23 images missing alt text
- Meta descriptions missing on 7 pages
- No structured data for 3 product pages
- robots.txt needs optimization

💡 Run 'ezseo optimize --ai' to automatically fix these issues`}
                  </code>
                </pre>
              </div>
            </TabsContent>
            <TabsContent value="optimize" className="border rounded-lg p-6 bg-card shadow-md">
              <h3 className="text-xl font-semibold mb-4">Optimize Your Project</h3>
              <p className="mb-6 text-muted-foreground">
                Automatically apply SEO fixes and generate optimized assets for your website.
              </p>
              <CodeBlock language="bash" code={optimizeCommand} />
              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-md">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Generated Files
                </h4>
                <pre className="text-sm text-muted-foreground">
                  <code>
                    {`/seo
├── structured-data
│   ├── product.json
│   ├── article.json
│   └── faq.json
├── robots.txt
└── sitemap.xml`}
                  </code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="max-w-4xl mx-auto mt-16">
            <h3 className="text-xl font-semibold mb-4">Configuration</h3>
            <p className="mb-6 text-muted-foreground">
              Customize ezseo with a simple JSON configuration file in your project root
            </p>
            <CodeBlock language="json" code={configExample} />
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <section className="container py-20" id="pricing">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple Pricing Model</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Dual licensing with open source and commercial options
          </p>
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
            <div className="text-3xl font-bold mb-6">$19<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
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
      
      {/* FAQ Section */}
      <section className="py-20 bg-muted/30" id="faq">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          
          <div className="max-w-3xl mx-auto grid gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-2">How does the AI optimization work?</h3>
              <p className="text-muted-foreground">
                ezseo analyzes your codebase, identifies SEO issues, and uses OpenAI's models to generate appropriate fixes, 
                from descriptive alt text to structured data. The AI considers your specific content context to provide 
                tailored optimizations.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Which frameworks are supported?</h3>
              <p className="text-muted-foreground">
                ezseo works with all major JavaScript and TypeScript frameworks, including React, Next.js, Astro, Vue, and plain HTML. 
                The tool detects your project structure and adapts its analysis and fixes accordingly.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Is my code secure when using the AI features?</h3>
              <p className="text-muted-foreground">
                We take security seriously. Code sent to our AI backend is processed securely, not stored longer than needed
                for analysis, and never used to train AI models. We only process the minimal amount of code necessary to 
                provide SEO recommendations.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Can I integrate ezseo into my CI/CD pipeline?</h3>
              <p className="text-muted-foreground">
                Yes, ezseo includes CI/CD integration options for enterprise customers. You can automate SEO checks and
                fixes as part of your build process using flags like --dry-run and --yes to control the behavior in 
                automated environments.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">How is the dual licensing model structured?</h3>
              <p className="text-muted-foreground">
                The core CLI and rule-based features are open source under the AGPL license. The AI backend and premium
                features require a commercial license (Pro or Enterprise subscription), which grants you full usage rights
                for those components.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-10 border text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to optimize your website's SEO?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join developers who are boosting their search rankings with AI-powered automation
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
