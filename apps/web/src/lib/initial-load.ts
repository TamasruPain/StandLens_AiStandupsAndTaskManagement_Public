let isInitialLoad = true;

export function getIsInitialLoad(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return isInitialLoad;
}

export function setIsInitialLoad(val: boolean): void {
  if (typeof window !== 'undefined') {
    isInitialLoad = val;
  }
}
