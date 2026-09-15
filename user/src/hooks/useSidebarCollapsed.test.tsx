import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';

/**
 * The collapsed sidebar is remembered per device. What matters: nothing stored
 * means expanded, a stored choice comes back, and a browser that blocks storage
 * still gets a working toggle instead of a crash.
 */

const KEY = 'fq_test_sidebar_collapsed';

describe('useSidebarCollapsed', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts expanded when nothing is stored', () => {
    const { result } = renderHook(() => useSidebarCollapsed(KEY));
    expect(result.current.collapsed).toBe(false);
  });

  it('restores a sidebar collapsed earlier on this device', () => {
    localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useSidebarCollapsed(KEY));
    expect(result.current.collapsed).toBe(true);
  });

  it('remembers each toggle', () => {
    const { result } = renderHook(() => useSidebarCollapsed(KEY));
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('0');
  });

  it('animates a click but not a restored state', () => {
    localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useSidebarCollapsed(KEY));
    expect(result.current.animate).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.animate).toBe(true);
  });

  it('still toggles when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { result } = renderHook(() => useSidebarCollapsed(KEY));
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
  });
});
