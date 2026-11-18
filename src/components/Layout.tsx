import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  UserCircle,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleLabel } from './StatusBadge';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  roles: Array<'admin' | 'staff' | 'maintenance'>;
  group: 'workspace' | 'admin' | 'account';
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    Icon: LayoutDashboard,
    roles: ['admin', 'staff', 'maintenance'],
    group: 'workspace',
  },
  {
    to: '/requests',
    label: 'Maintenance Requests',
    Icon: ClipboardList,
    roles: ['admin', 'staff', 'maintenance'],
    group: 'workspace',
  },
  {
    to: '/submit',
    label: 'Submit Request',
    Icon: Plus,
    roles: ['admin', 'staff'],
    group: 'workspace',
  },
  {
    to: '/reports',
    label: 'Reports & Analytics',
    Icon: BarChart3,
    roles: ['admin'],
    group: 'admin',
  },
  {
    to: '/users',
    label: 'User Management',
    Icon: Users,
    roles: ['admin'],
    group: 'admin',
  },
  {
    to: '/categories',
    label: 'Categories',
    Icon: FolderKanban,
    roles: ['admin'],
    group: 'admin',
  },
  {
    to: '/profile',
    label: 'My Profile',
    Icon: UserCircle,
    roles: ['admin', 'staff', 'maintenance'],
    group: 'account',
  },
];

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Operations Dashboard',
  '/requests': 'Maintenance Work Orders',
  '/submit': 'Submit Maintenance Request',
  '/reports': 'Management Reports & Analytics',
  '/users': 'User & Role Management',
  '/categories': 'Maintenance Categories',
  '/profile': 'Account Profile',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (!profile) return null;

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));
  const workspaceNav = visibleNav.filter((i) => i.group === 'workspace');
  const adminNav = visibleNav.filter((i) => i.group === 'admin');
  const accountNav = visibleNav.filter((i) => i.group === 'account');
  const pageTitle = ROUTE_TITLES[location.pathname] || 'MRTMIS Workspace';
  const initials = getInitials(profile.fullName);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const renderNavGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-medium text-slate-400 tracking-wide">{label}</p>
        {items.map(({ to, label: itemLabel, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                isActive
                  ? 'bg-[#0D9488] text-white'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{itemLabel}</span>
          </NavLink>
        ))}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-100">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/90 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-[#0D9488] flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="font-display font-bold text-base tracking-tight text-white block leading-none whitespace-nowrap">
              MRTMIS
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
              Maintenance Operations
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto" aria-label="Main navigation">
        {renderNavGroup('Workspace', workspaceNav)}
        {renderNavGroup('Administration', adminNav)}
        {renderNavGroup('Account', accountNav)}
      </nav>

      <div className="p-4 border-t border-slate-800/90 shrink-0 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 text-slate-100 flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile.fullName}</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              <RoleLabel role={profile.role} /> · {profile.department}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F4F6F9]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 no-print">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-full h-full z-50">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">MRTMIS</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-900 text-base sm:text-lg truncate">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {(profile.role === 'staff' || profile.role === 'admin') && location.pathname !== '/submit' && (
              <button
                type="button"
                onClick={() => navigate('/submit')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>New Request</span>
              </button>
            )}

            {/* Account Dropdown Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30 whitespace-nowrap shrink-0"
              >
                <span className="w-7 h-7 rounded bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <span className="hidden md:inline text-xs font-medium text-slate-800 max-w-[140px] truncate">
                  {profile.fullName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="User account actions"
                  className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-30"
                >
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900 truncate">{profile.fullName}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{profile.email}</p>
                    <p className="text-[11px] text-slate-600 mt-1 truncate">
                      <RoleLabel role={profile.role} /> · {profile.department}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-left transition-colors"
                    >
                      <UserCircle className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <span>Account Profile</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/requests');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-left transition-colors"
                    >
                      <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <span>Maintenance Work Orders</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
