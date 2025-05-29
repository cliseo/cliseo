import { Helmet } from "react-helmet";
import React from "react";

const ORBIT_SHAPES = [
  {
    color: "from-green-400 to-blue-400",
    size: "w-16 h-16",
    delay: "0s",
    radius: "22vw",
    blur: "blur",
    tilt: "rotateX(0deg)"
  },
  {
    color: "from-purple-500 to-blue-400",
    size: "w-20 h-20",
    delay: "0.3s",
    radius: "28vw",
    blur: "blur-sm",
    tilt: "rotateX(18deg)"
  },
  {
    color: "from-pink-400 to-purple-500",
    size: "w-12 h-12",
    delay: "0.6s",
    radius: "34vw",
    blur: "",
    tilt: "rotateY(12deg)"
  },
  {
    color: "from-yellow-400 to-green-400",
    size: "w-14 h-14",
    delay: "0.9s",
    radius: "26vw",
    blur: "blur-sm",
    tilt: "rotateX(10deg) rotateY(10deg)"
  },
  {
    color: "from-cyan-400 to-blue-400",
    size: "w-10 h-10",
    delay: "1.2s",
    radius: "30vw",
    blur: "",
    tilt: "rotateY(-14deg)"
  }
];

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1520] via-[#1a3b4d] to-[#161718] text-white relative overflow-hidden">
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
    {/* Animated SVG background */}
    <svg
      className="absolute top-0 left-0 w-full h-full opacity-10 animate-pulse"
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ zIndex: 0 }}
    >
      <circle cx="400" cy="300" r="200" fill="url(#paint0_radial)" />
      <defs>
        <radialGradient
          id="paint0_radial"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(400 300) rotate(90) scale(200)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#00ffea" />
          <stop offset="1" stopColor="#161718" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
    {/* Orbiting shapes */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <div className="relative w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] min-w-[300px] min-h-[300px]">
        {ORBIT_SHAPES.map((shape, i) => (
          <div
            key={i}
            className={`absolute top-1/2 left-1/2 ${shape.size} -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br ${shape.color} opacity-80 ${shape.blur} animate-orbit`}
            style={
              {
                animationDelay: shape.delay,
                animationDuration: `${10 + i * 2}s`,
                zIndex: 1,
                "--orbit-angle": `${(i / ORBIT_SHAPES.length) * 360}deg`,
                "--orbit-radius": shape.radius,
                transform: `${shape.tilt}`
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
    <div className="relative z-10 flex flex-col items-center">
      <h1 className="text-8xl font-extrabold tracking-tight bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-lg animate-fade-in">
        404
      </h1>
      <p className="text-2xl md:text-3xl font-semibold mt-4 mb-8 animate-fade-in-slow">
        Oops! How did you end up here?
      </p>
      <a
        href="/"
        className="px-8 py-3 rounded-full bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 text-white font-bold shadow-lg hover:scale-105 transition-transform duration-200 animate-fade-in-slower"
      >
        Return Home
      </a>
    </div>
    {/* Futuristic floating shapes at the bottom */}
    <div className="absolute bottom-0 left-0 w-full flex justify-between px-8 pb-8 z-0 pointer-events-none">
      <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-blue-400 rounded-full blur-2xl opacity-30 animate-bounce-slow" />
      <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-400 rounded-full blur-2xl opacity-30 animate-bounce-slower" />
    </div>
    <style>
      {`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(40px);}
          to { opacity: 1; transform: translateY(0);}
        }
        .animate-fade-in { animation: fade-in 1s cubic-bezier(.4,0,.2,1) both; }
        .animate-fade-in-slow { animation: fade-in 1.5s cubic-bezier(.4,0,.2,1) both; }
        .animate-fade-in-slower { animation: fade-in 2s cubic-bezier(.4,0,.2,1) both; }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0);}
          50% { transform: translateY(-20px);}
        }
        .animate-bounce-slow { animation: bounce-slow 4s infinite; }
        .animate-bounce-slower { animation: bounce-slow 6s infinite; }
        @keyframes orbit {
          from {
            transform: rotate(var(--orbit-angle, 0deg)) translateX(var(--orbit-radius, 30vw)) rotate(calc(-1 * var(--orbit-angle, 0deg)));
          }
          to {
            transform: rotate(calc(360deg + var(--orbit-angle, 0deg))) translateX(var(--orbit-radius, 30vw)) rotate(calc(-360deg - var(--orbit-angle, 0deg)));
          }
        }
        .animate-orbit {
          animation-name: orbit;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-play-state: running;
        }
      `}
    </style>
  </div>
);

export default NotFound;
