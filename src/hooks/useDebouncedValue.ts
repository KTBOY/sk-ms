import { useEffect, useState } from 'react';

/** 防抖值：输入高频变化时降低昂贵计算频率（一致性校验 300ms 防抖）。 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
