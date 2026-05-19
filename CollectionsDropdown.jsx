import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { CollectionLogo, TradingCardGamesLogo, SportingCardsLogo, getCollectionColorVar } from './CollectionLogos.jsx';

const tcgCollections = [
  'Pokemon', 'Digimon', 'Magic', 'Yu-Gi-Oh', 'Riftbound', 
  'One Piece', 'Disney Lorcana', 'Final Fantasy'
];

const sportsCollections = [
  'NBL', 'NBA', 'NHL', 'Baseball', 'NFL', 'Cricket', 
  'NRL', 'Formula 1', 'Golf', 'Soccer', 'AFL', 'Tennis', 
  'Wrestling', 'UFC'
];

const CollectionsDropdown = ({ isMobile = false, onNavigate }) => {
  const navigate = useNavigate();

  const handleSelect = (collection) => {
    navigate(`/browse?collection=${encodeURIComponent(collection)}&tab=community`);
    if (onNavigate) onNavigate();
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 w-full font-sans">
        <div className="font-serif font-bold text-xl mb-2 text-foreground border-b border-border/50 pb-2 flex items-center gap-2">
          <TradingCardGamesLogo className="w-5 h-5" />
          Trading Card Games
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {tcgCollections.map(c => {
            const colorVar = getCollectionColorVar(c);
            return (
              <button 
                key={c} 
                onClick={() => handleSelect(c)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left text-sm font-medium transition-colors w-full group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: `hsla(var(${colorVar}) / 0.15)` }}>
                  <CollectionLogo name={c} size={16} />
                </div>
                <span className="truncate group-hover:text-foreground">{c}</span>
              </button>
            );
          })}
        </div>
        
        <div className="font-serif font-bold text-xl mb-2 text-foreground border-b border-border/50 pb-2 flex items-center gap-2">
          <SportingCardsLogo className="w-5 h-5" />
          Sporting Cards
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {sportsCollections.map(c => {
            const colorVar = getCollectionColorVar(c);
            return (
              <button 
                key={c} 
                onClick={() => handleSelect(c)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left text-sm font-medium transition-colors w-full group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: `hsla(var(${colorVar}) / 0.15)` }}>
                  <CollectionLogo name={c} size={16} />
                </div>
                <span className="truncate group-hover:text-foreground">{c}</span>
              </button>
            );
          })}
        </div>
        
        <button 
          onClick={() => handleSelect('all')}
          className="flex items-center justify-between p-4 rounded-xl bg-primary text-primary-foreground font-bold mt-2 hover:bg-primary/90 transition-colors w-full"
        >
          View All Collections
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative group flex items-center h-16 font-sans">
      <button className="flex items-center gap-1 text-sm font-semibold transition-colors hover:text-primary text-foreground/80 outline-none">
        Browse Collections
        <ChevronDown className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
      </button>

      {/* Hover mega-menu container */}
      <div className="absolute top-full -left-4 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] w-[850px] cursor-default">
        <div className="bg-popover text-popover-foreground rounded-2xl border border-border shadow-2xl p-6 max-h-[80vh] overflow-y-auto overflow-x-hidden relative">
          
          <button 
            onClick={() => handleSelect('all')} 
            className="flex items-center justify-between w-full text-left font-serif text-2xl font-bold hover:text-primary transition-colors border-b border-border/50 pb-4 mb-6 group/all"
          >
            <span>View All Listings</span>
            <ArrowRight className="w-6 h-6 text-muted-foreground group-hover/all:text-primary transition-transform group-hover/all:translate-x-1" />
          </button>
          
          <div className="flex gap-8">
            {/* TCG Column */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 font-serif text-xl font-bold text-foreground mb-4">
                <TradingCardGamesLogo className="w-6 h-6" />
                Trading Card Games
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-2">
                {tcgCollections.map(c => {
                  const colorVar = getCollectionColorVar(c);
                  return (
                    <button 
                      key={c} 
                      onClick={() => handleSelect(c)} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition-colors group/item w-full"
                    >
                      <div className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-300 group-hover/item:scale-110 shadow-sm" style={{ backgroundColor: `hsla(var(${colorVar}) / 0.15)` }}>
                        <CollectionLogo name={c} size={16} />
                      </div>
                      <span className="font-semibold text-sm truncate text-foreground/80 group-hover/item:text-foreground">{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-px bg-border/60" />

            {/* Sports Column */}
            <div className="flex-[1.2] space-y-4">
              <div className="flex items-center gap-2 font-serif text-xl font-bold text-foreground mb-4">
                <SportingCardsLogo className="w-6 h-6" />
                Sporting Cards
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-2 gap-y-2">
                {sportsCollections.map(c => {
                  const colorVar = getCollectionColorVar(c);
                  return (
                    <button 
                      key={c} 
                      onClick={() => handleSelect(c)} 
                      className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-left transition-colors group/item w-full"
                    >
                      <div className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-300 group-hover/item:scale-110 shadow-sm shrink-0" style={{ backgroundColor: `hsla(var(${colorVar}) / 0.15)` }}>
                        <CollectionLogo name={c} size={14} />
                      </div>
                      <span className="font-semibold text-sm truncate text-foreground/80 group-hover/item:text-foreground">{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default CollectionsDropdown;