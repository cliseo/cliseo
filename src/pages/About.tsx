import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Github, Globe, Linkedin } from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
  links: {
    website?: string;
    linkedin?: string;
    github?: string;
  };
}

const teamMembers: TeamMember[] = [
  {
    name: "Ryan Hermes",
    role: "Co-founder",
    bio: "bio",
    image: "/images/team/ryan.jpeg",
    links: {
      website: "https://ryanhermes.com/",
      linkedin: "https://www.linkedin.com/in/ryanhermes/",
      github: "https://github.com/ryanjhermes"
    }
  },
  {
    name: "Samuel Thorson",
    role: "Co-founder",
    bio: "bio",
    image: "/images/team/sam.jpeg",
    links: {
      website: "https://www.samuelthorson.com/",
      linkedin: "https://www.linkedin.com/in/samuel-thorson-1a8a5522b/",
      github: "https://github.com/Sthor726"
    }
  }
];

declare global {
  interface Window {
    VANTA: any;
  }
}

const About = () => {
  const [vantaEffect, setVantaEffect] = useState<any>(null);
  const vantaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vantaEffect && vantaRef.current && window.VANTA) {
      setVantaEffect(
        window.VANTA.BIRDS({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          scale: 1.00,
          scaleMobile: 1.00,
          backgroundColor: 0x0,
          color1: 0x3b59,
          color2: 0x550f,
          colorMode: "lerpGradient",
          birdSize: 1.60,
          speedLimit: 4.00,
          quantity: 4.00
        })
      );
    }

    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  return (
    <MainLayout>
      <Helmet>
        <title>About - cliseo</title>
        <meta name="description" content="Learn about cliseo, the AI-powered SEO optimization tool for developers." />
      </Helmet>
      
      <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full pointer-events-none">
        <div ref={vantaRef} className="absolute inset-0" style={{ minHeight: '100vh' }} />
      </div>
      
      <main className="container mx-auto px-4 py-16 mt-16 relative">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h1 className="text-4xl font-bold mb-6">About cliseo</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            blah blah blah
          </p>
        </div>

        {/* Team Section */}
        <div>
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {teamMembers.map((member) => (
              <div key={member.name} className="flex flex-col items-center">
                <div className="w-40 h-40 rounded-full overflow-hidden mb-6 shadow-lg ring-4 ring-primary/90">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-2xl font-semibold mb-2">{member.name}</h3>
                <p className="text-primary font-medium mb-4">{member.role}</p>
                <p className="text-muted-foreground text-center mb-6">
                  {member.bio}
                </p>
                <div className="flex gap-4">
                  {member.links.website && (
                    <a
                      href={member.links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:scale-110 transition-transform"
                    >
                      <Button variant="outline" size="icon">
                        <Globe className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  {member.links.linkedin && (
                    <a
                      href={member.links.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:scale-110 transition-transform"
                    >
                      <Button variant="outline" size="icon">
                        <Linkedin className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  {member.links.github && (
                    <a
                      href={member.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:scale-110 transition-transform"
                    >
                      <Button variant="outline" size="icon">
                        <Github className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </MainLayout>
  );
};

export default About;
