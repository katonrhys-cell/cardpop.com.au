
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, Package, ArrowRightLeft, ShieldAlert, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VerificationBadge } from '@/components/VerificationBadge.jsx';

const VaultDropdown = ({ isMobile = false }) => {
  const { currentUser, logout, isVerified } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/');
  };

  const handleMouseEnter = () => {
    if (isMobile) return;
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  const handleClick = (e) => {
    if (isMobile) {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  if (!currentUser) return null;

  return (
    <div 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
      className={isMobile ? "w-full" : ""}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          {isMobile ? (
            <Button 
              variant="ghost" 
              className="w-full justify-start h-14 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/50"
              onClick={handleClick}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                  {currentUser.avatar ? (
                    <img 
                      src={pb.files.getUrl(currentUser, currentUser.avatar)} 
                      alt={currentUser.name} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex flex-col items-start overflow-hidden flex-1">
                  <span className="text-sm font-bold truncate w-full text-left">{currentUser.name || 'Collector'}</span>
                  <span className="text-xs text-muted-foreground truncate w-full text-left">View Profile Options</span>
                </div>
              </div>
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              className="relative h-10 w-10 rounded-full border border-border/50 bg-background/50 hover:bg-accent"
              onClick={handleClick}
            >
              {currentUser.avatar ? (
                <img 
                  src={pb.files.getUrl(currentUser, currentUser.avatar)} 
                  alt={currentUser.name} 
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-foreground" />
              )}
              {isVerified && (
                <div className="absolute -top-1 -right-1">
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-emerald-500 text-white border-2 border-background shadow-sm hover:bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                  </Badge>
                </div>
              )}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className={isMobile ? "w-[calc(100vw-2rem)] sm:w-[318px] mb-2" : "w-56"} 
          align={isMobile ? "center" : "end"} 
          sideOffset={8}
          forceMount
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none flex items-center gap-2">
                {currentUser.name || 'Collector'}
                <VerificationBadge is_verified={isVerified} className="h-4 px-1 py-0" />
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {currentUser.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {!isVerified && (
            <>
              <DropdownMenuItem asChild className="bg-muted/50 text-muted-foreground focus:bg-muted cursor-pointer">
                <Link to="/account/security" className="flex items-center w-full" onClick={() => setIsOpen(false)}>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  <span>Verify account</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem asChild className="cursor-pointer py-2.5">
            <Link to="/account" className="flex items-center w-full" onClick={() => setIsOpen(false)}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer py-2.5">
            <Link to="/my-vault" className="flex items-center w-full" onClick={() => setIsOpen(false)}>
              <Package className="mr-2 h-4 w-4" />
              <span>My Vault</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer py-2.5">
            <Link to="/trade-requests" className="flex items-center w-full" onClick={() => setIsOpen(false)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              <span>Trade Requests</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer py-2.5">
            <Link to="/account/profile" className="flex items-center w-full" onClick={() => setIsOpen(false)}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Account Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer py-2.5 text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default VaultDropdown;
