import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, Column } from './Table';

interface TestData {
  id: number;
  name: string;
  value: number;
}

const mockData: TestData[] = [
  { id: 1, name: 'Item 1', value: 100 },
  { id: 2, name: 'Item 2', value: 200 },
  { id: 3, name: 'Item 3', value: 300 },
];

const mockColumns: Column<TestData>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (item) => item.name,
  },
  {
    key: 'value',
    header: 'Value',
    render: (item) => `$${item.value}`,
  },
];

describe('Table', () => {
  it('renders table with headers', () => {
    render(<Table columns={mockColumns} data={mockData} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders table data', () => {
    render(<Table columns={mockColumns} data={mockData} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
  });

  it('displays empty state when no data', () => {
    render(<Table columns={mockColumns} data={[]} />);
    expect(screen.getByText(/no data available/i)).toBeInTheDocument();
  });

  describe('sticky header', () => {
    it('applies sticky header styles by default', () => {
      const { container } = render(<Table columns={mockColumns} data={mockData} />);
      const thead = container.querySelector('thead');
      expect(thead).toHaveClass('sticky', 'top-0', 'z-10');
    });

    it('does not apply sticky header when stickyHeader is false', () => {
      const { container } = render(<Table columns={mockColumns} data={mockData} stickyHeader={false} />);
      const thead = container.querySelector('thead');
      expect(thead).not.toHaveClass('sticky');
    });
  });

  describe('row interactions', () => {
    it('calls onRowClick when row is clicked', async () => {
      const handleRowClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Table columns={mockColumns} data={mockData} onRowClick={handleRowClick} />);
      const firstRow = screen.getByText('Item 1').closest('tr');
      
      if (firstRow) {
        await user.click(firstRow);
        expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
      }
    });

    it('highlights selected row', () => {
      render(<Table columns={mockColumns} data={mockData} selectedRow={mockData[1]} />);
      const selectedRow = screen.getByText('Item 2').closest('tr');
      expect(selectedRow).toHaveClass('bg-ink-800');
    });

    it('applies hover styles when onRowClick is provided', () => {
      render(<Table columns={mockColumns} data={mockData} onRowClick={() => {}} />);
      const firstRow = screen.getByText('Item 1').closest('tr');
      expect(firstRow).toHaveClass('cursor-pointer', 'hover:bg-ink-800');
    });
  });

  describe('keyboard navigation', () => {
    it('makes rows keyboard accessible when clickable', () => {
      render(<Table columns={mockColumns} data={mockData} onRowClick={() => {}} />);
      const firstRow = screen.getByText('Item 1').closest('tr');
      expect(firstRow).toHaveAttribute('tabIndex', '0');
      expect(firstRow).toHaveAttribute('role', 'button');
    });

    it('handles Enter key on rows', async () => {
      const handleRowClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Table columns={mockColumns} data={mockData} onRowClick={handleRowClick} />);
      const firstRow = screen.getByText('Item 1').closest('tr');
      
      if (firstRow) {
        firstRow.focus();
        await user.keyboard('{Enter}');
        expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
      }
    });

    it('handles Space key on rows', async () => {
      const handleRowClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Table columns={mockColumns} data={mockData} onRowClick={handleRowClick} />);
      const firstRow = screen.getByText('Item 1').closest('tr');
      
      if (firstRow) {
        firstRow.focus();
        await user.keyboard(' ');
        expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
      }
    });
  });

  describe('column widths', () => {
    it('applies custom column widths', () => {
      const columnsWithWidth: Column<TestData>[] = [
        {
          key: 'name',
          header: 'Name',
          render: (item) => item.name,
          width: '200px',
        },
      ];
      
      const { container } = render(<Table columns={columnsWithWidth} data={mockData} />);
      const th = container.querySelector('th');
      expect(th).toHaveStyle({ width: '200px' });
    });
  });

  describe('accessibility', () => {
    it('uses proper table semantics', () => {
      render(<Table columns={mockColumns} data={mockData} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
      expect(screen.getAllByRole('row')).toHaveLength(4); // 1 header + 3 data rows
    });
  });
});
