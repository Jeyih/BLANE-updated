import React from 'react';
import { useState } from 'react';
import '../styles/password-input.css';
function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return React.createElement(
    'div',
    { className: 'password-input-wrap' },
    React.createElement('input', {
      ...props,
      className: `${className} password-input`,
      type: visible ? 'text' : 'password',
    }),
    React.createElement(
      'button',
      {
        className: 'password-visibility-toggle',
        type: 'button',
        'aria-label': visible ? 'Hide password' : 'Show password',
        'aria-controls': props.id,
        'aria-pressed': visible,
        disabled: props.disabled,
        onClick: () => setVisible((current) => !current),
      },
      React.createElement(
        'svg',
        {
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '1.8',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        React.createElement('path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z' }),
        React.createElement('circle', { cx: '12', cy: '12', r: '3' }),
        visible && React.createElement('path', { d: 'M3 3l18 18' }),
      ),
    ),
  );
}
export { PasswordInput as default };
