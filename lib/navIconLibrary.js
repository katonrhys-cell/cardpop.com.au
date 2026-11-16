// The built-in icons an admin can pick for a dropdown menu item (Admin → Menu
// Icons → Choose icon). A curated list rather than all of lucide: every name
// here is a stable identifier stored in the `nav_menu_icons` setting, so never
// rename or remove one — an override naming a missing icon quietly falls back
// to the item's own icon.
//
// This module is a lazy chunk. The menus import it only when at least one
// override actually names an icon (hooks/useNavMenuIcons.js), so the icons
// below stay out of the header's bundle for everyone else.
import {
  Archive, Award, BadgeCheck, BarChart3, Bell, Book, BookOpen, Box, Boxes, Brush, Building2,
  Calculator, Calendar, CalendarDays, Camera, ClipboardList, Clock, Coins, Compass, CreditCard, Crown,
  Dices, DollarSign, Eraser, Eye, FileText, Flag, Flame, FolderOpen, Frame, Gamepad2, Gem, Gift, Globe,
  GraduationCap, Hand, Handshake, Heart, HelpCircle, Home, Image, Info, Layers, Layers2, LayoutGrid,
  Library, Lightbulb, LineChart, Link, Lock, Mail, Map, MapPin, Medal, Megaphone, MessageSquare,
  MessagesSquare, Mic, Music, Newspaper, Package, PackageCheck, Palette, Percent, PieChart, Podcast,
  Puzzle, Rocket, Ruler, ScanLine, Search, Send, Settings, Shield, ShieldCheck, Shirt, ShoppingBag,
  ShoppingCart, Smile, Sparkle, Sparkles, Star, Store, Swords, Tag, Tags, Target, ThumbsUp, Ticket,
  TrendingUp, Trophy, Truck, Tv2, User, Users, UsersRound, Video, Wallet, Wand2, Wrench, Zap,
} from 'lucide-react';
import {
  CaptureSphereIcon, ArcaneGemIcon, MysticEyeIcon, NauticalAnchorIcon, MagicDropIcon, StarOrbIcon,
  DigitalBadgeIcon, CrystalIcon, RiftPortalIcon, TurtleShellIcon,
  CourtBallIcon, NBLBallIcon, AmericanFootballIcon, BaseballIcon, CricketIcon, RugbyBallIcon,
  AFLBallIcon, CheckeredFlagIcon, GolfIcon, SoccerBallIcon, TennisBallIcon, ChampionBeltIcon,
  OctagonIcon, HockeyIcon, TrophyCupIcon,
  CardShieldIcon, CardStorageBoxIcon, CardStandIcon, ShippingParcelIcon, GradedSlabIcon,
} from '@/components/CategoryIcons.jsx';
import WhatnotIcon from '@/components/WhatnotIcon.jsx';

const group = (name, icons) => Object.entries(icons).map(([iconName, Icon]) => ({
  name: iconName,
  // "ShoppingBag" → "Shopping Bag" — what the picker shows and searches.
  label: iconName.replace(/Icon$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
  group: name,
  Icon,
}));

export const NAV_ICON_LIBRARY = [
  ...group('Card games', {
    CaptureSphereIcon, ArcaneGemIcon, MysticEyeIcon, NauticalAnchorIcon, MagicDropIcon, StarOrbIcon,
    DigitalBadgeIcon, CrystalIcon, RiftPortalIcon, TurtleShellIcon,
  }),
  ...group('Sports', {
    CourtBallIcon, NBLBallIcon, AmericanFootballIcon, BaseballIcon, CricketIcon, RugbyBallIcon,
    AFLBallIcon, CheckeredFlagIcon, GolfIcon, SoccerBallIcon, TennisBallIcon, ChampionBeltIcon,
    OctagonIcon, HockeyIcon, TrophyCupIcon,
  }),
  ...group('Supplies', {
    CardShieldIcon, CardStorageBoxIcon, CardStandIcon, ShippingParcelIcon, GradedSlabIcon,
    Package, PackageCheck, Box, Boxes, Archive, FolderOpen, Frame, Layers, Layers2, LayoutGrid,
    Truck, Mail, Send, Ruler, Eraser, Hand, Brush, Wrench, Shirt,
  }),
  ...group('Shopping & prices', {
    Store, ShoppingBag, ShoppingCart, Tag, Tags, Percent, DollarSign, Coins, Wallet, CreditCard,
    LineChart, BarChart3, TrendingUp, PieChart, Calculator, ScanLine, Search, Target,
  }),
  ...group('Community & events', {
    Users, UsersRound, User, MessageSquare, MessagesSquare, Handshake, Calendar, CalendarDays, Ticket,
    MapPin, Map, Globe, Compass, Megaphone, Bell, Tv2, Video, Mic, Podcast, Music, Camera, Image,
    WhatnotIcon, Home, Building2,
  }),
  ...group('Awards & grading', {
    Award, Trophy, Medal, Crown, Star, Gem, BadgeCheck, ShieldCheck, Shield, Lock, ClipboardList, Eye,
    ThumbsUp, Flag,
  }),
  ...group('General', {
    Sparkles, Sparkle, Heart, Flame, Zap, Rocket, Gift, Smile, Lightbulb, Info, HelpCircle,
    BookOpen, Book, Library, Newspaper, FileText, GraduationCap, Gamepad2, Dices, Swords, Wand2,
    Puzzle, Palette, Clock, Link, Settings,
  }),
];

export const NAV_ICON_BY_NAME = Object.fromEntries(NAV_ICON_LIBRARY.map((entry) => [entry.name, entry.Icon]));
