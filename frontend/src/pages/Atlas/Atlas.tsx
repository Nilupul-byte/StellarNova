import { DashboardHeader } from 'pages/Dashboard/components';
import { AtlasTrader, LimitOrderTester, OrderManager } from './components';

// prettier-ignore
const styles = {
  atlasContainer: 'atlas-container flex flex-col items-center min-h-screen bg-transparent',
  atlasContent: 'atlas-content w-full max-w-7xl px-4 py-8 flex flex-col gap-8'
} satisfies Record<string, string>;

export const Atlas = () => {
  return (
    <div className={styles.atlasContainer}>
      <DashboardHeader />

      <div className={styles.atlasContent}>
        <AtlasTrader />
        <LimitOrderTester />
        <OrderManager />
      </div>
    </div>
  );
};
