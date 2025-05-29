import { Helmet } from "react-helmet";
import React from "react";

const Blog = () => (
  <div className="container mx-auto py-16 text-center">
    <Helmet>
      <title>Your Site Title</title>
      <meta name="description" content="Default description for this page" />
      <link rel="canonical" href="https://yourdomain.com/current-page" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            '{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "Your Site Name",\n  "url": "https://yourdomain.com",\n  "potentialAction": {\n    "@type": "SearchAction",\n    "target": "https://yourdomain.com/search?q={search_term_string}",\n    "query-input": "required name=search_term_string"\n  }\n}'
        }}
      />
    </Helmet>
    <h1 className="text-4xl font-bold mb-6">Blog</h1>
    <p className="text-lg text-muted-foreground">No blog posts yet.</p>
  </div>
);

export default Blog;
