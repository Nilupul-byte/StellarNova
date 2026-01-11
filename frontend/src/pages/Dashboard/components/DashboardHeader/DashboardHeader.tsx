// prettier-ignore
const styles = {
  dashboardHeaderContainer: 'dashboard-header-container flex flex-col p-8 lg:p-10 justify-center items-center gap-6 self-stretch',
  dashboardHeaderTitle: 'dashboard-header-title text-primary transition-all duration-300 text-center text-3xl xs:text-5xl lg:text-6xl font-medium',
  dashboardHeaderDescription: 'dashboard-header-description text-secondary transition-all duration-300 text-center text-base xs:text-lg lg:text-xl font-medium',
  dashboardHeaderDescriptionText: 'dashboard-header-description-text mx-1'
} satisfies Record<string, string>;

export const DashboardHeader = () => (
  <div className={styles.dashboardHeaderContainer}>
    <div className={styles.dashboardHeaderTitle}>Welcome to StellarNova</div>

    <div className={styles.dashboardHeaderDescription}>
      <span className={styles.dashboardHeaderDescriptionText}>
        StellarNova is an AI-powered DeFi trading platform on MultiversX. Simply
        describe your trade in natural language, and our intelligent system
        executes secure, non-custodial swaps directly on xExchange. Your wallet,
        your keys, your control.
      </span>
    </div>
  </div>
);
