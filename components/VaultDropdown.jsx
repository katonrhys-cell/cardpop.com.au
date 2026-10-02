import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, Package, ArrowRightLeft, ShieldAlert, LayoutDashboard, Check, CalendarDays, Tv2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VerificationBadge } from '@/components/VerificationBadge.jsx';
import { toCdnUrl } from '@/utils/imageUrl.js';

const VaultDropdown = ({ isMobile = false }) => {
  const { currentUser, logout, isVerified, isAdmin } = useAuth();
  const { settings } = usePlatformSettings();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!currentUser) return null;

  const displayName = currentUser.display_name || currentUser.name || 'Collector';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isMobile ? (
          <Button
            variant="ghost"
            className="w-full justify-start h-14 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/50"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                {currentUser.avatar_url ? (
                  <img
                    src={toCdnUrl(currentUser.avatar_url)}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex flex-col items-start overflow-hidden flex-1">
                <span className="text-sm font-bold truncate w-full text-left">{displayName}</span>
                <span className="text-xs text-muted-foreground truncate w-full text-left">View Profile Options</span>
              </div>
            </div>
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full border border-border/50 bg-background/50 hover:bg-accent"
          >
            {currentUser.avatar_url ? (
              <img
                src={toCdnUrl(currentUser.avatar_url)}
                alt={displayName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-foreground" />
            )}
            {isVerified && (
              // Sits on the avatar's rim at the bottom-right (the 45° point of a
              // 40px circle is ~6px in from the box corner), not at the corner
              // of the square button box, where it floated outside the circle.
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-background"
                aria-label="Verified"
                role="img"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
              </span>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={isMobile ? 'w-[calc(100vw-2rem)] sm:w-[318px] mb-2' : 'w-56'}
        align={isMobile ? 'center' : 'end'}
        sideOffset={8}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none flex items-center gap-2">
              {displayName}
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
              <Link to="/verify-identity" className="flex items-center w-full">
                <ShieldAlert className="mr-2 h-4 w-4" />
                <span>Verify account</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {isAdmin && (
          <>
            <DropdownMenuItem asChild className="cursor-pointer py-2.5 text-amber-600 focus:text-amber-600">
              <Link to="/admin" className="flex items-center w-full">
                <ShieldAlert className="mr-2 h-4 w-4" />
                <span>Admin Portal</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild className="cursor-pointer py-2.5">
          <Link to="/account" className="flex items-center w-full">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer py-2.5">
          <Link to="/my-vault" className="flex items-center w-full">
            <Package className="mr-2 h-4 w-4" />
            <span>My Vault</span>
          </Link>
        </DropdownMenuItem>
        {settings.enable_trading !== false && (
          <DropdownMenuItem asChild className="cursor-pointer py-2.5">
            <Link to="/trade-requests" className="flex items-center w-full">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              <span>Trade Requests</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="cursor-pointer py-2.5">
          <Link to="/account/events" className="flex items-center w-full">
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>My Events</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer py-2.5">
          <Link to="/account/shows" className="flex items-center w-full">
            <Tv2 className="mr-2 h-4 w-4" />
            <span>My Shows</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer py-2.5">
          <Link to="/account/profile" className="flex items-center w-full">
            <Settings className="mr-2 h-4 w-4" />
            <span>Account Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VaultDropdown;
