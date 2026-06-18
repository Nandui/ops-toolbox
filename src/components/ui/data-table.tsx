"use client"

import * as React from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

/*
 * DataTable — a thin, opinionated wrapper over TanStack Table. Sortable
 * headers, optional global filter, row click → detail. Kept presentational;
 * data fetching and column defs live in the page. Light-first, hairline rows.
 */

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Global text filter value (controlled by the page's search bar). */
  globalFilter?: string
  onRowClick?: (row: TData) => void
  /** Marks a row as the active/selected one (e.g. open in the drawer). */
  isRowActive?: (row: TData) => boolean
  emptyMessage?: string
  className?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  globalFilter,
  onRowClick,
  isRowActive,
  emptyMessage = "No records found.",
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className={cn("surface-card overflow-hidden p-0", className)}>
      <Table>
        <TableHeader className="[&_tr]:border-border">
          {table.getHeaderGroups().map(hg => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map(header => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    className="h-11 bg-muted/40 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? <ArrowUp className="size-3" />
                          : sorted === "desc" ? <ArrowDown className="size-3" />
                          : <ChevronsUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => {
              const active = isRowActive?.(row.original)
              return (
                <TableRow
                  key={row.id}
                  data-state={active ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-border",
                    onRowClick && "cursor-pointer",
                    active && "bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="px-4 py-3 whitespace-normal align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
