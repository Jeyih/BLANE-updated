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
  { icon: '🔄', num: 'Module 01', name: 'Real-Time Body Feedback Loop', desc: 'Continuously syncs with wearable and health data to adjust your nutrition targets on the fly — no more static meal plans.' },
  { icon: '📉', num: 'Module 02', name: 'Health Drift Detection', desc: 'Detects subtle shifts in your health metrics over time and proactively recalibrates your recommendations before issues arise.' },
  { icon: '⚖️', num: 'Module 03', name: 'Dynamic Portion Optimizer', desc: 'Computes ideal portion sizes based on your activity level, metabolic rate, and daily goals — recalculated every day.' },
  { icon: '📍', num: 'Module 04', name: 'GeoMarket Ingredient Scanner', desc: 'Scans nearby markets and stores for available ingredients so that every meal plan is realistic and locally actionable.' },
  { icon: '💸', num: 'Module 05 & 06', name: 'Price-Aware & Seasonal Optimizer', desc: 'Combines real-time local pricing data with seasonal ingredient availability to suggest meals that are not just healthy, but genuinely affordable and easy to source in your area right now. Never recommends out-of-season produce at peak prices.', wide: true },
  { icon: '💡', num: 'Module 07', name: 'Explainable AI', desc: 'Every recommendation comes with a clear, human-readable reason — so you always understand why BLANE suggests what it does.' },
  { icon: '🚫', num: 'Module 08', name: 'Constraint-Based Planning', desc: 'Handles allergies, intolerances, religious restrictions, and dietary preferences as hard constraints — never violated.' },
  { icon: '📖', num: 'Module 09', name: 'Recipe Recommendation', desc: 'Matches your available ingredients and nutritional needs with a curated, step-by-step recipe library tailored to your skill level.' },
];

const STEPS = [
  { icon: '📊', title: 'Collect your data', desc: 'Connect health apps, wearables, or input your profile and goals manually.' },
  { icon: '🧠', title: 'AI analysis', desc: "BLANE's nine modules process your biometrics, location, budget, and preferences." },
  { icon: '🗺️', title: 'Local matching', desc: 'Recommendations are filtered against nearby markets and current seasonal pricing.' },
  { icon: '🍽️', title: 'Your meal plan', desc: 'Receive a personalized, explained, and affordable plan — updated in real time.' },
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

  /* Macro bar animation on load (replaces the setTimeout in main.js) */
  useEffect(() => {
    const timer = setTimeout(() => {
      document.querySelectorAll('.macro-bar-fill').forEach((bar) => {
        bar.style.width = bar.getAttribute('data-width');
      });
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  function addRevealRef(el) {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  }

  function openModal(tab) {
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
      <nav className={'navbar' + (scrolled ? ' scrolled' : '')}>
        <div className="container">
          <div className="navbar-inner">
            <a href="#" className="logo">
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
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>

          <div className={'mobile-menu' + (mobileOpen ? ' open' : '')}>
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
                BLANE combines real-time health data, local food availability,
                and explainable AI to deliver personalized meal plans that
                actually fit your life and budget.
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
                  <div className="hero-stat-label">AI-powered modules</div>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-number">Real-time</span>
                  <div className="hero-stat-label">Body feedback loop</div>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-number">Local</span>
                  <div className="hero-stat-label">Market awareness</div>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-float-card card-geo">
                <div className="float-icon">📍</div>
                <div>
                  <div className="float-text-main">Nearby Market</div>
                  <div className="float-text-sub">3 ingredients available</div>
                </div>
              </div>

              <div className="hero-card-main">
                <div className="card-header">
                  <span className="card-title-sm">Today's Plan</span>
                  <span className="card-badge">● Live sync</span>
                </div>

                <div className="nutrition-ring-wrap">
                  <div className="ring-chart">
                    <svg viewBox="0 0 100 100" width="100" height="100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#111f16" strokeWidth="10"/>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#2ddc7a" strokeWidth="10" strokeDasharray="105 159" strokeDashoffset="0" strokeLinecap="round"/>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#1a8c4e" strokeWidth="10" strokeDasharray="80 184" strokeDashoffset="-108" strokeLinecap="round"/>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#a8f5c8" strokeWidth="10" strokeDasharray="37 227" strokeDashoffset="-191" strokeLinecap="round"/>
                    </svg>
                    <div className="ring-center-text">
                      <span className="ring-kcal">1,840</span>
                      <span className="ring-label">kcal</span>
                    </div>
                  </div>

                  <div className="macro-list">
                    <div className="macro-item">
                      <div className="macro-row"><span className="macro-name">Protein</span><span className="macro-val">128g</span></div>
                      <div className="macro-bar-bg"><div className="macro-bar-fill" style={{ width: 0, background: '#2ddc7a' }} data-width="66%"></div></div>
                    </div>
                    <div className="macro-item">
                      <div className="macro-row"><span className="macro-name">Carbs</span><span className="macro-val">210g</span></div>
                      <div className="macro-bar-bg"><div className="macro-bar-fill" style={{ width: 0, background: '#1a8c4e' }} data-width="50%"></div></div>
                    </div>
                    <div className="macro-item">
                      <div className="macro-row"><span className="macro-name">Fats</span><span className="macro-val">58g</span></div>
                      <div className="macro-bar-bg"><div className="macro-bar-fill" style={{ width: 0, background: '#a8f5c8' }} data-width="24%"></div></div>
                    </div>
                  </div>
                </div>

                <div className="meal-strip">
                  <div className="meal-item">
                    <span className="meal-emoji">🥗</span>
                    <div className="meal-info"><div className="meal-name">Chicken &amp; Veggie Bowl</div><div className="meal-meta">Lunch · Local market ✓</div></div>
                    <span className="meal-kcal">520 kcal</span>
                  </div>
                  <div className="meal-item">
                    <span className="meal-emoji">🍳</span>
                    <div className="meal-info"><div className="meal-name">Egg &amp; Malunggay Scramble</div><div className="meal-meta">Breakfast · ₱45 est.</div></div>
                    <span className="meal-kcal">380 kcal</span>
                  </div>
                  <div className="meal-item">
                    <span className="meal-emoji">🍚</span>
                    <div className="meal-info"><div className="meal-name">Sinigang na Isda</div><div className="meal-meta">Dinner · Seasonal ✓</div></div>
                    <span className="meal-kcal">480 kcal</span>
                  </div>
                </div>
              </div>

              <div className="hero-float-card card-ai">
                <div className="float-icon">🧠</div>
                <div>
                  <div className="float-text-main">AI Explained</div>
                  <div className="float-text-sub">High protein · Low budget</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section className="section" id="features">
        <div className="container">
          <span className="section-label reveal" ref={addRevealRef}>Core Features</span>
          <h2 className="section-title reveal" ref={addRevealRef}>Nine intelligent<br />nutrition modules</h2>
          <p className="section-sub reveal" ref={addRevealRef}>
            Every module works together to give you a complete, adaptive, and
            explainable nutrition experience — powered by real data.
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
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="section cta-section" id="about">
        <div className="glow-blob"></div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="section-label reveal" style={{ justifyContent: 'center' }} ref={addRevealRef}>Get Started</span>
          <h2 className="section-title reveal" ref={addRevealRef}>Nutrition that<br />adapts to <span style={{ color: 'var(--color-primary)' }}>you</span></h2>
          <p className="section-sub reveal" style={{ textAlign: 'center', margin: '0 auto 36px' }} ref={addRevealRef}>
            Join BLANE and experience a nutrition system that grows smarter
            with every meal, every metric, and every market visit.
          </p>
          <div className="cta-actions reveal" ref={addRevealRef}>
            <a href="#" className="btn btn-primary btn-lg" onClick={(e) => { e.preventDefault(); openModal('register'); }}>Create free account</a>
            <a href="#" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); openModal('login'); }}>Sign in</a>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="footer" id="contact">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <a href="#" className="logo">
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z"/>
                  </svg>
                </div>
                <span className="logo-text"><span>BL</span>ANE</span>
              </a>
              <p>Biological Adaptive Nutrition Engine — an intelligent nutrition recommendation system for real life.</p>
            </div>

            <div>
              <div className="footer-col-title">Product</div>
              <ul className="footer-links">
                <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a></li>
                <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); openModal('register'); }}>Get Started</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); openModal('login'); }}>Sign In</a></li>
              </ul>
            </div>

            <div>
              <div className="footer-col-title">System</div>
              <ul className="footer-links">
                <li><a href="#">Dashboard</a></li>
                <li><a href="#">Meal Planner</a></li>
                <li><a href="#">Market Scan</a></li>
                <li><a href="#">Health Sync</a></li>
              </ul>
            </div>

            <div>
              <div className="footer-col-title">Info</div>
              <ul className="footer-links">
                <li><a href="#">About the Project</a></li>
                <li><a href="#">Research Paper</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Use</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2025 BLANE — Biological Adaptive Nutrition Engine. Capstone Project.</p>
            <div className="footer-bottom-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Contact</a>
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