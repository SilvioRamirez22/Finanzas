import {
  ShoppingCart, Car, Home, Zap, Heart, GraduationCap, Gamepad2, Shirt, Dumbbell,
  MoreHorizontal, Store, UtensilsCrossed, Bike, Fuel, Bus, CarTaxiFront, Building2,
  Landmark, Briefcase, Lightbulb, Banknote, Laptop, Smartphone, Flame, PlayCircle,
  TrendingUp, Wifi, Coffee, Wrench, Gift, Shield, Tag, Pill, type LucideIcon,
} from 'lucide-react'

// Las categorías guardan en `icon` un emoji (lo nuevo: "🛒") o el nombre de un
// ícono de Tabler (lo viejo: "shopping-cart"). Los nombres se traducen a lucide,
// que ya está en el bundle; un nombre desconocido cae en una etiqueta.
const MAP: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart, car: Car, home: Home, bolt: Zap, heart: Heart,
  school: GraduationCap, 'device-gamepad': Gamepad2, shirt: Shirt, barbell: Dumbbell,
  dots: MoreHorizontal, 'building-store': Store, 'tools-kitchen-2': UtensilsCrossed,
  motorbike: Bike, 'gas-station': Fuel, bus: Bus, taxi: CarTaxiFront, building: Building2,
  bank: Landmark, briefcase: Briefcase, bulb: Lightbulb, cash: Banknote,
  'device-laptop': Laptop, 'device-mobile': Smartphone, flame: Flame,
  'player-play': PlayCircle, 'trending-up': TrendingUp, wifi: Wifi, coffee: Coffee,
  tool: Wrench, gift: Gift, shield: Shield, tag: Tag, pill: Pill,
}

// Un nombre de Tabler es minúsculas, números y guiones; cualquier otra cosa se
// muestra tal cual (un emoji).
export const isEmojiIcon = (name?: string | null) => !!name && !/^[a-z0-9-]+$/.test(name)

export default function CategoryIcon({ name, size = 16, className }: {
  name?: string | null
  size?: number
  className?: string
}) {
  if (isEmojiIcon(name)) {
    return (
      <span aria-hidden="true" className={className}
        style={{ fontSize: Math.round(size * 1.15), lineHeight: 1, fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' }}>
        {name}
      </span>
    )
  }
  const Icon = (name && MAP[name]) || Tag
  return <Icon size={size} className={className} aria-hidden="true" />
}
