import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { AccountResource } from '@/api/up/types';
import { generateDemoData, type DemoData } from '@/demo/generate';

const DemoDataContext = createContext<DemoData | null>(null);

/**
 * Provides made-up banking data to the whole app. Until M2 adds a real Up connection,
 * this is the only data source. It's generated once per launch, as at the moment of launch.
 */
export function DemoDataProvider({ children }: { children: ReactNode }) {
  const data = useMemo(() => generateDemoData(), []);
  return <DemoDataContext.Provider value={data}>{children}</DemoDataContext.Provider>;
}

export function useBankData(): DemoData {
  const data = useContext(DemoDataContext);
  if (!data) throw new Error('useBankData must be used inside DemoDataProvider');
  return data;
}

export function useAccounts(): {
  spending: AccountResource | undefined;
  savers: AccountResource[];
} {
  const { accounts } = useBankData();
  return useMemo(
    () => ({
      spending: accounts.find((a) => a.attributes.accountType === 'TRANSACTIONAL'),
      savers: accounts.filter((a) => a.attributes.accountType === 'SAVER'),
    }),
    [accounts],
  );
}
