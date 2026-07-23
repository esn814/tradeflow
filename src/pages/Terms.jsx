import { FileText, AlertTriangle, Scale, Shield, Ban, Zap, Globe, Lock } from 'lucide-react';
import { Card, CardBody, SectionHeader, PageHeader, Divider } from '../components/ui';

const LAST_UPDATED = 'July 23, 2026';

const SECTIONS = [
  {
    icon: Zap,
    title: 'Service Description',
    content: [
      'TradeFlow is a demo and educational crypto trading platform.',
      'All trading strategies, P&L calculations, and portfolio data are simulated or for demonstration purposes only.',
      'Demo mode uses virtual funds ($10K default) with real market prices. No real money is at risk in demo mode.',
      'We reserve the right to modify, suspend, or discontinue any part of the service at any time.',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Not Financial Advice',
    content: [
      'NOTHING on TradeFlow constitutes financial advice, investment advice, trading advice, or any other form of professional advice.',
      'All strategies, signals, and recommendations shown are for educational and demonstration purposes only.',
      'Past performance — whether simulated or historical — does NOT guarantee future results.',
      'You are solely responsible for any investment decisions you make. Consult a licensed financial advisor before investing.',
      'TradeFlow, its creators, and affiliates are not liable for any losses incurred from decisions made based on the platform.',
    ],
  },
  {
    icon: Scale,
    title: 'User Responsibilities',
    content: [
      'You must be at least 18 years old to use TradeFlow.',
      'You are responsible for maintaining the security of your wallet and API keys.',
      'You must not use TradeFlow for any illegal activity, including money laundering or market manipulation.',
      'You must comply with all applicable laws and regulations in your jurisdiction regarding cryptocurrency trading.',
      'You are responsible for any taxes owed on profits from real trading conducted outside of demo mode.',
    ],
  },
  {
    icon: Shield,
    title: 'Risk Disclosure',
    content: [
      'Cryptocurrency trading involves substantial risk of loss and is not suitable for all investors.',
      'The value of cryptocurrencies can go down as well as up, and you may lose some or all of your investment.',
      'Automated trading strategies can amplify losses as well as gains.',
      'Exchange outages, network congestion, and smart contract bugs can cause unexpected losses.',
      'Leveraged trading (if enabled) can result in losses exceeding your initial investment.',
    ],
  },
  {
    icon: Lock,
    title: 'Limitation of Liability',
    content: [
      'TradeFlow is provided "AS IS" and "AS AVAILABLE" without warranties of any kind.',
      'We do not guarantee uninterrupted, error-free, or secure operation of the platform.',
      'To the maximum extent permitted by law, TradeFlow and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages.',
      'Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim (currently $0 for free/demo users).',
      'We are not liable for losses caused by third-party services (exchanges, wallets, APIs, oracles).',
    ],
  },
  {
    icon: Ban,
    title: 'Prohibited Uses',
    content: [
      'Using the platform for any illegal purpose in your jurisdiction.',
      'Attempting to manipulate simulated markets or exploit bugs for unfair advantage.',
      'Reverse-engineering, decompiling, or extracting source code from the platform.',
      'Automated scraping, data harvesting, or denial-of-service attacks.',
      'Impersonating other users or providing false information.',
    ],
  },
  {
    icon: Globe,
    title: 'Intellectual Property',
    content: [
      'All content, code, designs, and trademarks on TradeFlow are the property of their respective owners.',
      'Open-source components are licensed under their respective licenses.',
      'You retain ownership of any strategies or configurations you create within the platform.',
    ],
  },
];

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader icon={FileText} title="Terms of Service" subtitle={`Last updated: ${LAST_UPDATED}`} />

      <Card className="border-[var(--color-warning-30)]">
        <CardBody>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-warning)] mb-1">Important Notice</p>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                TradeFlow is a <strong>demo/educational platform</strong>. Nothing on this platform constitutes financial advice.
                Cryptocurrency trading involves substantial risk of loss. Past performance does not guarantee future results.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {SECTIONS.map((section, i) => {
        const Icon = section.icon;
        return (
          <div key={i}>
            <SectionHeader icon={Icon} title={section.title} />
            <Card>
              <CardBody>
                <ul className="space-y-3">
                  {section.content.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
            {i < SECTIONS.length - 1 && <Divider />}
          </div>
        );
      })}
    </div>
  );
}
