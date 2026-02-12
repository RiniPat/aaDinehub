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
      Return a JSON object with the following structure:
      {
        "name": "Menu Name",
        "description": "Menu Description",
        "items": [
          {
            "name": "Item Name",
            "description": "Brief 1-line description",
            "price": "10.00",
            "category": "Appetizer" | "Main" | "Dessert" | "Drink",
            "isBestseller": true/false,
            "isChefsPick": true/false,
            "isTodaysSpecial": true/false
          }
        ]
      }
      Rules: Mark 2-3 items as bestseller, 2 as chef's pick, 1-2 as today's special. Generate around 15 items total. Keep descriptions short (one line). 
      Do not include any markdown formatting.`;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a helpful assistant that generates restaurant menus in JSON format." },
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

  // Seeding
  const existingUser = await storage.getUserByUsername("admin");
  if (!existingUser) {
    const user = await storage.createUser({ username: "admin", password: "password" });
    const restaurant = await storage.createRestaurant({
      userId: user.id,
      name: "The Tasty Spoon",
      slug: "tasty-spoon",
      address: "123 Main St",
      cuisineType: "Italian",
      description: "Authentic Italian cuisine",
    });
    const menu = await storage.createMenu({
      restaurantId: restaurant.id,
      name: "Dinner Menu",
      description: "Our classic dinner selection",
    });
    await storage.createMenuItem({
      menuId: menu.id,
      name: "Spaghetti Carbonara",
      description: "Classic Roman pasta with egg, hard cheese, cured pork, and black pepper.",
      price: "18.00",
      category: "Main",
      isAvailable: true,
    });
    await storage.createMenuItem({
      menuId: menu.id,
      name: "Tiramisu",
      description: "Coffee-flavoured Italian dessert.",
      price: "8.00",
      category: "Dessert",
      isAvailable: true,
    });
  }

  return httpServer;
}
