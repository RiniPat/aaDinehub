import { useRoute, useSearch } from "wouter";
import { useRestaurantBySlug, useMenus } from "@/hooks/use-restaurants";
import { Loader2, ShoppingBag, Plus, Minus, X, Flame, ChefHat, Star, Send } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

// Cuisine theme config
const cuisineThemes: Record<string, { accent: string; bg: string; headerBg: string; badge: string; pattern: string }> = {
  italian: { accent: "#D4380D", bg: "bg-amber-50", headerBg: "from-red-900 to-amber-900", badge: "bg-red-100 text-red-700", pattern: "🍝" },
  indian: { accent: "#D97706", bg: "bg-orange-50", headerBg: "from-orange-900 to-red-900", badge: "bg-orange-100 text-orange-700", pattern: "🍛" },
  chinese: { accent: "#DC2626", bg: "bg-red-50", headerBg: "from-red-900 to-rose-950", badge: "bg-red-100 text-red-700", pattern: "🥢" },
  japanese: { accent: "#0F766E", bg: "bg-slate-50", headerBg: "from-slate-900 to-slate-800", badge: "bg-teal-100 text-teal-700", pattern: "🍣" },
  sushi: { accent: "#0F766E", bg: "bg-slate-50", headerBg: "from-slate-900 to-slate-800", badge: "bg-teal-100 text-teal-700", pattern: "🍣" },
  mexican: { accent: "#CA8A04", bg: "bg-yellow-50", headerBg: "from-green-900 to-red-900", badge: "bg-green-100 text-green-700", pattern: "🌮" },
  thai: { accent: "#9333EA", bg: "bg-purple-50", headerBg: "from-purple-900 to-pink-900", badge: "bg-purple-100 text-purple-700", pattern: "🍜" },
  american: { accent: "#2563EB", bg: "bg-blue-50", headerBg: "from-blue-900 to-slate-900", badge: "bg-blue-100 text-blue-700", pattern: "🍔" },
  burger: { accent: "#2563EB", bg: "bg-blue-50", headerBg: "from-blue-900 to-slate-900", badge: "bg-blue-100 text-blue-700", pattern: "🍔" },
  mediterranean: { accent: "#0369A1", bg: "bg-cyan-50", headerBg: "from-cyan-900 to-blue-900", badge: "bg-cyan-100 text-cyan-700", pattern: "🫒" },
  french: { accent: "#7C3AED", bg: "bg-violet-50", headerBg: "from-violet-950 to-slate-900", badge: "bg-violet-100 text-violet-700", pattern: "🥐" },
  korean: { accent: "#E11D48", bg: "bg-rose-50", headerBg: "from-rose-900 to-slate-900", badge: "bg-rose-100 text-rose-700", pattern: "🍖" },
};
const defaultTheme = { accent: "#7C3AED", bg: "bg-gray-50", headerBg: "from-gray-900 to-gray-800", badge: "bg-primary/10 text-primary", pattern: "🍽️" };

function getTheme(cuisine?: string | null) {
  if (!cuisine) return defaultTheme;
  const key = cuisine.toLowerCase().trim();
  for (const [k, v] of Object.entries(cuisineThemes)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return defaultTheme;
}

interface CartItem { id: number; name: string; price: string; qty: number; }

export default function PublicMenu() {
  const [, params] = useRoute("/menu/:slug");
  const search = useSearch();
  const tableNum = new URLSearchParams(search).get("table");
  const { data: restaurant, isLoading: restLoading, error } = useRestaurantBySlug(params?.slug || "");
  const { data: menus, isLoading: menuLoading } = useMenus(restaurant?.id || 0);

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const theme = getTheme(restaurant?.cuisineType);

  const addToCart = (item: { id: number; name: string; price: string }) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));
  };

  const cartTotal = cart.reduce((sum, c) => {
    const price = parseFloat(c.price.replace(/[^0-9.]/g, "")) || 0;
    return sum + price * c.qty;
  }, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  if (restLoading || menuLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant || !menus || menus.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold mb-2">Menu Not Found</h1>
          <p className="text-gray-500">This restaurant may not have published their menu yet.</p>
        </div>
      </div>
    );
  }

  const activeMenu = menus[0];
  const categories = ["All", ...Array.from(new Set(activeMenu.items.map(i => i.category || "Other")))];
  const filteredItems = activeCategory === "All"
    ? activeMenu.items
    : activeMenu.items.filter(i => (i.category || "Other") === activeCategory);

  return (
    <div className={`min-h-screen ${theme.bg} pb-24`}>
      {/* Header */}
      <div className={`relative h-56 md:h-72 bg-gradient-to-br ${theme.headerBg} overflow-hidden`}>
        {restaurant.coverImage ? (
          <img src={restaurant.coverImage} alt={restaurant.name} className="w-full h-full object-cover opacity-40" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-10 text-8xl select-none">
            {Array(12).fill(theme.pattern).join("  ")}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {restaurant.cuisineType && (
              <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full mb-3 ${theme.badge}`}>
                {restaurant.cuisineType}
              </span>
            )}
            <h1 className="font-display text-3xl md:text-5xl font-bold mb-1">{restaurant.name}</h1>
            <p className="text-white/70 max-w-xl text-sm md:text-base">{restaurant.description}</p>
            {tableNum && (
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                Table {tableNum}
              </span>
            )}
          </motion.div>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-4xl mx-auto px-4 -mt-5 relative z-10">
        <div className="bg-white rounded-t-3xl shadow-xl min-h-[400px]">
          {/* Categories */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-gray-100 rounded-t-3xl pt-2">
            <div className="overflow-x-auto hide-scrollbar">
              <div className="flex px-4 pt-4 pb-0 min-w-max">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-3 font-medium text-sm transition-all border-b-2 relative ${
                      activeCategory === cat
                        ? "font-bold border-current"
                        : "text-gray-500 border-transparent hover:text-gray-800"
                    }`}
                    style={activeCategory === cat ? { color: theme.accent, borderColor: theme.accent } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-4 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {filteredItems.map(item => {
                  const inCart = cart.find(c => c.id === item.id);
                  return (
                    <div key={item.id} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-display font-bold text-base text-gray-900">{item.name}</h3>
                          {(item as any).isBestseller && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold uppercase">
                              <Flame className="w-3 h-3" /> Bestseller
                            </span>
                          )}
                          {(item as any).isChefsPick && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold uppercase">
                              <ChefHat className="w-3 h-3" /> Chef's Pick
                            </span>
                          )}
                          {(item as any).isTodaysSpecial && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                              <Star className="w-3 h-3" /> Today's Special
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{item.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-bold text-sm" style={{ color: theme.accent }}>
                            {item.price.startsWith("$") ? item.price : `$${item.price}`}
                          </span>
                          {inCart ? (
                            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-1">
                              <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold w-5 text-center">{inCart.qty}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 hover:border-gray-400 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                      {item.imageUrl && (
                        <div className="shrink-0">
                          <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-xl shadow-sm border border-gray-100" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="text-center py-12 text-gray-400">No items found in this category.</div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="text-center py-6 text-gray-400 text-xs">
          Powered by <span className="font-display font-bold text-gray-500">DineHub</span>
        </div>
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setShowCart(!showCart)}
              className="w-full flex items-center justify-between px-6 py-4 rounded-2xl text-white font-bold shadow-2xl transition-all hover:scale-[1.01]"
              style={{ backgroundColor: theme.accent }}
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5" />
                <span>{cartCount} item{cartCount !== 1 ? "s" : ""}</span>
              </div>
              <span>${cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowCart(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[70vh] overflow-auto shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-bold">Your Order</h2>
                  <button onClick={() => setShowCart(false)} className="p-2 rounded-full hover:bg-gray-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {tableNum && <p className="text-sm text-gray-500 mb-4">Table {tableNum}</p>}
                <div className="space-y-4">
                  {cart.map(item => {
                    const price = parseFloat(item.price.replace(/[^0-9.]/g, "")) || 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">${price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-gray-100 rounded-full px-1">
                            <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white"><Minus className="w-3 h-3" /></button>
                            <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white"><Plus className="w-3 h-3" /></button>
                          </div>
                          <span className="font-bold text-sm w-16 text-right">${(price * item.qty).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-200 mt-6 pt-4 flex items-center justify-between">
                  <span className="font-display font-bold text-lg">Total</span>
                  <span className="font-display font-bold text-lg" style={{ color: theme.accent }}>${cartTotal.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full h-14 mt-4 text-lg font-bold rounded-2xl gap-2"
                  style={{ backgroundColor: theme.accent }}
                  onClick={() => {
                    alert(`Order placed! ${cartCount} items for $${cartTotal.toFixed(2)}${tableNum ? ` at Table ${tableNum}` : ""}`);
                    setCart([]);
                    setShowCart(false);
                  }}
                >
                  <Send className="w-5 h-5" /> Place Order
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
