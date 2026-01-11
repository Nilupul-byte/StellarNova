import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { WidgetType } from 'types/widget.types';
import { DashboardHeader, LeftPanel, Widget } from './components';
import styles from './dashboard.styles';
import { StellarNovaTrader } from './widgets';

const dashboardWidgets: WidgetType[] = [
  {
    title: '🌌 StellarNova AI Trader',
    widget: StellarNovaTrader,
    description:
      'Trade on MultiversX using natural language. AI-powered intent parsing with real smart contract execution on Mainnet.',
    reference: 'https://github.com/multiversx/mx-sdk-dapp'
  }
];

export const Dashboard = () => {
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  return (
    <div className={styles.dashboardContainer}>
      <div
        className={classNames(
          styles.mobilePanelContainer,
          styles.desktopPanelContainer
        )}
      >
        <LeftPanel
          isOpen={isMobilePanelOpen}
          setIsOpen={setIsMobilePanelOpen}
        />
      </div>

      <div
        style={{ backgroundImage: 'url(/background.svg)' }}
        className={classNames(styles.dashboardContent, {
          [styles.dashboardContentMobilePanelOpen]: isMobilePanelOpen
        })}
      >
        <DashboardHeader />

        <div className={styles.dashboardWidgets}>
          {dashboardWidgets.map((element) => (
            <Widget key={element.title} {...element} />
          ))}
        </div>
      </div>
    </div>
  );
};
