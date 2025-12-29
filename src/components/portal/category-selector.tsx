"use client";

import { useState } from "react";
import { 
  Coins, 
  BookOpen, 
  Trophy, 
  Clock, 
  Gem, 
  Package,
  LucideIcon 
} from "lucide-react";

export interface CategoryOption {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  examples: string[];
  color: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: "coins-currency",
    name: "Coins & Currency",
    description: "Coins, paper money, bullion, tokens",
    icon: Coins,
    examples: ["Morgan Dollars", "Gold Eagles", "Vintage Bills", "World Coins"],
    color: "from-amber-500 to-yellow-600",
  },
  {
    id: "comics",
    name: "Comics",
    description: "Comic books, graphic novels, manga",
    icon: BookOpen,
    examples: ["Golden Age", "Silver Age", "Modern Keys", "CGC Slabs"],
    color: "from-red-500 to-rose-600",
  },
  {
    id: "sports",
    name: "Sports Cards & Memorabilia",
    description: "Trading cards, autographs, game-used items",
    icon: Trophy,
    examples: ["Baseball Cards", "Football", "Basketball", "Signed Items"],
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "vintage",
    name: "Vintage Items",
    description: "Antiques, retro collectibles, toys",
    icon: Clock,
    examples: ["Vintage Toys", "Antiques", "Mid-Century", "Advertising"],
    color: "from-purple-500 to-violet-600",
  },
  {
    id: "jewelry",
    name: "Jewelry",
    description: "Fine jewelry, watches, precious metals",
    icon: Gem,
    examples: ["Watches", "Rings", "Necklaces", "Estate Jewelry"],
    color: "from-blue-500 to-cyan-600",
  },
  {
    id: "misc",
    name: "Misc Collectibles",
    description: "Pokemon, vinyl, art, other collectibles",
    icon: Package,
    examples: ["Pokemon Cards", "Vinyl Records", "Art", "Sneakers"],
    color: "from-orange-500 to-amber-600",
  },
];

interface CategorySelectorProps {
  onSelect: (category: CategoryOption) => void;
}

export function CategorySelector({ onSelect }: CategorySelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORIES.map((category) => {
        const Icon = category.icon;
        const isHovered = hoveredId === category.id;
        
        return (
          <button
            key={category.id}
            onClick={() => onSelect(category)}
            onMouseEnter={() => setHoveredId(category.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`
              relative overflow-hidden rounded-2xl p-6 text-left
              transition-all duration-300 ease-out
              ${isHovered ? "scale-[1.02] shadow-2xl" : "shadow-lg"}
              bg-gradient-to-br ${category.color}
              text-white
            `}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/20" />
              <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-black/10" />
            </div>

            {/* Content */}
            <div className="relative z-10">
              <div className={`
                mb-4 inline-flex rounded-xl bg-white/20 p-3
                transition-transform duration-300
                ${isHovered ? "scale-110" : ""}
              `}>
                <Icon className="h-8 w-8" />
              </div>

              <h3 className="text-xl font-bold">{category.name}</h3>
              <p className="mt-1 text-sm text-white/80">{category.description}</p>

              {/* Examples */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {category.examples.slice(0, 3).map((example) => (
                  <span
                    key={example}
                    className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>

            {/* Hover indicator */}
            <div className={`
              absolute bottom-4 right-4 
              transition-all duration-300
              ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}
            `}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { CATEGORIES };
