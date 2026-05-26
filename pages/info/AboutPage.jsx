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

const TESTIMONIALS = [
  {
    quote: "I've traded cards online for years and always had that nagging doubt. CardPop completely changed that — sold a PSA 10 without a second thought.",
    name: 'Jake M.',
    location: 'Sydney, NSW',
  },
  {
    quote: "It genuinely feels like a card show online. The community vibe is real and everyone's been upfront. Found two grails in my first week.",
    name: 'Sarah T.',
    location: 'Brisbane, QLD',
  },
  {
    quote: "For high-value trades, peace of mind is everything. Knowing sellers are verified before I commit makes CardPop the only place I buy from now.",
    name: 'Chris W.',
    location: 'Perth, WA',
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

      {/* Founder Story */}
      <section className={styles.founder}>
        <div className={styles.founderInner}>
          <span className={styles.quoteMark}>"</span>
          <p>
            I'm a Melbourne-based collector who fell into the hobby and never looked back.
            But the more I got into it, the more I hit the same wall everyone else did —
            finding the right person to buy from was harder than it should be.
          </p>
          <p>
            Then I went to my first card show. The energy in that room was something else.
            People talking cards, making deals on a handshake, vouching for each other without
            a second thought. It was everything the hobby should feel like.
          </p>
          <p>
            Outside of those shows, though, that trust didn't really exist. I watched collectors
            chasing vouches across Discord servers and Facebook groups before every trade —
            never quite sure if the person on the other end was legitimate. For high-value cards,
            that uncertainty isn't just frustrating. It's a real barrier.
          </p>
          <p>
            CardPop was built to solve that. A place where cards can be shared, traded, and
            genuinely enjoyed — where your duplicates and seconds find new homes with people
            who'll love them just as much as you did. Where verified sellers give buyers real
            peace of mind. And where every transaction carries the same trust you'd feel shaking
            hands at a card show.
          </p>
          <p>
            The hobby wins when collectors can trust each other. That's what we're building.
          </p>

          <div className={styles.founderAttribution}>
            <div className={styles.founderAvatar}>K</div>
            <div>
              <div className={styles.founderName}>Katon</div>
              <div className={styles.founderRole}>Founder, CardPop · Melbourne, VIC</div>
            </div>
          </div>
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

      {/* Testimonials */}
      <section className={styles.testimonials}>
        <div className={styles.container}>
          <div className={styles.testimonialsHeader}>
            <h2>What collectors are saying</h2>
            <p>From Melbourne to Perth — the community speaks for itself.</p>
          </div>
          <div className={styles.testimonialsGrid}>
            {TESTIMONIALS.map(({ quote, name, location }) => (
              <div key={name} className={styles.testimonialCard}>
                <div className={styles.testimonialQuote}>"</div>
                <p>{quote}</p>
                <div className={styles.testimonialAuthor}>{name}</div>
                <div className={styles.testimonialLocation}>{location}</div>
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
            Australia and beyond — one trusted trade at a time.
          </p>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
