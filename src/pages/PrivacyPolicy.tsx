import { Helmet } from "react-helmet";

const PrivacyPolicy = () => {
  return (
    <div className="container mx-auto py-16 px-4 max-w-4xl">
      <Helmet>
        <title>Privacy Policy - cliseo</title>
        <meta name="description" content="Privacy Policy for cliseo - AI-Powered SEO Optimization Tool" />
      </Helmet>
      
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-lg dark:prose-invert">
        <h2>1. Information We Collect</h2>
        <p>
          We collect information that you provide directly to us, including your name, email address, and any other information you choose to provide.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to protect our users.
        </p>

        <h2>3. Information Sharing</h2>
        <p>
          We do not share your personal information with third parties except as described in this privacy policy.
        </p>

        <h2>4. Data Security</h2>
        <p>
          We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.
        </p>

        <h2>5. Your Rights</h2>
        <p>
          You have the right to access, correct, or delete your personal information. You can also object to our processing of your personal information.
        </p>

        <h2>6. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at privacy@cliseo.com
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 