'use client';

import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

type IndexItem = { value: string; label: string; disabled?: boolean };
const AccountContext = createContext<{ id: string; value: string } | null>(
  null,
);

export function AccountWorkspace({
  label,
  value,
  onValueChange,
  items,
  disabled = false,
  layout = 'sidebar',
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: IndexItem[];
  disabled?: boolean;
  layout?: 'sidebar' | 'tabs';
  children: ReactNode;
}) {
  const id = useId();
  const navigation = useRef<HTMLDivElement>(null);

  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    const keys = [
      'ArrowDown',
      'ArrowUp',
      'ArrowRight',
      'ArrowLeft',
      'Home',
      'End',
    ];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(
      navigation.current?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      ) || [],
    );
    if (!tabs.length) return;
    const current = tabs.indexOf(event.currentTarget);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (current +
              (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) +
              tabs.length) %
            tabs.length;
    tabs[next].focus();
    tabs[next].click();
  }

  return (
    <AccountContext.Provider value={{ id, value }}>
      <div
        className={`account-workspace ${layout === 'tabs' ? 'account-tabs' : ''}`}
      >
        <nav className="account-index" aria-label={label}>
          <p className="account-index-title">{label}</p>
          <div
            ref={navigation}
            role="tablist"
            aria-label={label}
            aria-orientation={layout === 'tabs' ? 'horizontal' : 'vertical'}
          >
            {items.map((item) => (
              <button
                key={item.value}
                id={`${id}-tab-${item.value}`}
                type="button"
                role="tab"
                aria-selected={value === item.value}
                aria-controls={
                  item.disabled ? undefined : `${id}-panel-${item.value}`
                }
                tabIndex={value === item.value ? 0 : -1}
                disabled={disabled || item.disabled}
                onClick={() => onValueChange(item.value)}
                onKeyDown={navigate}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="account-body">{children}</div>
      </div>
      <style jsx>{`
        .account-workspace {
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr);
          align-items: start;
          gap: 24px;
          margin-top: 24px;
          width: 100%;
          min-width: 0;
          color: #222;
          font-family: Arial, sans-serif;
        }
        .account-index {
          position: sticky;
          top: 16px;
          min-width: 0;
        }
        .account-index-title {
          margin: 0 0 12px;
          padding: 0 14px;
          color: #6b665c;
          font-size: 14px;
          font-weight: 600;
        }
        .account-index [role='tablist'] {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .account-index button {
          display: block;
          width: 100%;
          min-height: 44px;
          padding: 12px 14px;
          margin: 0;
          border: 0;
          border-left: 3px solid transparent;
          border-radius: 0;
          background: transparent;
          color: #403d37;
          font: inherit;
          font-size: 15px;
          line-height: 1.4;
          text-align: left;
          overflow-wrap: anywhere;
          cursor: pointer;
        }
        .account-index button:hover:not(:disabled) {
          background: #ebe5d9;
        }
        .account-index button[aria-selected='true'] {
          border-left-color: #b48b39;
          background: #222;
          color: #fff;
          font-weight: 600;
        }
        .account-index button[aria-selected='true']:hover {
          background: #333;
        }
        .account-index button:focus-visible {
          outline: 2px solid #8a681b;
          outline-offset: 3px;
        }
        .account-index button:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .account-body {
          min-width: 0;
          min-height: 420px;
          padding: 24px;
          border: 1px solid #d5cec1;
          background: #fff;
          overflow-wrap: anywhere;
        }
        .account-tabs {
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
          margin-top: 20px;
        }
        .account-tabs .account-index {
          position: static;
        }
        .account-tabs .account-index-title {
          padding: 0;
        }
        .account-tabs .account-index [role='tablist'] {
          flex-direction: row;
          flex-wrap: wrap;
          gap: 8px;
        }
        .account-tabs .account-index button {
          width: auto;
          border: 1px solid #d5cec1;
          border-bottom: 3px solid transparent;
          background: #f7f5ef;
          border-radius: 3px;
        }
        .account-tabs .account-index button[aria-selected='true'] {
          background: #222;
          color: white;
          border-bottom-color: #b99727;
        }
        .account-tabs .account-body {
          padding: 0;
          border: 0;
          min-height: 260px;
        }
        .account-body :global(h2) {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 12px;
        }
        .account-body :global(h3) {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px;
        }
        .account-body :global(h4) {
          font-size: 16px;
          font-weight: 600;
          margin: 24px 0 8px;
        }
        .account-body :global(form + form) {
          margin-top: 24px;
        }
        @media (max-width: 680px) {
          .account-workspace {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }
          .account-index {
            position: static;
          }
          .account-index-title {
            padding: 0;
          }
          .account-index [role='tablist'] {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .account-index button {
            padding: 10px;
            background: #eee9e0;
          }
          .account-body {
            min-height: 0;
            padding: 18px;
          }
          .account-tabs .account-index [role='tablist'] {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .account-tabs .account-index button {
            width: 100%;
          }
          .account-tabs .account-body {
            padding: 0;
          }
        }
      `}</style>
    </AccountContext.Provider>
  );
}

export function AccountSection({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const context = useContext(AccountContext);
  if (!context) throw new Error('AccountSection requires an AccountWorkspace.');
  return (
    <div
      id={`${context.id}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`${context.id}-tab-${value}`}
      hidden={context.value !== value}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
