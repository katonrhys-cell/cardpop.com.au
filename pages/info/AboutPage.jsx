import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import styles from '@/styles/about.module.css';

const FEATURES = [
  {
    title: 'Community First',
    desc: 'Built around hobby culture, not just transactions.',
  },
  {
    title: 'Built for Collectors',
    desc: 'Every feature is designed for real collectors and traders.',
  },
  {
    title: 'Trusted Marketplace',
    desc: 'Secure listings, verified sellers, and transparency.',
  },
];

const AboutPage = () => {
  return (
    <>
      <Helmet>
        <title>About Us | CardPop</title>
        <meta
          name="description"
          content="CardPop Australia was created to bring the energy of card shows, trade nights, and collector culture into one trusted digital marketplace."
        />
      </Helmet>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>About CardPop Australia</span>
          <h1>
            Built for the hobby.<br />Powered by collectors.
          </h1>
          <p>
            CardPop Australia was created to bring the energy of card shows,
            trade nights, and collector culture into one trusted digital marketplace.
          </p>
          <div className={styles.heroButtons}>
            <Link to="/marketplace" className={styles.btnPrimary}>
              Explore Marketplace
            </Link>
            <Link to="/signup" className={styles.btnSecondary}>
              Join Community
            </Link>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className={styles.story}>
        <div className={styles.narrow}>
          <h2>Why we built CardPop</h2>
          <p>The hobby deserves a platform built by collectors — not corporations.</p>
          <p>
            We created CardPop to feel like a digital card show: discovering grails,
            making trades, meeting collectors, and building collections in a trusted environment.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <div className={styles.featuresGrid}>
            {FEATURES.map(({ title, desc }) => (
              <div key={title} className={styles.featureCard}>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className={styles.vision}>
        <div className={styles.narrow}>
          <h2>The future of collecting</h2>
          <p>
            CardPop is building a connected ecosystem for collectors across
            Australia and beyond.
          </p>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
