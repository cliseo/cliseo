import { Helmet } from "react-helmet";

const TermsOfService = () => {
  return (
    <div className="container mx-auto py-16 px-4 max-w-4xl">
      <Helmet>
        <title>Terms of Service - cliseo</title>
        <meta name="description" content="Terms of Service for cliseo - AI-Powered SEO Optimization Tool" />
      </Helmet>
      
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      
      <div className="prose prose-lg dark:prose-invert">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using cliseo, you agree to be bound by these Terms of Service and all applicable laws and regulations.
        </p>

        <h2>2. Use License</h2>
        <p>
          cliseo is licensed under the AGPL-3.0 license. You may use the software for both commercial and non-commercial purposes, subject to the terms of the license.
        </p>

        <h2>3. User Responsibilities</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
        </p>

        <h2>4. Service Modifications</h2>
        <p>
          cliseo reserves the right to modify or discontinue the service at any time without notice.
        </p>

        <h2>5. Limitation of Liability</h2>
        <p>
          cliseo shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
        </p>

        <h2>6. Contact</h2>
        <p>
          For any questions about these Terms of Service, please contact us at support@cliseo.com
        </p>
      </div>
    </div>
  );
};

export default TermsOfService; 