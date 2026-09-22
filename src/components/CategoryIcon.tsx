import {
  ShoppingCart, Car, Home, Zap, Heart, GraduationCap, Gamepad2, Shirt, Dumbbell,
  MoreHorizontal, Store, UtensilsCrossed, Bike, Fuel, Bus, CarTaxiFront, Building2,
  Landmark, Briefcase, Lightbulb, Banknote, Laptop, Smartphone, Flame, PlayCircle,
  TrendingUp, Wifi, Coffee, Wrench, Gift, Shield, Tag, type LucideIcon,
} from 'lucide-react'

// Las categorías guardan el nombre de un ícono de Tabler (así vienen de la
// base). Acá se traducen a lucide, que ya está en el bundle, sin cargar la
// fuente de íconos por CDN. Un nombre desconocido cae en una etiqueta.
const MAP: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart, car: Car, home: Home, bolt: Zap, heart: Heart,
  school: GraduationCap, 'device-gamepad': Gamepad2, shirt: Shirt, barbell: Dumbbell,
  dots: MoreHorizontal, 'building-store': Store, 'tools-kitchen-2': UtensilsCrossed,
  motorbike: Bike, 'gas-station': Fuel, bus: Bus, taxi: CarTaxiFront, building: Building2,
  bank: Landmark, briefcase: Briefcase, bulb: Lightbulb, cash: Banknote,
  'device-laptop': Laptop, 'device-mobile': Smartphone, flame: Flame,
  'player-play': PlayCircle, 'trending-up': TrendingUp, wifi: Wifi, coffee: Coffee,
  tool: Wrench, gift: Gift, shield: Shield, tag: Tag,
}

export default function CategoryIcon({ name, size = 16, className }: {
  name?: string | null
  size?: number
  className?: string
}) {
  const Icon = (name && MAP[name]) || Tag
  return <Icon size={size} className={className} aria-hidden="true" />
}
