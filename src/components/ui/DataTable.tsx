import { ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Download, Filter, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Drawer, Dropdown, MenuItem } from "./basics";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

export const PAGE_SIZES = [50, 100, 200, 500, 1000, 2000, 3000, 4000, 5000];

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getId: (row: T) => string;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  sort?: { key: string; dir: "asc" | "desc" };
  onSortChange?: (s: { key: string; dir: "asc" | "desc" }) => void;
  emptyText?: ReactNode;
  footer?: ReactNode;
}

export function DataTable<T>({
  columns, rows, getId, selectable, selected: selectedProp, onSelectedChange, onRowClick, rowClassName, sort: sortProp, onSortChange, emptyText, footer,
}: TableProps<T>) {
  const [innerSort, setInnerSort] = useState<{ key: string; dir: "asc" | "desc" } | undefined>();
  const sort = sortProp ?? innerSort;
  const setSort = onSortChange ?? setInnerSort;
  const [innerSel, setInnerSel] = useState<string[]>([]);
  const selected = selectedProp ?? innerSel;
  const setSelected = onSelectedChange ?? setInnerSel;
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const val = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page >= pages) setPage(0);
  }, [page, pages]);
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const from = sorted.length ? page * pageSize + 1 : 0;
  const to = Math.min(sorted.length, (page + 1) * pageSize);
  const allIds = visible.map(getId);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.includes(id));

  const toggleSort = (key: string) =>
    setSort(sort?.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-white dark:border-white/10 dark:bg-[#12151B]">
            <tr>
              {selectable && (
                <th className="th w-10">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? selected.filter((id) => !allIds.includes(id)) : [...new Set([...selected, ...allIds])])}
                    className="h-4 w-4 rounded accent-primary"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`th ${c.className ?? ""}`} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortValue ? (
                    <button className="inline-flex items-center gap-1 uppercase hover:text-ink dark:hover:text-white" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      {sort?.key === c.key ? sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} /> : <ArrowDownUp size={11} className="opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const id = getId(row);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-line last:border-0 dark:border-white/5 ${onRowClick ? "cursor-pointer hover:bg-card dark:hover:bg-white/5" : ""} ${rowClassName?.(row) ?? ""}`}
                >
                  {selectable && (
                    <td className="td w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Selecionar registro"
                        checked={selected.includes(id)}
                        onChange={() => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])}
                        className="h-4 w-4 rounded accent-primary"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`td ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sorted.length && <p className="muted py-10 text-center text-sm">{emptyText ?? "Não encontramos nenhum registro."}</p>}
      </div>
      {footer}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2 text-sm dark:border-white/10">
        <label className="muted flex items-center gap-2 text-xs">
          Registros por página
          <select className="input w-auto py-1" value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(0); }}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n.toLocaleString("pt-BR")}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <span className="muted mr-2 text-xs tabular-nums">{from}-{to} de {sorted.length}</span>
          <button className="btn-icon h-8 w-8" disabled={page === 0} onClick={() => setPage(0)} aria-label="Primeira página"><ChevronsLeft size={16} /></button>
          <button className="btn-icon h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <button className="btn-icon h-8 w-8" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
          <button className="btn-icon h-8 w-8" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Última página"><ChevronsRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

export interface QuickFilter {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}

interface ToolbarProps {
  primary?: { label: string; onClick: () => void };
  search: string;
  onSearch: (v: string) => void;
  filterContent?: ReactNode;
  filterCount?: number;
  onClearFilters?: () => void;
  sortOptions?: { key: string; label: string }[];
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (s: { key: string; dir: "asc" | "desc" }) => void;
  onExport?: () => void;
  quickFilters?: QuickFilter[];
  extra?: ReactNode;
}

export function DataTableToolbar({ primary, search, onSearch, filterContent, filterCount = 0, onClearFilters, sortOptions, sort, onSort, onExport, quickFilters, extra }: ToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary && (
        <button className="btn-primary" onClick={primary.onClick}>
          <Plus size={16} /> {primary.label}
        </button>
      )}
      <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
        <span className="sr-only">Buscar</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar" value={search} onChange={(e) => onSearch(e.target.value)} />
      </label>
      {filterContent && (
        <button className="btn" onClick={() => setFilterOpen(true)}>
          <Filter size={16} /> Filtrar{filterCount > 0 && <span className="chip bg-primary text-white">{filterCount}</span>}
        </button>
      )}
      {sortOptions && onSort && (
        <Dropdown label="Ordenar" align="left" trigger={() => <button className="btn"><ArrowDownUp size={16} /> Ordenar</button>}>
          {(close) =>
            sortOptions.flatMap((o) =>
              (["asc", "desc"] as const).map((dir) => (
                <MenuItem key={o.key + dir} onClick={() => { onSort({ key: o.key, dir }); close(); }}>
                  <span className={sort?.key === o.key && sort.dir === dir ? "font-semibold text-primary" : ""}>
                    {o.label} {dir === "asc" ? "↑" : "↓"}
                  </span>
                </MenuItem>
              )),
            )
          }
        </Dropdown>
      )}
      {onExport && (
        <button className="btn" onClick={onExport}>
          <Download size={16} /> Exportar
        </button>
      )}
      {quickFilters && (
        <div className="flex items-center gap-1">
          {quickFilters.map((q) => (
            <button
              key={q.id}
              onClick={q.onClick}
              aria-pressed={q.active}
              aria-label={q.label}
              title={q.label}
              className={`btn-icon ${q.active ? "bg-primary-soft text-primary dark:bg-primary/20" : ""}`}
            >
              {q.icon}
            </button>
          ))}
        </div>
      )}
      {extra}
      {filterOpen && filterContent && (
        <Drawer
          title="Filtros"
          onClose={() => setFilterOpen(false)}
          footer={
            <>
              {onClearFilters && <button className="btn" onClick={onClearFilters}>Limpar filtros</button>}
              <button className="btn-primary" onClick={() => setFilterOpen(false)}>Aplicar</button>
            </>
          }
        >
          {filterContent}
        </Drawer>
      )}
    </div>
  );
}
