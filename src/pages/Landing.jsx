/* ============================================================
   BLANE — Landing Page
   Replaces: index.html (markup) + js/main.js (navbar scroll
   effect, hamburger toggle, scroll-reveal animation, macro bar
   animation, modal open/close wiring).

   redirectIfLoggedIn() from the old auth.js is now handled by
   the useEffect below, which checks the session from useAuth()
   and navigates away if already logged in.
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import '../styles/landing.css';

const FEATURES = [
  { icon: '🔄', num: 'Module 01', name: 'Body Feedback Loop', desc: 'Record weight, sleep, water and activity yourself. Review your entries alongside your nutrition goals.' },
  { icon: '📉', num: 'Module 02', name: 'Health Drift Detection', desc: 'Review trends in your recorded health data and see when your recent entries differ from your usual pattern.' },
  { icon: '⚖️', num: 'Module 03', name: 'Dynamic Portion Optimizer', desc: 'Explore portion adjustments using your profile, calorie target and available recipe information.' },
  { icon: '📍', num: 'Module 04', name: 'GeoMarket Ingredient Scanner', desc: 'Explore listed markets and stored ingredient information. Location access helps sort nearby options.' },
  { icon: '💸', num: 'Module 05 & 06', name: 'Price-Aware & Seasonal Optimizer', desc: 'Compare estimated ingredient costs from Philippine price references and review seasonal labels to support your planning. Actual store prices and stock may vary.', wide: true },
  { icon: '💡', num: 'Module 07', name: 'Explainable AI', desc: 'Read recommendation reasons and request AI explanations to help you understand suggested meals.' },
  { icon: '🚫', num: 'Module 08', name: 'Constraint-Based Planning', desc: 'Apply your dietary preferences and restriction checks. Always review ingredients and warnings before choosing a meal.' },
  { icon: '📖', num: 'Module 09', name: 'Recipe Recommendation', desc: 'Browse recipes, inspect ingredients and nutrition details, and add a recipe to today’s meal plan.' },
];

const STEPS = [
  { icon: '📊', title: 'Set up your profile', desc: 'Enter your goals, preferences and health records manually.' },
  { icon: '🧠', title: 'Review suggestions', desc: 'Explore recipe suggestions and portion options based on your profile.' },
  { icon: '🗺️', title: 'Check the details', desc: 'Review ingredients, estimated costs and listed market information.' },
  { icon: '🍽️', title: 'Plan your meals', desc: 'Add meals to your plan and keep track of what you have eaten.' },
];

export default function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [scrolled, setScrolled]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalTab, setModalTab]     = useState('login');

  const revealRefs = useRef([]);

  /* Redirect already-logged-in visitors away from landing page
     (replaces redirectIfLoggedIn() from the old auth.js) */
  useEffect(() => {
    if (!loading && session) navigate('/dashboard');
  }, [loading, session, navigate]);

  /* Navbar scroll effect (replaces the scroll listener in main.js) */
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 40); }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Scroll-reveal animation (replaces checkReveal() in main.js) */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function addRevealRef(el) {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  }

  function openModal(tab) {
    setMobileOpen(false);
    setModalTab(tab);
    setModalOpen(true);
  }

  function scrollToSection(id) {
    setMobileOpen(false);
    const target = document.getElementById(id);
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  return (
    <>
      {/* ===================== NAVIGATION ===================== */}
      <nav aria-label="Main navigation" className={'navbar' + (scrolled ? ' scrolled' : '')}>
        <div className="container">
          <div className="navbar-inner">
            <a href="#home" className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z"/>
                </svg>
              </div>
              <span className="logo-text"><span>BL</span>ANE</span>
            </a>

            <ul className="nav-links">
              <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a></li>
              <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a></li>
              <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>About</a></li>
              <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }}>Contact</a></li>
            </ul>

            <div className="nav-cta">
              <a href="#" className="btn btn-outline" onClick={(e) => { e.preventDefault(); openModal('login'); }}>Sign in</a>
              <a href="#" className="btn btn-primary" onClick={(e) => { e.preventDefault(); openModal('register'); }}>Get Started</a>
            </div>

            <button
              className={'hamburger' + (mobileOpen ? ' active' : '')}
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>

          <div id="landing-mobile-menu" className={'mobile-menu' + (mobileOpen ? ' open' : '')}>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a>
            <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>About</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }}>Contact</a>
            <a href="#" className="btn btn-outline" onClick={(e) => { e.preventDefault(); openModal('login'); }}>Sign in</a>
            <a href="#" className="btn btn-primary" onClick={(e) => { e.preventDefault(); openModal('register'); }}>Get Started</a>
          </div>
        </div>
      </nav>

      {/* ===================== HERO ===================== */}
      <section className="hero" id="home">
        <div className="hero-bg">
          <div className="glow-blob"></div>
          <div className="glow-blob"></div>
          <div className="hero-grid"></div>
        </div>

        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-badge">
                <div className="hero-badge-dot"></div>
                <span className="hero-badge-text">AI-Powered Nutrition Intelligence</span>
              </div>

              <h1 className="hero-title">
                Eat smarter<br />
                with <span className="highlight">adaptive</span><br />
                nutrition AI
              </h1>

              <p className="hero-desc">
                Use your profile, manually recorded health data and Philippine
                food references to explore meal ideas, review estimated costs
                and plan around your goals and budget.
              </p>

              <div className="hero-actions">
                <a href="#" className="btn btn-primary btn-lg" onClick={(e) => { e.preventDefault(); openModal('register'); }}>
                  Start for free
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
                <a href="#features" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>See how it works</a>
              </div>

              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat-number">9</span>
                  <div className="hero-stat-label">Planning modules</div>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-number">Your data</span>
                  <div className="hero-stat-label">Manually recorded</div>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-number">Local</span>
                  <div className="hero-stat-label">Philippine references</div>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-card-main planning-preview">
                <div className="card-header">
                  <span className="card-title-sm">Your everyday meal plan</span>
                  <span className="card-badge">Made around you</span>
                </div>
                <div className="preview-heading-icon" aria-hidden="true">🍽️</div>
                <h2>A little planning.<br />An easier mealtime.</h2>
                <p className="preview-intro">Set up your profile to see meals and nutrition information that fit your goals.</p>
                <ol className="preview-checklist">
                  <li><span className="preview-step-number" aria-hidden="true">1</span><div><strong>Start with your goals</strong><p>Your preferences guide the recipes you see.</p></div></li>
                  <li><span className="preview-step-number" aria-hidden="true">2</span><div><strong>Review the ingredients</strong><p>See nutrition details and available cost estimates.</p></div></li>
                  <li><span className="preview-step-number" aria-hidden="true">3</span><div><strong>Use a meal today</strong><p>Add it to your plan with one tap.</p></div></li>
                </ol>
                <p className="preview-estimate-note">Prices are estimates in Philippine pesos. Actual store totals may vary.</p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section className="section" id="features">
        <div className="container">
          <span className="section-label reveal" ref={addRevealRef}>Core Features</span>
          <h2 className="section-title reveal" ref={addRevealRef}>Nine connected<br />nutrition modules</h2>
          <p className="section-sub reveal" ref={addRevealRef}>
            Explore connected tools for meal planning, nutrition information,
            health logs and estimated ingredient costs.
          </p>

          <div className="features-grid">
            {FEATURES.map((f) => (
              <div key={f.num} className={'feature-card reveal' + (f.wide ? ' wide' : '')} ref={addRevealRef}>
                <div className="feature-icon-wrap">{f.icon}</div>
                <div className="feature-num">{f.num}</div>
                <div className="feature-name">{f.name}</div>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className="section how-it-works" id="how-it-works">
        <div className="container">
          <span className="section-label reveal" ref={addRevealRef}>Process</span>
          <h2 className="section-title reveal" ref={addRevealRef}>How BLANE works</h2>
          <p className="section-sub reveal" ref={addRevealRef}>From data to plate in four intelligent steps.</p>

          <div className="steps-list">
            {STEPS.map((s) => (
              <div key={s.title} className="step-item reveal" ref={addRevealRef}>
                <div className="step-dot">{s.icon}</div>
                <div className="step-title">{s.title}</div>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="process-highlights">
            <div className="hero-float-card">
              <div className="float-icon" aria-hidden="true">📍</div>
              <div>
                <div className="float-text-main">Explore markets</div>
                <div className="float-text-sub">Review listed ingredients</div>
              </div>
            </div>
            <div className="hero-float-card">
              <div className="float-icon" aria-hidden="true">🧠</div>
              <div>
                <div className="float-text-main">AI Explained</div>
                <div className="float-text-sub">Understand your meal options</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="section cta-section" id="about">
        <div className="glow-blob"></div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="section-label reveal" style={{ justifyContent: 'center' }} ref={addRevealRef}>Get Started</span>
          <h2 className="section-title reveal" ref={addRevealRef}>Nutrition that<br />adapts to <span style={{ color: 'var(--color-primary)' }}>you</span></h2>
          <p className="section-sub reveal" style={{ textAlign: 'center', margin: '0 auto 36px' }} ref={addRevealRef}>
            Set your goals, review recipes and bring a little more structure
            to your everyday meals.
          </p>
          <div className="cta-actions reveal" ref={addRevealRef}>
            <a href="#" className="btn btn-primary btn-lg" onClick={(e) => { e.preventDefault(); openModal('register'); }}>Create free account</a>
            <a href="#" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); openModal('login'); }}>Sign in</a>
          </div>
        </div>
      </section>

      <section className="section landing-data-section" id="your-data" aria-labelledby="landing-data-title">
        <div className="container">
          <span className="section-label">Before you begin</span>
          <h2 className="section-title" id="landing-data-title">Your data and estimates</h2>
          <div className="landing-data-grid">
            <div>
              <h3>Information you enter</h3>
              <p>Your account, profile and submitted health logs are handled through Supabase. Health information comes from your entries; BLANE does not connect to wearables or continuously measure your body.</p>
              <p>Meal plans and completion marks are stored in this browser. Grocery entries are kept for the browser session, so these records may not appear on another device.</p>
            </div>
            <div>
              <h3>Reference prices and guidance</h3>
              <p>Meal costs use Philippine DA and store references. Prices are checked automatically while an active page uses the price feed; updates depend on source availability. Read the source and estimate labels before budgeting.</p>
              <p>Listed markets, seasonal labels and AI suggestions are planning aids. They do not guarantee current stock or replace advice from a qualified nutrition professional.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer" id="contact">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <a href="#home" className="logo"><span className="logo-text"><span>BL</span>ANE</span></a>
              <p>Biological Adaptive Nutrition Engine. A capstone project for practical meal planning in Tarlac City.</p>
            </div>
            <div>
              <div className="footer-col-title">Explore</div>
              <ul className="footer-links">
                <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a></li>
                <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How it works</a></li>
                <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>About the project</a></li>
                <li><a href="#your-data" onClick={(e) => { e.preventDefault(); scrollToSection('your-data'); }}>Data and price information</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Get started</div>
              <ul className="footer-links">
                <li><button type="button" onClick={() => openModal('register')}>Create an account</button></li>
                <li><button type="button" onClick={() => openModal('login')}>Sign in to your dashboard</button></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Questions or feedback?</div>
              <p className="footer-help">Sign in and choose Feedback in the navigation menu to send a message to the project team.</p>
              <button type="button" className="btn btn-outline footer-help-button" onClick={() => openModal('login')}>Sign in for feedback</button>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} BLANE · Capstone Project</p>
            <div className="footer-bottom-links">
              <a href="#your-data" onClick={(e) => { e.preventDefault(); scrollToSection('your-data'); }}>Data and estimates</a>
              <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }}>Back to top ↑</a>
            </div>
          </div>
        </div>
      </footer>

      <AuthModal
        open={modalOpen}
        tab={modalTab}
        onClose={() => setModalOpen(false)}
        onSwitchTab={setModalTab}
      />
    </>
  );
}
