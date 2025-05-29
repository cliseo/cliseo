import { ReactNode } from 'react';
import Navbar from '../Navbar';
import Footer from '../Footer';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
};

export default MainLayout; 