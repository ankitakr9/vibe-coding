import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Download,
  History,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SignInView } from './components/SignInView';
import { InventoryTable } from './components/InventoryTable';
import { ItemDrawer } from './components/ItemDrawer';
import { LocationModal } from './components/LocationModal';
import { LocationsView } from './components/LocationsView';
import { ActivityLogView } from './components/ActivityLogView';
import {
  exportInventoryToCsv,
  formatCurrency,
  inventoryApi,
  subscribeToRealtimeUpdates,
} from './lib/api';
import {
  ITEM_CONDITIONS,
  type InventoryItem,
  type InventoryMovement,
  type InventoryQueryParams,
  type InventorySummaryMetrics,
  type ItemFormPayload,
  type ItemSortBy,
  type ItemStatus,
  type LocationSummary,
  type SortDirection,
} from './types/inventory';

type ActiveView = 'inventory' | 'locations' | 'low_stock' | 'activity';
type StatusFilter = 'all' | ItemStatus;

const EMPTY_SUMMARY: InventorySummaryMetrics = {
  totalItems: 0,
  totalUnits: 0,
  totalValueCents: 0,
  attentionCount: 0,
  lentCount: 0,
};

function InventoryWorkspace() {
  const { user, signOutUser } = useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('inventory');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummaryMetrics>(EMPTY_SUMMARY);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [queryRefreshing, setQueryRefreshing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [adjustingIds, setAdjustingIds] = useState<Record<number, boolean>>({});

  // Server-backed Search, Filtering & Sorting state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState<number | 'unassigned' | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [minPriceDollars, setMinPriceDollars] = useState('');
  const [maxPriceDollars, setMaxPriceDollars] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<ItemSortBy>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Modals & Drawers
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: 'item'; id: number; name: string }
    | { type: 'location'; id: number; name: string }
    | null
  >(null);

  // Debounce text search so PostgreSQL queries stay snappy and low-noise
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams = useMemo<InventoryQueryParams>(() => {
    const minVal =
      minPriceDollars.trim() !== '' && Number.isFinite(Number(minPriceDollars))
        ? Math.max(0, Math.round(Number(minPriceDollars) * 100))
        : null;
    const maxVal =
      maxPriceDollars.trim() !== '' && Number.isFinite(Number(maxPriceDollars))
        ? Math.max(0, Math.round(Number(maxPriceDollars) * 100))
        : null;

    return {
      q: debouncedSearch || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      condition: conditionFilter !== 'all' ? conditionFilter : undefined,
      locationId: locationFilter,
      status: activeView === 'low_stock' ? 'needs_restock' : statusFilter,
      minValueCents: minVal,
      maxValueCents: maxVal,
      sortBy,
      sortDir,
    };
  }, [
    debouncedSearch,
    categoryFilter,
    conditionFilter,
    locationFilter,
    activeView,
    statusFilter,
    minPriceDollars,
    maxPriceDollars,
    sortBy,
    sortDir,
  ]);

  const latestParamsRef = useRef<InventoryQueryParams>(queryParams);
  latestParamsRef.current = queryParams;

  const fetchItemsOnly = useCallback(
    async (params: InventoryQueryParams, isInitial = false) => {
      if (!isInitial) setQueryRefreshing(true);
      try {
        const res = await inventoryApi.listItems(params);
        setItems(res.items);
        setSummary(res.summary);
        setCategories(res.categories);
        setErrorBanner(null);
      } catch (err: unknown) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Unable to query inventory items.'
        );
      } finally {
        if (!isInitial) setQueryRefreshing(false);
      }
    },
    []
  );

  const fetchAuxData = useCallback(async () => {
    try {
      const [fetchedLocations, fetchedMovements] = await Promise.all([
        inventoryApi.listLocations(),
        inventoryApi.listMovements(undefined, 80),
      ]);
      setLocations(fetchedLocations);
      setMovements(fetchedMovements);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to load workspace data.'
      );
    }
  }, []);

  const refreshEverything = useCallback(
    async (silent = true) => {
      if (!silent) setInitialLoading(true);
      await Promise.all([
        fetchItemsOnly(latestParamsRef.current, !silent),
        fetchAuxData(),
      ]);
      if (!silent) setInitialLoading(false);
    },
    [fetchItemsOnly, fetchAuxData]
  );

  // Initial load on sign-in
  useEffect(() => {
    void refreshEverything(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Re-query PostgreSQL whenever search/filter/sort changes (after initial load)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    void fetchItemsOnly(queryParams, false);
  }, [queryParams, fetchItemsOnly]);

  // Real-time live tracking subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToRealtimeUpdates(() => {
      void refreshEverything(true);
    });
    return unsubscribe;
  }, [user, refreshEverything]);

  const activeLocationObj = useMemo(
    () =>
      typeof locationFilter === 'number'
        ? locations.find((l) => l.id === locationFilter) ?? null
        : null,
    [locations, locationFilter]
  );

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (conditionFilter !== 'all') count += 1;
    if (locationFilter !== null) count += 1;
    if (minPriceDollars.trim() !== '') count += 1;
    if (maxPriceDollars.trim() !== '') count += 1;
    return count;
  }, [conditionFilter, locationFilter, minPriceDollars, maxPriceDollars]);

  const hasAnyActiveFilter =
    debouncedSearch.length > 0 ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    activeAdvancedFilterCount > 0;

  const handleSortColumn = (column: ItemSortBy) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'name' || column === 'category' ? 'asc' : 'desc');
    }
  };

  const handleSaveItem = async (payload: ItemFormPayload, itemId?: number) => {
    if (itemId != null) {
      await inventoryApi.updateItem(itemId, payload);
    } else {
      await inventoryApi.createItem(payload);
    }
    await refreshEverything(true);
  };

  const handleAdjustQuantity = async (item: InventoryItem, delta: number) => {
    setAdjustingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      await inventoryApi.adjustQuantity(item.id, delta);
      await refreshEverything(true);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to adjust stock quantity.'
      );
    } finally {
      setAdjustingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleSaveLocation = async (
    payload: { name: string; room: string; description: string },
    locationId?: number
  ) => {
    if (locationId != null) {
      await inventoryApi.updateLocation(locationId, payload);
    } else {
      await inventoryApi.createLocation(payload);
    }
    await refreshEverything(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    try {
      if (target.type === 'item') {
        await inventoryApi.deleteItem(target.id);
      } else {
        await inventoryApi.deleteLocation(target.id);
        if (locationFilter === target.id) {
          setLocationFilter(null);
        }
      }
      await refreshEverything(true);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Delete operation failed.');
    }
  };

  const handleLoadSample = async () => {
    setSeeding(true);
    try {
      await inventoryApi.seedSample();
      await refreshEverything(true);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to load sample inventory.'
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCategoryFilter('all');
    setConditionFilter('all');
    setLocationFilter(null);
    setStatusFilter('all');
    setMinPriceDollars('');
    setMaxPriceDollars('');
    if (activeView === 'low_stock') {
      setActiveView('inventory');
    }
  };

  const breadcrumbLabel =
    activeView === 'inventory'
      ? activeLocationObj
        ? `Inventory / ${activeLocationObj.name}`
        : locationFilter === 'unassigned'
        ? 'Inventory / Unassigned'
        : 'Inventory'
      : activeView === 'locations'
      ? 'Locations'
      : activeView === 'low_stock'
      ? 'Low Stock Queue'
      : 'Activity Log';

  const navItems: Array<{
    id: ActiveView;
    label: string;
    icon: typeof Package;
    count?: number;
  }> = [
    { id: 'inventory', label: 'Inventory', icon: Package, count: summary.totalItems },
    { id: 'locations', label: 'Locations', icon: MapPin, count: locations.length },
    { id: 'low_stock', label: 'Low Stock', icon: AlertTriangle, count: summary.attentionCount },
    { id: 'activity', label: 'Activity Log', icon: History },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-blue-700 text-white flex items-center justify-center shrink-0">
            <Archive className="w-3.5 h-3.5" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            StowBase
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <nav aria-label="Workspace navigation" className="space-y-0.5">
          {navItems.map((nav) => {
            const Icon = nav.icon;
            const isActive =
              activeView === nav.id && (nav.id !== 'inventory' || locationFilter === null);
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setActiveView(nav.id);
                  if (nav.id === 'inventory') setLocationFilter(null);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                  <span className="truncate">{nav.label}</span>
                </span>
                {nav.count !== undefined && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      nav.id === 'low_stock' && nav.count > 0
                        ? 'text-amber-700 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {nav.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {locations.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Spaces</span>
              <button
                type="button"
                onClick={() => {
                  setEditingLocation(null);
                  setLocationModalOpen(true);
                  setSidebarOpen(false);
                }}
                aria-label="Add storage location"
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                New
              </button>
            </div>
            <div className="space-y-0.5">
              {locations.map((loc) => {
                const selected = activeView === 'inventory' && locationFilter === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setActiveView('inventory');
                      setLocationFilter(selected ? null : loc.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 min-h-[36px] rounded-lg text-sm transition-colors ${
                      selected
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">{loc.name}</span>
                    <span className="font-mono text-xs tabular-nums text-slate-400 shrink-0">
                      {loc.itemCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 shrink-0">
        <div className="px-2 py-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">
              {user?.displayName || 'Personal Account'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOutUser()}
            title="Sign out"
            aria-label="Sign out"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/35"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                StowBase
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {breadcrumbLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {summary.totalItems > 0 && (
              <button
                type="button"
                onClick={() => exportInventoryToCsv(items)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setItemDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add Item</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto space-y-6">
          {errorBanner && (
            <div
              role="alert"
              className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4 text-sm text-red-800"
            >
              <span>{errorBanner}</span>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                aria-label="Dismiss error"
                className="text-red-600 hover:text-red-900 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4-Column Hairline-Divided Summary Strip */}
          {(activeView === 'inventory' || activeView === 'low_stock') && (
            <section
              aria-label="Inventory summary"
              className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 sm:divide-x divide-slate-200"
            >
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">Cataloged Items</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-950 tabular-nums">
                  {summary.totalItems}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Across {locations.length} location{locations.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">Total Units</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-950 tabular-nums">
                  {summary.totalUnits}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {summary.lentCount > 0
                    ? `${summary.lentCount} currently lent out`
                    : 'All units accounted for'}
                </p>
              </div>

              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">Estimated Value</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-950 tabular-nums">
                  {formatCurrency(summary.totalValueCents)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Based on recorded unit value
                </p>
              </div>

              <div className="px-5 py-4">
                <p className="text-xs font-medium text-slate-500">Needs Restock</p>
                <p
                  className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                    summary.attentionCount > 0 ? 'text-amber-700' : 'text-green-700'
                  }`}
                >
                  {summary.attentionCount}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {summary.attentionCount > 0
                    ? 'At or below minimum threshold'
                    : 'All stock levels nominal'}
                </p>
              </div>
            </section>
          )}

          {/* Inventory & Low Stock Views */}
          {(activeView === 'inventory' || activeView === 'low_stock') && (
            <section className="space-y-3.5">
              {/* Primary Search, Category, Sort & Status Toolbar */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search name, SKU, brand, serial, room, or note..."
                      aria-label="Search inventory"
                      className="w-full pl-9 pr-3 py-2 min-h-[40px] text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
                    />
                  </div>

                  <select
                    aria-label="Filter by category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 min-h-[40px] text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-700"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <div className="inline-flex items-center">
                    <select
                      aria-label="Sort inventory attribute"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as ItemSortBy)}
                      className="px-3 py-2 min-h-[40px] text-sm bg-white border border-slate-200 rounded-l-lg text-slate-700 focus:outline-none focus:border-blue-700"
                    >
                      <option value="updatedAt">Sort: Recently Updated</option>
                      <option value="name">Sort: Item Name</option>
                      <option value="category">Sort: Category</option>
                      <option value="quantity">Sort: Quantity</option>
                      <option value="unitValue">Sort: Unit Value</option>
                      <option value="totalValue">Sort: Total Value</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                      }
                      aria-label={`Sort direction: ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}
                      title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                      className="px-2.5 min-h-[40px] bg-white border border-l-0 border-slate-200 rounded-r-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors inline-flex items-center justify-center"
                    >
                      {sortDir === 'asc' ? (
                        <ArrowUpNarrowWide className="w-4 h-4" />
                      ) : (
                        <ArrowDownWideNarrow className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters((prev) => !prev)}
                    aria-expanded={showAdvancedFilters}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      showAdvancedFilters || activeAdvancedFilterCount > 0
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>
                      Filters
                      {activeAdvancedFilterCount > 0
                        ? ` (${activeAdvancedFilterCount})`
                        : ''}
                    </span>
                  </button>
                </div>

                {activeView === 'inventory' && (
                  <div
                    role="group"
                    aria-label="Filter by stock status"
                    className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full shrink-0"
                  >
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'in_stock', label: 'In Stock' },
                        { id: 'low_stock', label: 'Low Stock' },
                        { id: 'out_of_stock', label: 'Out' },
                        { id: 'lent_out', label: 'Lent Out' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          statusFilter === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Advanced Filter Panel (Condition, Space, Unit Price Range) */}
              {showAdvancedFilters && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label
                      htmlFor="filter-condition"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Condition
                    </label>
                    <select
                      id="filter-condition"
                      value={conditionFilter}
                      onChange={(e) => setConditionFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-700"
                    >
                      <option value="all">Any Condition</option>
                      {ITEM_CONDITIONS.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="filter-location"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Storage Space
                    </label>
                    <select
                      id="filter-location"
                      value={locationFilter === null ? 'all' : String(locationFilter)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'all') setLocationFilter(null);
                        else if (val === 'unassigned') setLocationFilter('unassigned');
                        else setLocationFilter(Number(val));
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-700"
                    >
                      <option value="all">All Locations</option>
                      <option value="unassigned">Unassigned Only</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.room} — {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="filter-min-price"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Min Unit Value ($)
                    </label>
                    <input
                      id="filter-min-price"
                      type="number"
                      min={0}
                      step="1"
                      value={minPriceDollars}
                      onChange={(e) => setMinPriceDollars(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="filter-max-price"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Max Unit Value ($)
                    </label>
                    <input
                      id="filter-max-price"
                      type="number"
                      min={0}
                      step="1"
                      value={maxPriceDollars}
                      onChange={(e) => setMaxPriceDollars(e.target.value)}
                      placeholder="Any"
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>
                </div>
              )}

              {/* Active Query Result Summary */}
              {summary.totalItems > 0 && hasAnyActiveFilter && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-mono tabular-nums">
                    Showing {items.length} of {summary.totalItems} items
                  </span>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              <InventoryTable
                items={items}
                totalUnfilteredCount={summary.totalItems}
                loading={initialLoading}
                refreshing={queryRefreshing}
                adjustingIds={adjustingIds}
                seeding={seeding}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortColumn={handleSortColumn}
                onAdjustQuantity={(item, delta) => void handleAdjustQuantity(item, delta)}
                onEditItem={(item) => {
                  setEditingItem(item);
                  setItemDrawerOpen(true);
                }}
                onDeleteRequest={(item) =>
                  setPendingDelete({ type: 'item', id: item.id, name: item.name })
                }
                onAddItem={() => {
                  setEditingItem(null);
                  setItemDrawerOpen(true);
                }}
                onLoadSample={() => void handleLoadSample()}
                onClearFilters={handleClearFilters}
              />
            </section>
          )}

          {activeView === 'locations' && (
            <LocationsView
              locations={locations}
              loading={initialLoading}
              onAddLocation={() => {
                setEditingLocation(null);
                setLocationModalOpen(true);
              }}
              onEditLocation={(loc) => {
                setEditingLocation(loc);
                setLocationModalOpen(true);
              }}
              onDeleteLocation={(loc) =>
                setPendingDelete({ type: 'location', id: loc.id, name: loc.name })
              }
              onFilterByLocation={(locId) => {
                setLocationFilter(locId);
                setActiveView('inventory');
              }}
            />
          )}

          {activeView === 'activity' && (
            <ActivityLogView movements={movements} loading={initialLoading} />
          )}
        </main>
      </div>

      {/* Item Slide-Over Drawer */}
      <ItemDrawer
        open={itemDrawerOpen}
        editingItem={editingItem}
        locations={locations}
        onClose={() => setItemDrawerOpen(false)}
        onSave={handleSaveItem}
      />

      {/* Location Create/Edit Modal */}
      <LocationModal
        open={locationModalOpen}
        editingLocation={editingLocation}
        onClose={() => setLocationModalOpen(false)}
        onSave={handleSaveLocation}
      />

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/35"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div
            className="fixed inset-0"
            onClick={() => setPendingDelete(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-xl p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Delete {pendingDelete.type === 'item' ? 'Inventory Item' : 'Storage Location'}?
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {pendingDelete.type === 'item'
                ? `Remove "${pendingDelete.name}" from your catalog? This action will be recorded in your activity log.`
                : `Delete "${pendingDelete.name}"? Items assigned to this space will remain in your inventory as unassigned.`}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 min-h-[40px] text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 min-h-[40px] text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-700 rounded-full animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  return user ? <InventoryWorkspace /> : <SignInView />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
