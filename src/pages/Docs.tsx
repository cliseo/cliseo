import { CommandDisplay } from '@/components/CommandDisplay';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';

export default function Docs() {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "cliseo Documentation",
    "description": "Complete documentation for the cliseo SEO optimization tool",
    "url": window.location.href,
    "mainEntity": {
      "@type": "TechArticle",
      "headline": "cliseo Documentation",
      "description": "Learn how to use cliseo to optimize your site's SEO",
      "author": {
        "@type": "Organization",
        "name": "cliseo"
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Documentation - cliseo</title>
        <meta name="description" content="Complete documentation for the cliseo SEO optimization tool" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      </Helmet>
      <div className="max-w-3xl mx-auto py-16 px-4 text-white">
        <Link to="/" className="inline-block mb-6">
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors font-medium">← Back to Home</button>
        </Link>
        <h1 className="text-4xl font-bold mb-6">Documentation</h1>
        <h2 className="text-2xl font-semibold mt-10 mb-2">Installation</h2>
        <p className="mb-2">Install globally with npm:</p>
        <CommandDisplay command="npm install -g cliseo" />

        <h2 className="text-2xl font-semibold mt-10 mb-2">Quick Start</h2>
        <ol className="list-decimal pl-6 mb-4">
          <li className="mb-2">Scan your project for SEO issues:
            <CommandDisplay command="cliseo scan --ai" className="mt-2" />
          </li>
          <li>Apply AI-powered optimizations:
            <CommandDisplay command="cliseo optimize --ai --model=gpt-4" className="mt-2" />
          </li>
        </ol>

        <h2 className="text-2xl font-semibold mt-10 mb-2">Commands</h2>
        <div className="mb-4">
          <h3 className="text-xl font-bold mt-4 mb-1">cliseo scan</h3>
          <p>Performs an SEO audit of your project.</p>
          <ul className="list-disc pl-6 text-sm mb-2">
            <li><b>--ai</b>: Enable AI-powered deep analysis</li>
            <li><b>--verbose</b>: Show detailed output</li>
            <li><b>--json</b>: Output results in JSON format</li>
          </ul>
          <CommandDisplay command="cliseo scan --ai" />
        </div>
        <div className="mb-4">
          <h3 className="text-xl font-bold mt-4 mb-1">cliseo optimize</h3>
          <p>Automatically applies SEO fixes to your codebase.</p>
          <ul className="list-disc pl-6 text-sm mb-2">
            <li><b>--ai</b>: Use AI for generating improvements</li>
            <li><b>--dry-run</b>: Preview changes without applying</li>
            <li><b>--yes</b>: Skip confirmation prompts</li>
          </ul>
          <p className="text-sm text-gray-400 mb-2">
            After optimization, if you're in a git repository, you'll be prompted to create a Pull Request with the changes.
          </p>
          <CommandDisplay command="cliseo optimize --ai" />
        </div>

        <h2 className="text-2xl font-semibold mt-10 mb-2">Configuration</h2>
        <p className="mb-2">Create a <code>.cliseorc.json</code> in your project root:</p>
        <pre className="bg-black/40 rounded px-3 py-2 font-mono text-white text-sm mb-4 overflow-x-auto">
{`{
  "aiModel": "gpt-4",
  "createPRs": true,
  "seoDirectory": true,
  "tracking": {
    "anonymous": true,
    "searchConsole": false
  }
}`}
        </pre>

        <h2 className="text-2xl font-semibold mt-10 mb-2">SEO Directory Structure</h2>
        <pre className="bg-black/40 rounded px-3 py-2 font-mono text-white text-sm mb-4 overflow-x-auto">
{`/seo
├── structured-data/
│   ├── product.json
│   ├── article.json
├── robots.txt
└── sitemap.xml`}
        </pre>

        <h2 className="text-2xl font-semibold mt-10 mb-2">Authentication</h2>
        <ol className="list-decimal pl-6 mb-4">
          <li>Run <CommandDisplay command="cliseo auth" /></li>
          <li>Follow the prompts to complete OAuth flow</li>
          <li>Your API key will be stored securely</li>
        </ol>

        <h2 className="text-2xl font-semibold mt-10 mb-2">Analytics</h2>
        <p>Connect to Google Search Console for SEO performance tracking:</p>
        <CommandDisplay command="cliseo connect --google-search-console" />

        <h2 className="text-2xl font-semibold mt-10 mb-2">Support</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>Documentation: <a href="https://docs.cliseo.dev" className="text-cyan-300 underline">https://docs.cliseo.dev</a></li>
          <li>Issues: <a href="https://github.com/yourusername/cliseo/issues" className="text-cyan-300 underline">GitHub Issues</a></li>
          <li>Email: <a href="mailto:support@cliseo.dev" className="text-cyan-300 underline">support@cliseo.dev</a></li>
        </ul>
      </div>
    </>
  );
} 