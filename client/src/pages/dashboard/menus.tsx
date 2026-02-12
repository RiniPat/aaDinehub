import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useRestaurants, useMenus, useCreateMenu, useGenerateMenu, useCreateMenuItem, useDeleteMenuItem } from "@/hooks/use-restaurants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Sparkles, Trash2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardMenus() {
  const { data: restaurants } = useRestaurants();
  const restaurant = restaurants?.[0];
  const { data: menus, isLoading } = useMenus(restaurant?.id || 0);
  const createMenu = useCreateMenu();
  const createItem = useCreateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const generateMenu = useGenerateMenu();
  const { toast } = useToast();

  const [newMenuName, setNewMenuName] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  // Item form state
  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemBestseller, setItemBestseller] = useState(false);
  const [itemChefsPick, setItemChefsPick] = useState(false);
  const [itemTodaysSpecial, setItemTodaysSpecial] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  // AI Generation state
  const [aiCuisine, setAiCuisine] = useState("");
  const [aiTone, setAiTone] = useState("Fancy");
  const [isAiOpen, setIsAiOpen] = useState(false);

  if (!restaurant) return null;

  const handleCreateMenu = async () => {
    if (!newMenuName) return;
    await createMenu.mutateAsync({ 
      restaurantId: restaurant.id, 
      name: newMenuName,
      description: "",
      isActive: true 
    });
    setNewMenuName("");
    setIsCreateOpen(false);
  };

  const handleAddItem = async () => {
    if (!selectedMenuId) return;
    await createItem.mutateAsync({
      menuId: parseInt(selectedMenuId),
      name: itemName,
      description: itemDesc,
      price: itemPrice,
      category: itemCategory,
      imageUrl: itemImage,
      isAvailable: true,
      isBestseller: itemBestseller,
      isChefsPick: itemChefsPick,
      isTodaysSpecial: itemTodaysSpecial,
    });
    // Reset form
    setItemName("");
    setItemDesc("");
    setItemPrice("");
    setItemCategory("");
    setItemImage("");
    setItemBestseller(false);
    setItemChefsPick(false);
    setItemTodaysSpecial(false);
    setIsAddItemOpen(false);
  };

  const handleAiGenerate = async () => {
    if (!aiCuisine) return;
    const result = await generateMenu.mutateAsync({
      restaurantId: restaurant.id,
      cuisine: aiCuisine,
      tone: aiTone
    });
    
    // Create new menu first
    const menu = await createMenu.mutateAsync({
      restaurantId: restaurant.id,
      name: result.name,
      description: result.description,
      isActive: true
    });

    // Add all generated items
    for (const item of result.items) {
      await createItem.mutateAsync({
        ...item,
        menuId: menu.id,
        isBestseller: item.isBestseller || false,
        isChefsPick: item.isChefsPick || false,
        isTodaysSpecial: item.isTodaysSpecial || false,
      });
    }
    
    setIsAiOpen(false);
    toast({ title: "Magic Complete!", description: "Your AI menu has been generated." });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Menus</h1>
          <p className="text-gray-500 mt-1">Manage your food and drink offerings.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                AI Generate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Menu with AI</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Cuisine Type</Label>
                  <Input 
                    placeholder="e.g. Mexican, French Bistro" 
                    value={aiCuisine}
                    onChange={e => setAiCuisine(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Input 
                    placeholder="e.g. Casual, Fine Dining, Fun" 
                    value={aiTone}
                    onChange={e => setAiTone(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAiGenerate} disabled={generateMenu.isPending}>
                  {generateMenu.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Magic
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Menu
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Menu</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Label>Menu Name</Label>
                <Input 
                  placeholder="e.g. Dinner Menu" 
                  value={newMenuName}
                  onChange={e => setNewMenuName(e.target.value)}
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleCreateMenu} disabled={createMenu.isPending}>
                  {createMenu.isPending ? "Creating..." : "Create Menu"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : menus?.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No menus yet</h3>
          <p className="text-gray-500 mb-6">Create your first menu manually or use AI magic.</p>
          <Button onClick={() => setIsCreateOpen(true)}>Create Menu</Button>
        </div>
      ) : (
        <Tabs defaultValue={menus?.[0]?.id.toString()} onValueChange={setSelectedMenuId} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b border-gray-200 rounded-none p-0 h-auto mb-6">
            {menus?.map(menu => (
              <TabsTrigger 
                key={menu.id} 
                value={menu.id.toString()}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                {menu.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {menus?.map(menu => (
            <TabsContent key={menu.id} value={menu.id.toString()} className="mt-0">
              <div className="flex justify-end mb-6">
                <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedMenuId(menu.id.toString())}>
                      <Plus className="w-4 h-4 mr-2" /> Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Menu Item</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Burger" />
                        </div>
                        <div className="space-y-2">
                          <Label>Price</Label>
                          <Input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="$15.00" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input value={itemCategory} onChange={e => setItemCategory(e.target.value)} placeholder="Mains" />
                      </div>
                      <div className="space-y-2">
                        <Label>Image URL (Optional)</Label>
                        <Input value={itemImage} onChange={e => setItemImage(e.target.value)} placeholder="https://..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Juicy beef patty..." />
                      </div>
                      <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={itemBestseller} onChange={e => setItemBestseller(e.target.checked)} className="rounded" />
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">🔥 Bestseller</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={itemChefsPick} onChange={e => setItemChefsPick(e.target.checked)} className="rounded" />
                          <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">👨‍🍳 Chef's Pick</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={itemTodaysSpecial} onChange={e => setItemTodaysSpecial(e.target.checked)} className="rounded" />
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">⭐ Today's Special</span>
                        </label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddItem} disabled={createItem.isPending}>Add Item</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-6">
                {menu.items.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No items in this menu yet.</div>
                ) : (
                  // Group by category manually for display
                  Object.entries(menu.items.reduce((acc, item) => {
                    const cat = item.category || "Uncategorized";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {} as Record<string, typeof menu.items>)).map(([category, items]) => (
                    <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="bg-gray-50/50 px-6 py-3 border-b border-gray-100 font-bold text-gray-700">
                        {category}
                      </div>
                      <div className="divide-y divide-gray-100">
                        {items.map(item => (
                          <div key={item.id} className="p-6 flex items-start gap-4 hover:bg-gray-50/50 transition-colors group">
                            {item.imageUrl && (
                              <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-lg shadow-sm" />
                            )}
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <h3 className="font-bold text-gray-900">{item.name}</h3>
                                <span className="font-semibold text-primary">{item.price}</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {(item as any).isBestseller && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">🔥 Bestseller</span>}
                                {(item as any).isChefsPick && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold">👨‍🍳 Chef's Pick</span>}
                                {(item as any).isTodaysSpecial && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">⭐ Today's Special</span>}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 hover:bg-red-50"
                              onClick={() => deleteItem.mutate({ id: item.id, menuId: menu.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </DashboardLayout>
  );
}

function UtensilsCrossed(props: any) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 2 7 7" /><path d="m7 2 5 5" /><path d="M7 22 22 7" /><path d="M2.1 21.9a11 11 0 0 0 14.5-16.1" />
    </svg>
  );
}
