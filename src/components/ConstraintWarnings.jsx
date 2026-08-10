/* ============================================================
   BLANE — Constraint Warning Components (Module 08)
   Replaces: renderConstraintBar(), getViolationBadgeHTML(),
   and getViolationDetailHTML() from js/constraints.js.
   ============================================================ */
import { CB_CONSTRAINTS } from '../lib/constraints';
import '../styles/constraints.css';

export function ConstraintActiveBar({ activeConstraints }) {
  if (activeConstraints.length === 0) {
    return (
      <div className="cb-active-bar">
        <span className="cb-active-bar-label">🛡️ Constraints:</span>
        <span className="cb-no-constraints">
          No dietary constraints set — <a href="/profile" style={{ color: '#2ddc7a' }}>add them in your profile</a>
        </span>
      </div>
    );
  }

  return (
    <div className="cb-active-bar">
      <span className="cb-active-bar-label">🛡️ Active constraints: <span>{activeConstraints.length}</span></span>
      <div className="cb-active-chips">
        {activeConstraints.map((key) => {
          const c = CB_CONSTRAINTS[key];
          return <span key={key} className={'cb-active-chip ' + c.severity}>{c.icon} {c.label}</span>;
        })}
      </div>
    </div>
  );
}

export function ViolationBadge({ violations }) {
  if (violations.length === 0) {
    return <span className="cb-violation-badge safe">✓ Constraint Safe</span>;
  }
  const order = { allergy: 0, medical: 1, dietary: 2 };
  const sorted = [...violations].sort((a, b) => order[a.severity] - order[b.severity]);
  const top = sorted[0];
  const moreCount = violations.length - 1;

  return (
    <span className={'cb-violation-badge ' + top.severity}>
      {top.icon} {top.constraintLabel}{moreCount > 0 ? ' +' + moreCount : ''}
    </span>
  );
}

export function ViolationDetail({ violations }) {
  if (violations.length === 0) return null;

  const allergies = violations.filter((v) => v.severity === 'allergy');
  const medicals   = violations.filter((v) => v.severity === 'medical');
  const dietaries  = violations.filter((v) => v.severity === 'dietary');

  return (
    <div className="cb-modal-section">
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: '#e8f5ee', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        🛡️ Constraint Warnings
        <span style={{ fontSize: 11, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 100, padding: '2px 8px', fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>
          {violations.length} flag{violations.length > 1 ? 's' : ''}
        </span>
      </div>

      <ViolationGroup items={allergies} sev="allergy" header="Allergy Alert — these ingredients conflict with your allergy profile." />
      <ViolationGroup items={medicals}  sev="medical" header="Medical Advisory — review with your healthcare provider." />
      <ViolationGroup items={dietaries} sev="dietary" header="Dietary Preference — this recipe contains restricted items." />
    </div>
  );
}

function ViolationGroup({ items, sev, header }) {
  if (items.length === 0) return null;
  const icon = sev === 'allergy' ? '🚨' : sev === 'medical' ? '⚕️' : '⚠️';

  return (
    <>
      <div className={'cb-modal-header ' + sev}>
        <span className="cb-modal-header-icon">{icon}</span>
        <div className="cb-modal-header-text"><strong>{header}</strong></div>
      </div>
      <div className="cb-violation-list" style={{ marginBottom: 10 }}>
        {items.map((v, i) => (
          <div key={i} className="cb-violation-row">
            <span style={{ fontSize: 14 }}>{v.icon}</span>
            <div className="cb-violation-row-ing">{v.ingredient}</div>
            <div className="cb-violation-row-reason">{v.reason}</div>
            <span className={'cb-violation-severity ' + sev}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
          </div>
        ))}
      </div>
    </>
  );
}