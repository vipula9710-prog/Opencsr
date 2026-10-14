import {
  Award, Baby, BookOpen, Droplets, Globe, GraduationCap, HandHeart, HeartHandshake, Home, Laptop, Leaf, Lightbulb, Monitor, Recycle, Sprout, Stethoscope, Sun, Target, Trees, Users,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "heart-handshake": HeartHandshake,
  baby: Baby,
  leaf: Leaf,
  trees: Trees,
  sprout: Sprout,
  recycle: Recycle,
  droplets: Droplets,
  sun: Sun,
  laptop: Laptop,
  monitor: Monitor,
  users: Users,
  home: Home,
  stethoscope: Stethoscope,
  globe: Globe,
  "hand-heart": HandHeart,
  award: Award,
  target: Target,
  lightbulb: Lightbulb,
};

export function SiteIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = ICONS[name ?? ""] ?? Leaf;
  return <Icon className={className} aria-hidden />;
}
