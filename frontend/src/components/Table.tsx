import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  stickyHeader?: boolean;
  onRowClick?: (item: T) => void;
  selectedRow?: T;
  className?: string;
}

export function Table<T extends { id?: string | number }>({
  columns,
  data,
  stickyHeader = true,
  onRowClick,
  selectedRow,
  className = ''
}: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        <thead className={stickyHeader ? 'sticky top-0 z-10 bg-ink-900' : ''}>
          <tr className="border-b border-line-700">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-small font-semibold text-slate-300"
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={columns.length}
                className="px-4 py-8 text-center text-slate-500"
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((item, index) => {
              const isSelected = selectedRow && item.id === selectedRow.id;
              return (
                <tr
                  key={item.id || index}
                  className={`
                    border-b border-line-700 
                    transition-colors duration-150
                    ${onRowClick ? 'cursor-pointer hover:bg-ink-800' : ''}
                    ${isSelected ? 'bg-ink-800' : ''}
                  `}
                  onClick={() => onRowClick?.(item)}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(item);
                    }
                  } : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-4 py-3 text-body text-white"
                    >
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
