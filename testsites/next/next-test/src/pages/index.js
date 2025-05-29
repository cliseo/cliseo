import Link from "next/link";
import Image from "next/image";
import Head from "next/head";
export default function Home() {
  return (
    <div>
      <Head>
        <title>{"title"}</title>
        <meta name="description" content="description" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="canonicalUrl" />
        <meta property="og:title" content="title" />
        <meta property="og:description" content="description" />
        <meta property="og:image" content="ogImage" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="canonicalUrl" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="title" />
        <meta name="twitter:description" content="description" />
        <meta name="twitter:image" content="ogImage" />
      </Head>
      <h1>Home</h1>
      <Link href="/about">About</Link>
      <Image
        src="/vercel.svg"
        width={500}
        height={300}
        alt="Image description"
      />
    </div>
  );
}
