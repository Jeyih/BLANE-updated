import React from 'react';
function ComingSoon({ title }) {
  return React.createElement(
    'div',
    {
      style: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '10px',
        background: '#060d0a',
        color: '#e8f5ee',
        fontFamily: 'DM Sans, sans-serif',
      },
    },
    React.createElement(
      'div',
      { style: { fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700 } },
      title,
    ),
    React.createElement(
      'div',
      { style: { color: '#4d6e5a', fontSize: '14px' } },
      'Not migrated yet \u2014 coming in the next step.',
    ),
  );
}
export { ComingSoon as default };
