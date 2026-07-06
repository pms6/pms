import Header from "./Shared/Header";
import Hero from "./Components/Hero";
import PropertiesSection from "./Components/PropertiesSection";
import Pricing from "./Components/Pricing";
import CTA from "./Components/CTA";
import Footer from "./Shared/Footer";

export default function Home() {
  
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F253B]">
      
      <Header />

      <Hero />

      <PropertiesSection />

      <Pricing />
      
      <CTA />

      <Footer />
      
    </div>
  );
}