import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { TableColumnType } from 'antd';

interface UseResizableColumnsProps {
  persistKey?: string;
  storageKey?: string;
  columns?: any[];
  defaultColumns?: any[];
  minWidth?: number;
  /** 补偿额外列宽（如勾选列 32px，建议给足 50px） */
  extraWidth?: number;
  enabled?: boolean;
}

/**
 * 工业级 Excel 风格列宽拖拽 Hook
 * 核心逻辑：
 * 1. 递归处理列定义，只对叶子节点注入 ResizableHeaderCell 所需属性。
 * 2. 实时更新 React 状态保证持久化和初次渲染对齐。
 * 3. 拖拽过程中直接操作 DOM (col + table width) 保证极致丝滑且不挤压其他列。
 */
export function useResizableColumns(props: UseResizableColumnsProps) {
  const {
    persistKey,
    storageKey,
    columns: newColumns,
    defaultColumns,
    minWidth = 40,
    extraWidth = 0,
    enabled = true
  } = props;

  const finalKey = persistKey || storageKey || 'default_table_key';
  const initialCols = newColumns || defaultColumns || [];

  const [widthsMap, setWidthsMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`table_cols_width_${finalKey}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    if (enabled) localStorage.setItem(`table_cols_width_${finalKey}`, JSON.stringify(widthsMap));
  }, [widthsMap, finalKey, enabled]);

  // 递归处理列
  const { processedColumns } = useMemo(() => {
    const walk = (cols: any[], path: string = ''): any[] => {
      return cols.map((col, index) => {
        const key = (col.key as string) || (col.dataIndex as string) || `${path}col-${index}`;
        
        // 如果有子列，递归处理
        if (col.children && Array.isArray(col.children) && col.children.length > 0) {
          return {
            ...col,
            children: walk(col.children, `${key}-`)
          };
        }

        // 叶子节点：注入拖拽属性
        const width = widthsMap[key] || (col.width as number) || 120;
        return {
          ...col,
          width,
          onHeaderCell: (column: TableColumnType<any>) => {
            const existing = col.onHeaderCell ? col.onHeaderCell(column) : {};
            return {
              ...existing,
              width: column.width,
              minWidth,
              'data-col-key': key,
              onResize: (newWidth: number) => {
                setWidthsMap((prev) => ({ ...prev, [key]: Math.round(newWidth) }));
              },
            };
          },
        };
      });
    };
    return { processedColumns: walk(initialCols) };
  }, [initialCols, widthsMap, minWidth]);

  // 计算精确总宽
  const calculateTotalWidth = useCallback(() => {
    const getLeafWidth = (cols: any[]): number => {
      let sum = 0;
      cols.forEach(col => {
        if (col.children?.length) {
          sum += getLeafWidth(col.children);
        } else {
          sum += (Number(col.width) || 120);
        }
      });
      return sum;
    };
    return getLeafWidth(processedColumns) + (extraWidth || 0);
  }, [processedColumns, extraWidth]);

  const tableWidth = useMemo(() => calculateTotalWidth(), [calculateTotalWidth]);

  return {
    columns: processedColumns,
    tableWidth,
    tableRef: useRef<HTMLDivElement>(null),
    resetColumns: () => setWidthsMap({}),
    resetColumnWidths: () => setWidthsMap({}),
    calculateTotalWidth,
  };
}

export const ResizableHeaderCell = (props: any) => {
  const { onResize, width, minWidth, children, ...restProps } = props;
  const colKey = restProps['data-col-key'];

  // 如果没有 width 或 colKey（说明是非叶子列或不需要缩放的列），直接返回普通 th
  if (!width || !colKey) return <th {...restProps}>{children}</th>;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const handleEl = e.currentTarget;
    const tableWrapper = handleEl.closest('.ant-table-wrapper');
    if (!tableWrapper) return;

    // 1. 获取所有相关的 table (AntD 可能会分 Header Table 和 Body Table)
    const tables = Array.from(tableWrapper.querySelectorAll('table')) as HTMLTableElement[];
    const startX = e.pageX;
    const startWidth = width;
    
    // 记录初始表格总宽
    const initialTableWidths = tables.map(t => t.offsetWidth);

    // 2. 核心：通过查找 data-col-key 在 thead 的最后一行（叶子行）中的索引，定位物理 col
    const targetCols: HTMLTableColElement[] = [];
    tables.forEach(table => {
      // 在 AntD 中，叶子节点对应的 col 在 colgroup 中的索引，等于 thead tr:last-child 中 th 的索引
      const leafThs = Array.from(table.querySelectorAll('thead tr:last-child th'));
      const colIdx = leafThs.findIndex(th => th.getAttribute('data-col-key') === colKey);
      
      if (colIdx !== -1) {
        const col = table.querySelector(`colgroup col:nth-child(${colIdx + 1})`) as HTMLTableColElement;
        if (col) targetCols.push(col);
      }
    });

    handleEl.setPointerCapture(e.pointerId);
    handleEl.classList.add('resizing');

    let rafId: number | null = null;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.pageX - startX;
      const nextWidth = Math.max(minWidth, startWidth + deltaX);
      const actualDelta = nextWidth - startWidth;

      // A. 立即操作 DOM：同步更新所有 table 总宽（锁定其他列宽度）
      tables.forEach((table, i) => {
        const nextTableWidth = initialTableWidths[i] + actualDelta;
        table.style.width = `${nextTableWidth}px`;
        table.style.minWidth = `${nextTableWidth}px`;
      });

      // B. 立即操作 DOM：更新物理 col 宽度
      const px = `${nextWidth}px`;
      targetCols.forEach(col => {
        col.style.width = px;
        col.style.minWidth = px;
        col.style.maxWidth = px;
      });

      // C. 异步更新 React 状态，确保数据同步
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        onResize(nextWidth);
      });
    };

    const onPointerUp = (ev: PointerEvent) => {
      handleEl.releasePointerCapture(ev.pointerId);
      handleEl.classList.remove('resizing');
      handleEl.removeEventListener('pointermove', onPointerMove);
      handleEl.removeEventListener('pointerup', onPointerUp);
      handleEl.removeEventListener('pointercancel', onPointerUp);
      if (rafId) cancelAnimationFrame(rafId);
    };

    handleEl.addEventListener('pointermove', onPointerMove);
    handleEl.addEventListener('pointerup', onPointerUp);
    handleEl.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <th 
      {...restProps} 
      style={{ ...restProps.style, position: 'relative', overflow: 'visible' }}
    >
      <div className="resizable-cell-content">{children}</div>
      <div 
        className="resizable-handle" 
        onPointerDown={onPointerDown} 
        onClick={e => e.stopPropagation()} 
      />
    </th>
  );
};
