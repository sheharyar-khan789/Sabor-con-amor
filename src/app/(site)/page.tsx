import type { Metadata } from "next";
import Hero from "@/components/Hero";
import About from "@/components/About";
import VenueShowcase from "@/components/VenueShowcase";
import DecorReels from "@/components/DecorReels";
import Events from "@/components/Events";
import Menus from "@/components/Menus";
import Gallery from "@/components/Gallery";
import Amenities from "@/components/Amenities";
import Reviews from "@/components/Reviews";
import Location from "@/components/Location";
import FinalCta from "@/components/FinalCta";
import { business } from "@/lib/config";
import { pageMetadata } from "@/lib/seo";

// Only facts from the venue's own signage; location and services are added once confirmed.
export const metadata: Metadata = pageMetadata({
  title: `${business.name} | Banquet Hall, Restaurant & Rooftop BBQ`,
  absoluteTitle: true,
  description: `${business.name}: banquet hall, restaurant and rooftop BBQ.`,
  path: "/",
});

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <VenueShowcase />
      <DecorReels />
      <Events />
      <Menus />
      <Gallery />
      <Amenities />
      <Reviews />
      <Location />
      <FinalCta />
    </>
  );
}
