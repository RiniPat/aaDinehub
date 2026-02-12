import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, UtensilsCrossed, Smartphone, Sparkles, QrCode } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="container mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg text-white">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-gray-900">
            DineHub
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="font-semibold">Log in</Button>
          </Link>
          <Link href="/register">
            <Button className="font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-display text-5xl md:text-7xl font-bold text-gray-900 leading-tight mb-6">
              Your Menu, <br />
              <span className="text-primary">Reimagined.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-lg leading-relaxed">
              Create a stunning digital menu in seconds. Generate QR codes, update items instantly, and let AI build your descriptions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="h-14 px-8 text-lg rounded-xl shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all">
                  Create Free Menu
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/menu/demo-bistro">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-xl hover:bg-gray-50">
                  View Demo
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-full filter blur-3xl opacity-30 transform translate-y-10" />
            {/* Unsplash image of delicious food on a table */}
            <img 
              src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop"
              alt="Delicious cocktail and food"
              className="relative rounded-3xl shadow-2xl border-4 border-white transform rotate-2 hover:rotate-0 transition-transform duration-500"
            />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Focus on cooking. We'll handle the digital experience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Sparkles,
                title: "AI Menu Generation",
                desc: "Stuck on descriptions? Let our AI write mouth-watering text for your dishes instantly."
              },
              {
                icon: QrCode,
                title: "Instant QR Codes",
                desc: "Download print-ready QR codes that link directly to your mobile-optimized menu."
              },
              {
                icon: Smartphone,
                title: "Mobile First Design",
                desc: "Menus look beautiful on every device. No zooming or side-scrolling required."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:border-primary/20 hover:shadow-xl transition-all"
              >
                <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary mb-6">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-display text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
