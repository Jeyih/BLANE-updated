import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import '../styles/landing.css';
const FEATURES = [
  {
    icon: '\u{1F504}',
    num: 'Module 01',
    name: 'Body Feedback Loop',
    desc: 'Record weight, sleep, water and activity yourself. Review your entries alongside your nutrition goals.',
  },
  {
    icon: '\u{1F4C9}',
    num: 'Module 02',
    name: 'Health Drift Detection',
    desc: 'Review trends in your recorded health data and see when your recent entries differ from your usual pattern.',
  },
  {
    icon: '\u2696\uFE0F',
    num: 'Module 03',
    name: 'Dynamic Portion Optimizer',
    desc: 'Explore portion adjustments using your profile, calorie target and available recipe information.',
  },
  {
    icon: '\u{1F4CD}',
    num: 'Module 04',
    name: 'GeoMarket Ingredient Scanner',
    desc: 'Explore listed markets and stored ingredient information. Location access helps sort nearby options.',
  },
  {
    icon: '\u{1F4B8}',
    num: 'Module 05 & 06',
    name: 'Price-Aware & Seasonal Optimizer',
    desc: 'Compare estimated ingredient costs from Philippine price references and review seasonal labels to support your planning. Actual store prices and stock may vary.',
    wide: true,
  },
  {
    icon: '\u{1F4A1}',
    num: 'Module 07',
    name: 'Explainable AI',
    desc: 'Read recommendation reasons and request AI explanations to help you understand suggested meals.',
  },
  {
    icon: '\u{1F6AB}',
    num: 'Module 08',
    name: 'Constraint-Based Planning',
    desc: 'Apply your dietary preferences and restriction checks. Always review ingredients and warnings before choosing a meal.',
  },
  {
    icon: '\u{1F4D6}',
    num: 'Module 09',
    name: 'Recipe Recommendation',
    desc: 'Browse recipes, inspect ingredients and nutrition details, and add a recipe to today\u2019s meal plan.',
  },
];
const STEPS = [
  {
    icon: '\u{1F4CA}',
    title: 'Set up your profile',
    desc: 'Enter your goals, preferences and health records manually.',
  },
  {
    icon: '\u{1F9E0}',
    title: 'Review suggestions',
    desc: 'Explore recipe suggestions and portion options based on your profile.',
  },
  {
    icon: '\u{1F5FA}\uFE0F',
    title: 'Check the details',
    desc: 'Review ingredients, estimated costs and listed market information.',
  },
  {
    icon: '\u{1F37D}\uFE0F',
    title: 'Plan your meals',
    desc: 'Add meals to your plan and keep track of what you have eaten.',
  },
];
function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('login');
  const revealRefs = useRef([]);
  useEffect(() => {
    if (!loading && session) navigate('/dashboard');
  }, [loading, session, navigate]);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 },
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
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'nav',
      { 'aria-label': 'Main navigation', className: 'navbar' + (scrolled ? ' scrolled' : '') },
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement(
          'div',
          { className: 'navbar-inner' },
          React.createElement(
            'a',
            { href: '#home', className: 'logo' },
            React.createElement(
              'div',
              { className: 'logo-icon' },
              React.createElement(
                'svg',
                { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                React.createElement('path', {
                  d: 'M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z',
                }),
              ),
            ),
            React.createElement(
              'span',
              { className: 'logo-text' },
              React.createElement('span', null, 'BL'),
              'ANE',
            ),
          ),
          React.createElement(
            'ul',
            { className: 'nav-links' },
            React.createElement(
              'li',
              null,
              React.createElement(
                'a',
                {
                  href: '#features',
                  onClick: (e) => {
                    e.preventDefault();
                    scrollToSection('features');
                  },
                },
                'Features',
              ),
            ),
            React.createElement(
              'li',
              null,
              React.createElement(
                'a',
                {
                  href: '#how-it-works',
                  onClick: (e) => {
                    e.preventDefault();
                    scrollToSection('how-it-works');
                  },
                },
                'How It Works',
              ),
            ),
            React.createElement(
              'li',
              null,
              React.createElement(
                'a',
                {
                  href: '#about',
                  onClick: (e) => {
                    e.preventDefault();
                    scrollToSection('about');
                  },
                },
                'About',
              ),
            ),
            React.createElement(
              'li',
              null,
              React.createElement(
                'a',
                {
                  href: '#contact',
                  onClick: (e) => {
                    e.preventDefault();
                    scrollToSection('contact');
                  },
                },
                'Contact',
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'nav-cta' },
            React.createElement(
              'a',
              {
                href: '#',
                className: 'btn btn-outline',
                onClick: (e) => {
                  e.preventDefault();
                  openModal('login');
                },
              },
              'Sign in',
            ),
            React.createElement(
              'a',
              {
                href: '#',
                className: 'btn btn-primary',
                onClick: (e) => {
                  e.preventDefault();
                  openModal('register');
                },
              },
              'Get Started',
            ),
          ),
          React.createElement(
            'button',
            {
              className: 'hamburger' + (mobileOpen ? ' active' : ''),
              type: 'button',
              'aria-label': 'Toggle navigation',
              'aria-expanded': mobileOpen,
              'aria-controls': 'landing-mobile-menu',
              onClick: () => setMobileOpen((v) => !v),
            },
            React.createElement('span', null),
            React.createElement('span', null),
            React.createElement('span', null),
          ),
        ),
        React.createElement(
          'div',
          { id: 'landing-mobile-menu', className: 'mobile-menu' + (mobileOpen ? ' open' : '') },
          React.createElement(
            'a',
            {
              href: '#features',
              onClick: (e) => {
                e.preventDefault();
                scrollToSection('features');
              },
            },
            'Features',
          ),
          React.createElement(
            'a',
            {
              href: '#how-it-works',
              onClick: (e) => {
                e.preventDefault();
                scrollToSection('how-it-works');
              },
            },
            'How It Works',
          ),
          React.createElement(
            'a',
            {
              href: '#about',
              onClick: (e) => {
                e.preventDefault();
                scrollToSection('about');
              },
            },
            'About',
          ),
          React.createElement(
            'a',
            {
              href: '#contact',
              onClick: (e) => {
                e.preventDefault();
                scrollToSection('contact');
              },
            },
            'Contact',
          ),
          React.createElement(
            'a',
            {
              href: '#',
              className: 'btn btn-outline',
              onClick: (e) => {
                e.preventDefault();
                openModal('login');
              },
            },
            'Sign in',
          ),
          React.createElement(
            'a',
            {
              href: '#',
              className: 'btn btn-primary',
              onClick: (e) => {
                e.preventDefault();
                openModal('register');
              },
            },
            'Get Started',
          ),
        ),
      ),
    ),
    React.createElement(
      'section',
      { className: 'hero', id: 'home' },
      React.createElement(
        'div',
        { className: 'hero-bg' },
        React.createElement('div', { className: 'glow-blob' }),
        React.createElement('div', { className: 'glow-blob' }),
        React.createElement('div', { className: 'hero-grid' }),
      ),
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement(
          'div',
          { className: 'hero-content' },
          React.createElement(
            'div',
            { className: 'hero-text' },
            React.createElement(
              'div',
              { className: 'hero-badge' },
              React.createElement('div', { className: 'hero-badge-dot' }),
              React.createElement(
                'span',
                { className: 'hero-badge-text' },
                'AI-Powered Nutrition Intelligence',
              ),
            ),
            React.createElement(
              'h1',
              { className: 'hero-title' },
              'Eat smarter',
              React.createElement('br', null),
              'with ',
              React.createElement('span', { className: 'highlight' }, 'adaptive'),
              React.createElement('br', null),
              'nutrition AI',
            ),
            React.createElement(
              'p',
              { className: 'hero-desc' },
              'Use your profile, manually recorded health data and Philippine food references to explore meal ideas, review estimated costs and plan around your goals and budget.',
            ),
            React.createElement(
              'div',
              { className: 'hero-actions' },
              React.createElement(
                'a',
                {
                  href: '#',
                  className: 'btn btn-primary btn-lg',
                  onClick: (e) => {
                    e.preventDefault();
                    openModal('register');
                  },
                },
                'Start for free',
                React.createElement(
                  'svg',
                  {
                    className: 'btn-icon',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: '2.5',
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  },
                  React.createElement('path', { d: 'M5 12h14M12 5l7 7-7 7' }),
                ),
              ),
              React.createElement(
                'a',
                {
                  href: '#features',
                  className: 'btn btn-outline btn-lg',
                  onClick: (e) => {
                    e.preventDefault();
                    scrollToSection('features');
                  },
                },
                'See how it works',
              ),
            ),
            React.createElement(
              'div',
              { className: 'hero-stats' },
              React.createElement(
                'div',
                { className: 'hero-stat' },
                React.createElement('span', { className: 'hero-stat-number' }, '9'),
                React.createElement('div', { className: 'hero-stat-label' }, 'Planning modules'),
              ),
              React.createElement(
                'div',
                { className: 'hero-stat' },
                React.createElement('span', { className: 'hero-stat-number' }, 'Your data'),
                React.createElement('div', { className: 'hero-stat-label' }, 'Manually recorded'),
              ),
              React.createElement(
                'div',
                { className: 'hero-stat' },
                React.createElement('span', { className: 'hero-stat-number' }, 'Local'),
                React.createElement(
                  'div',
                  { className: 'hero-stat-label' },
                  'Philippine references',
                ),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'hero-visual' },
            React.createElement(
              'div',
              { className: 'hero-card-main planning-preview' },
              React.createElement(
                'div',
                { className: 'card-header' },
                React.createElement(
                  'span',
                  { className: 'card-title-sm' },
                  'Your everyday meal plan',
                ),
                React.createElement('span', { className: 'card-badge' }, 'Made around you'),
              ),
              React.createElement(
                'div',
                { className: 'preview-heading-icon', 'aria-hidden': 'true' },
                '\u{1F37D}\uFE0F',
              ),
              React.createElement(
                'h2',
                null,
                'A little planning.',
                React.createElement('br', null),
                'An easier mealtime.',
              ),
              React.createElement(
                'p',
                { className: 'preview-intro' },
                'Set up your profile to see meals and nutrition information that fit your goals.',
              ),
              React.createElement(
                'ol',
                { className: 'preview-checklist' },
                React.createElement(
                  'li',
                  null,
                  React.createElement(
                    'span',
                    { className: 'preview-step-number', 'aria-hidden': 'true' },
                    '1',
                  ),
                  React.createElement(
                    'div',
                    null,
                    React.createElement('strong', null, 'Start with your goals'),
                    React.createElement('p', null, 'Your preferences guide the recipes you see.'),
                  ),
                ),
                React.createElement(
                  'li',
                  null,
                  React.createElement(
                    'span',
                    { className: 'preview-step-number', 'aria-hidden': 'true' },
                    '2',
                  ),
                  React.createElement(
                    'div',
                    null,
                    React.createElement('strong', null, 'Review the ingredients'),
                    React.createElement(
                      'p',
                      null,
                      'See nutrition details and available cost estimates.',
                    ),
                  ),
                ),
                React.createElement(
                  'li',
                  null,
                  React.createElement(
                    'span',
                    { className: 'preview-step-number', 'aria-hidden': 'true' },
                    '3',
                  ),
                  React.createElement(
                    'div',
                    null,
                    React.createElement('strong', null, 'Use a meal today'),
                    React.createElement('p', null, 'Add it to your plan with one tap.'),
                  ),
                ),
              ),
              React.createElement(
                'p',
                { className: 'preview-estimate-note' },
                'Prices are estimates in Philippine pesos. Actual store totals may vary.',
              ),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      'section',
      { className: 'section', id: 'features' },
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement(
          'span',
          { className: 'section-label reveal', ref: addRevealRef },
          'Core Features',
        ),
        React.createElement(
          'h2',
          { className: 'section-title reveal', ref: addRevealRef },
          'Nine connected',
          React.createElement('br', null),
          'nutrition modules',
        ),
        React.createElement(
          'p',
          { className: 'section-sub reveal', ref: addRevealRef },
          'Explore connected tools for meal planning, nutrition information, health logs and estimated ingredient costs.',
        ),
        React.createElement(
          'div',
          { className: 'features-grid' },
          FEATURES.map((f) =>
            React.createElement(
              'div',
              {
                key: f.num,
                className: 'feature-card reveal' + (f.wide ? ' wide' : ''),
                ref: addRevealRef,
              },
              React.createElement('div', { className: 'feature-icon-wrap' }, f.icon),
              React.createElement('div', { className: 'feature-num' }, f.num),
              React.createElement('div', { className: 'feature-name' }, f.name),
              React.createElement('p', { className: 'feature-desc' }, f.desc),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      'section',
      { className: 'section how-it-works', id: 'how-it-works' },
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement(
          'span',
          { className: 'section-label reveal', ref: addRevealRef },
          'Process',
        ),
        React.createElement(
          'h2',
          { className: 'section-title reveal', ref: addRevealRef },
          'How BLANE works',
        ),
        React.createElement(
          'p',
          { className: 'section-sub reveal', ref: addRevealRef },
          'From data to plate in four intelligent steps.',
        ),
        React.createElement(
          'div',
          { className: 'steps-list' },
          STEPS.map((s) =>
            React.createElement(
              'div',
              { key: s.title, className: 'step-item reveal', ref: addRevealRef },
              React.createElement('div', { className: 'step-dot' }, s.icon),
              React.createElement('div', { className: 'step-title' }, s.title),
              React.createElement('p', { className: 'step-desc' }, s.desc),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'process-highlights' },
          React.createElement(
            'div',
            { className: 'hero-float-card' },
            React.createElement(
              'div',
              { className: 'float-icon', 'aria-hidden': 'true' },
              '\u{1F4CD}',
            ),
            React.createElement(
              'div',
              null,
              React.createElement('div', { className: 'float-text-main' }, 'Explore markets'),
              React.createElement(
                'div',
                { className: 'float-text-sub' },
                'Review listed ingredients',
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'hero-float-card' },
            React.createElement(
              'div',
              { className: 'float-icon', 'aria-hidden': 'true' },
              '\u{1F9E0}',
            ),
            React.createElement(
              'div',
              null,
              React.createElement('div', { className: 'float-text-main' }, 'AI Explained'),
              React.createElement(
                'div',
                { className: 'float-text-sub' },
                'Understand your meal options',
              ),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      'section',
      { className: 'section cta-section', id: 'about' },
      React.createElement('div', { className: 'glow-blob' }),
      React.createElement(
        'div',
        { className: 'container', style: { position: 'relative', zIndex: 1 } },
        React.createElement(
          'span',
          {
            className: 'section-label reveal',
            style: { justifyContent: 'center' },
            ref: addRevealRef,
          },
          'Get Started',
        ),
        React.createElement(
          'h2',
          { className: 'section-title reveal', ref: addRevealRef },
          'Nutrition that',
          React.createElement('br', null),
          'adapts to ',
          React.createElement('span', { style: { color: 'var(--color-primary)' } }, 'you'),
        ),
        React.createElement(
          'p',
          {
            className: 'section-sub reveal',
            style: { textAlign: 'center', margin: '0 auto 36px' },
            ref: addRevealRef,
          },
          'Set your goals, review recipes and bring a little more structure to your everyday meals.',
        ),
        React.createElement(
          'div',
          { className: 'cta-actions reveal', ref: addRevealRef },
          React.createElement(
            'a',
            {
              href: '#',
              className: 'btn btn-primary btn-lg',
              onClick: (e) => {
                e.preventDefault();
                openModal('register');
              },
            },
            'Create free account',
          ),
          React.createElement(
            'a',
            {
              href: '#',
              className: 'btn btn-outline btn-lg',
              onClick: (e) => {
                e.preventDefault();
                openModal('login');
              },
            },
            'Sign in',
          ),
        ),
      ),
    ),
    React.createElement(
      'section',
      {
        className: 'section landing-data-section',
        id: 'your-data',
        'aria-labelledby': 'landing-data-title',
      },
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement('span', { className: 'section-label' }, 'Before you begin'),
        React.createElement(
          'h2',
          { className: 'section-title', id: 'landing-data-title' },
          'Your data and estimates',
        ),
        React.createElement(
          'div',
          { className: 'landing-data-grid' },
          React.createElement(
            'div',
            null,
            React.createElement('h3', null, 'Information you enter'),
            React.createElement(
              'p',
              null,
              'Your account, profile and submitted health logs are handled through Supabase. Health information comes from your entries; BLANE does not connect to wearables or continuously measure your body.',
            ),
            React.createElement(
              'p',
              null,
              'Meal plans and completion marks are stored in this browser. Grocery entries are kept for the browser session, so these records may not appear on another device.',
            ),
          ),
          React.createElement(
            'div',
            null,
            React.createElement('h3', null, 'Reference prices and guidance'),
            React.createElement(
              'p',
              null,
              'Meal costs use Philippine DA and store references. Prices are checked automatically while an active page uses the price feed; updates depend on source availability. Read the source and estimate labels before budgeting.',
            ),
            React.createElement(
              'p',
              null,
              'Listed markets, seasonal labels and AI suggestions are planning aids. They do not guarantee current stock or replace advice from a qualified nutrition professional.',
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      'footer',
      { className: 'footer', id: 'contact' },
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement(
          'div',
          { className: 'footer-inner' },
          React.createElement(
            'div',
            { className: 'footer-brand' },
            React.createElement(
              'a',
              { href: '#home', className: 'logo' },
              React.createElement(
                'span',
                { className: 'logo-text' },
                React.createElement('span', null, 'BL'),
                'ANE',
              ),
            ),
            React.createElement(
              'p',
              null,
              'Biological Adaptive Nutrition Engine. A capstone project for practical meal planning in Tarlac City.',
            ),
          ),
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'footer-col-title' }, 'Explore'),
            React.createElement(
              'ul',
              { className: 'footer-links' },
              React.createElement(
                'li',
                null,
                React.createElement(
                  'a',
                  {
                    href: '#features',
                    onClick: (e) => {
                      e.preventDefault();
                      scrollToSection('features');
                    },
                  },
                  'Features',
                ),
              ),
              React.createElement(
                'li',
                null,
                React.createElement(
                  'a',
                  {
                    href: '#how-it-works',
                    onClick: (e) => {
                      e.preventDefault();
                      scrollToSection('how-it-works');
                    },
                  },
                  'How it works',
                ),
              ),
              React.createElement(
                'li',
                null,
                React.createElement(
                  'a',
                  {
                    href: '#about',
                    onClick: (e) => {
                      e.preventDefault();
                      scrollToSection('about');
                    },
                  },
                  'About the project',
                ),
              ),
              React.createElement(
                'li',
                null,
                React.createElement(
                  'a',
                  {
                    href: '#your-data',
                    onClick: (e) => {
                      e.preventDefault();
                      scrollToSection('your-data');
                    },
                  },
                  'Data and price information',
                ),
              ),
            ),
          ),
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'footer-col-title' }, 'Get started'),
            React.createElement(
              'ul',
              { className: 'footer-links' },
              React.createElement(
                'li',
                null,
                React.createElement(
                  'button',
                  { type: 'button', onClick: () => openModal('register') },
                  'Create an account',
                ),
              ),
              React.createElement(
                'li',
                null,
                React.createElement(
                  'button',
                  { type: 'button', onClick: () => openModal('login') },
                  'Sign in to your dashboard',
                ),
              ),
            ),
          ),
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'footer-col-title' }, 'Questions or feedback?'),
            React.createElement(
              'p',
              { className: 'footer-help' },
              'Sign in and choose Feedback in the navigation menu to send a message to the project team.',
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'btn btn-outline footer-help-button',
                onClick: () => openModal('login'),
              },
              'Sign in for feedback',
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'footer-bottom' },
          React.createElement(
            'p',
            null,
            '\xA9 ',
            new Date().getFullYear(),
            ' BLANE \xB7 Capstone Project',
          ),
          React.createElement(
            'div',
            { className: 'footer-bottom-links' },
            React.createElement(
              'a',
              {
                href: '#your-data',
                onClick: (e) => {
                  e.preventDefault();
                  scrollToSection('your-data');
                },
              },
              'Data and estimates',
            ),
            React.createElement(
              'a',
              {
                href: '#home',
                onClick: (e) => {
                  e.preventDefault();
                  scrollToSection('home');
                },
              },
              'Back to top \u2191',
            ),
          ),
        ),
      ),
    ),
    React.createElement(AuthModal, {
      open: modalOpen,
      tab: modalTab,
      onClose: () => setModalOpen(false),
      onSwitchTab: setModalTab,
    }),
  );
}
export { Landing as default };
