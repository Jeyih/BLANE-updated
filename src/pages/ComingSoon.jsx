/* ============================================================
   Temporary placeholder — will be replaced page by page as we
   continue the migration. Delete this file once every route
   in App.jsx has a real component.
   ============================================================ */
export default function ComingSoon({ title }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '10px',
      background: '#060d0a', color: '#e8f5ee', fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700 }}>{title}</div>
      <div style={{ color: '#4d6e5a', fontSize: '14px' }}>Not migrated yet — coming in the next step.</div>
    </div>
  );
}
