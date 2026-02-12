import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import OpenAI from "openai";
import QRCode from "qrcode";

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("No OpenAI API key configured. Set OPENAI_API_KEY in Railway variables.");
    openaiClient = new OpenAI({
      apiKey,
      ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
    });
  }
  return openaiClient;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const SessionStore = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 },
    store: new SessionStore({ checkPeriod: 86400000 }),
  }));

  // Auth Middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session.userId) {
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  };

  // Auth Routes
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(input);
      (req.session as any).userId = user.id;
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(input.username);
      if (!user || user.password !== input.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      (req.session as any).userId = user.id;
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!(req.session as any).userId) return res.status(401).json(null);
    const user = await storage.getUser((req.session as any).userId);
    res.json(user || null);
  });

  // Restaurant Routes
  app.post(api.restaurants.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.restaurants.create.input.parse(req.body);
      // Check slug uniqueness logic could be here, but DB will throw too.
      // Basic duplicate check for slug:
      const existing = await storage.getRestaurantBySlug(input.slug);
      if (existing) {
        return res.status(400).json({ message: "Restaurant slug already exists" });
      }

      const restaurant = await storage.createRestaurant({
        ...input,
        userId: (req.session as any).userId,
      });
      res.status(201).json(restaurant);
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.restaurants.list.path, isAuthenticated, async (req, res) => {
    const restaurants = await storage.getRestaurantsByUser((req.session as any).userId);
    res.json(restaurants);
  });

  app.get(api.restaurants.get.path, async (req, res) => {
    const restaurant = await storage.getRestaurant(parseInt(req.params.id));
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    res.json(restaurant);
  });

  app.get(api.restaurants.getBySlug.path, async (req, res) => {
    const restaurant = await storage.getRestaurantBySlug(req.params.slug);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    res.json(restaurant);
  });

  // Menu Routes
  app.get(api.menus.list.path, async (req, res) => {
    const menus = await storage.getMenus(parseInt(req.params.restaurantId));
    res.json(menus);
  });

  app.post(api.menus.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.menus.create.input.parse(req.body);
      const menu = await storage.createMenu(input);
      res.status(201).json(menu);
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.menus.get.path, async (req, res) => {
    const menu = await storage.getMenu(parseInt(req.params.id));
    if (!menu) return res.status(404).json({ message: "Menu not found" });
    res.json(menu);
  });

  // Menu Item Routes
  app.post(api.menuItems.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.menuItems.create.input.parse(req.body);
      const item = await storage.createMenuItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.menuItems.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.menuItems.update.input.parse(req.body);
      const item = await storage.updateMenuItem(parseInt(req.params.id), input);
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.menuItems.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteMenuItem(parseInt(req.params.id));
    res.status(204).send();
  });

  // AI Generation
  app.post(api.menus.generate.path, isAuthenticated, async (req, res) => {
    try {
      const { cuisine, tone, restaurantId } = api.menus.generate.input.parse(req.body);
      
      const prompt = `Generate a menu for a ${cuisine} restaurant with about 15 items spread across categories (Appetizer, Main, Dessert, Drink). 
      The tone should be ${tone || "standard"}. 
      All prices must be in AED (United Arab Emirates Dirham).
      For each item, include an "imageUrl" field with a relevant food image URL using this format:
      https://source.unsplash.com/400x300/?FOOD_NAME_HERE (replace spaces with hyphens, use specific food terms).
      
      Return a JSON object with the following structure:
      {
        "name": "Menu Name",
        "description": "Menu Description",
        "items": [
          {
            "name": "Item Name",
            "description": "Brief 1-line description",
            "price": "45.00",
            "category": "Appetizer" | "Main" | "Dessert" | "Drink",
            "imageUrl": "https://source.unsplash.com/400x300/?spaghetti-carbonara",
            "isBestseller": true/false,
            "isChefsPick": true/false,
            "isTodaysSpecial": true/false
          }
        ]
      }
      Rules: Mark 2-3 items as bestseller, 2 as chef's pick, 1-2 as today's special. Generate around 15 items total. Keep descriptions short (one line). Prices should be realistic in AED (e.g. appetizers 25-55 AED, mains 45-120 AED, desserts 25-50 AED, drinks 15-40 AED).
      Make imageUrl specific to each dish - use the dish name in the URL with hyphens.
      Do not include any markdown formatting.`;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant that generates restaurant menus in JSON format. Always use AED currency for prices." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No content generated");
      
      const generatedData = JSON.parse(content);
      
      // We could save it here, but for now we return it so the user can review/edit/save
      res.json(generatedData);

    } catch (err) {
      console.error("AI Generation Error:", err);
      res.status(500).json({ message: "Failed to generate menu" });
    }
  });

  // QR Code
  app.get(api.qr.generate.path, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.id);
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

      const host = req.get("host");
      const protocol = req.protocol;
      const url = `${protocol}://${host}/menu/${restaurant.slug}`;
      
      const qrCodeUrl = await QRCode.toDataURL(url);
      res.json({ qrCodeUrl });
    } catch (err) {
      console.error("QR Code Generation Error:", err);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Seeding - Demo restaurant for landing page
  const existingDemo = await storage.getRestaurantBySlug("demo-bistro");
  if (!existingDemo) {
    const existingUser = await storage.getUserByUsername("admin");
    const user = existingUser || await storage.createUser({ username: "admin", password: "password" });
    
    const demoRestaurant = await storage.createRestaurant({
      userId: user.id,
      name: "The Golden Fork",
      slug: "demo-bistro",
      address: "Downtown Dubai, UAE",
      cuisineType: "Mediterranean",
      description: "A modern Mediterranean bistro serving fresh, vibrant dishes with a Middle Eastern twist.",
      tableCount: 12,
    });
    const demoMenu = await storage.createMenu({
      restaurantId: demoRestaurant.id,
      name: "Signature Menu",
      description: "Our chef's handpicked selection of Mediterranean & Middle Eastern favorites",
    });

    const demoItems = [
      { name: "Truffle Hummus", description: "Creamy chickpea hummus drizzled with truffle oil, served with warm pita.", price: "38.00", category: "Appetizer", imageUrl: "https://images.unsplash.com/photo-1637361973-e2ef1e177713?w=400&h=300&fit=crop", isBestseller: true },
      { name: "Grilled Halloumi Salad", description: "Crispy halloumi over mixed greens with pomegranate and za'atar dressing.", price: "45.00", category: "Appetizer", imageUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop", isChefsPick: true },
      { name: "Lamb Kibbeh", description: "Crispy fried lamb and bulgur croquettes with yogurt mint dip.", price: "42.00", category: "Appetizer", imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop" },
      { name: "Seafood Risotto", description: "Arborio rice with prawns, calamari, and saffron broth. Finished with parmesan.", price: "95.00", category: "Main", imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop", isBestseller: true },
      { name: "Grilled Lamb Chops", description: "New Zealand lamb chops with rosemary jus, roasted vegetables, and mashed potato.", price: "120.00", category: "Main", imageUrl: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&h=300&fit=crop", isChefsPick: true },
      { name: "Pan-Seared Salmon", description: "Atlantic salmon with lemon butter sauce, asparagus, and quinoa pilaf.", price: "98.00", category: "Main", imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop" },
      { name: "Chicken Shawarma Plate", description: "Marinated chicken with garlic sauce, pickles, fries, and fresh tabouleh.", price: "65.00", category: "Main", imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400&h=300&fit=crop", isTodaysSpecial: true },
      { name: "Truffle Mushroom Pasta", description: "Fresh pappardelle with wild mushroom ragout and shaved black truffle.", price: "85.00", category: "Main", imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop" },
      { name: "Kunafa Cheesecake", description: "Fusion dessert blending crispy kunafa with creamy New York cheesecake.", price: "42.00", category: "Dessert", imageUrl: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop", isBestseller: true },
      { name: "Pistachio Baklava", description: "Layers of golden phyllo pastry with crushed pistachios and rose syrup.", price: "35.00", category: "Dessert", imageUrl: "https://images.unsplash.com/photo-1519676867240-f03562e64571?w=400&h=300&fit=crop" },
      { name: "Chocolate Lava Cake", description: "Warm chocolate fondant with vanilla bean ice cream and berry coulis.", price: "48.00", category: "Dessert", imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&h=300&fit=crop", isChefsPick: true },
      { name: "Fresh Mint Lemonade", description: "House-made lemonade with fresh mint leaves and a hint of rose water.", price: "22.00", category: "Drink", imageUrl: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&h=300&fit=crop" },
      { name: "Turkish Coffee", description: "Traditional slow-brewed Turkish coffee served with dates.", price: "18.00", category: "Drink", imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefda?w=400&h=300&fit=crop" },
      { name: "Mango Lassi", description: "Chilled yogurt smoothie with Alphonso mango and a touch of cardamom.", price: "25.00", category: "Drink", imageUrl: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&h=300&fit=crop", isTodaysSpecial: true },
    ];

    for (const item of demoItems) {
      await storage.createMenuItem({
        menuId: demoMenu.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        imageUrl: item.imageUrl,
        isAvailable: true,
        isBestseller: item.isBestseller || false,
        isChefsPick: item.isChefsPick || false,
        isTodaysSpecial: item.isTodaysSpecial || false,
      });
    }
  }

  return httpServer;
}
