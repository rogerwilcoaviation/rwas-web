'use client';

export default function AccountSecurityStyles() {
  return (
    <style jsx global>{`
      [data-rwas-better-auth-account].seller-security {
        min-width: 0;
        color: #25251f;
        font:
          15px/1.6 Arial,
          sans-serif;
      }
      [data-rwas-better-auth-account].seller-security .security-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
      }
      [data-rwas-better-auth-account].seller-security .security-header h3 {
        margin: 0 0 8px;
        font:
          600 24px/1.3 Arial,
          sans-serif;
      }
      [data-rwas-better-auth-account].seller-security .security-header p {
        margin: 0;
        max-width: 62ch;
        color: #625d54;
      }
      [data-rwas-better-auth-account].seller-security .security-identity {
        margin-bottom: 24px;
        padding: 14px 18px;
        border-left: 3px solid #b48b39;
        background: #f7f4ef;
        overflow-wrap: anywhere;
      }
      [data-rwas-better-auth-account].seller-security .security-identity p {
        margin: 0;
      }
      [data-rwas-better-auth-account].seller-security .security-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
      }
      [data-rwas-better-auth-account].seller-security .security-card {
        min-width: 0;
        margin: 0;
        padding: 22px;
        border: 1px solid #d5d0c7;
        background: #fff;
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      [data-rwas-better-auth-account].seller-security .security-wide {
        grid-column: 1 / -1;
      }
      [data-rwas-better-auth-account].seller-security .security-card h4 {
        margin: 0 0 8px;
        color: #25251f;
        font:
          600 18px/1.4 Arial,
          sans-serif;
      }
      [data-rwas-better-auth-account].seller-security .security-card p {
        margin: 0 0 16px;
        max-width: 66ch;
        overflow-wrap: anywhere;
      }
      [data-rwas-better-auth-account].seller-security
        .security-card
        .security-help {
        color: #625d54;
        font-size: 14px;
      }
      [data-rwas-better-auth-account].seller-security
        .security-card
        .seller-field {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        margin: 0 0 18px;
        font:
          600 14px/1.5 Arial,
          sans-serif;
        max-width: 480px;
        min-width: 0;
      }
      [data-rwas-better-auth-account].seller-security
        .security-card
        .seller-field
        input,
      [data-rwas-better-auth-account].seller-security
        .security-card
        .seller-field
        textarea {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        min-height: 46px;
        padding: 11px 12px;
        margin: 0;
        border: 1px solid #8e877b;
        border-radius: 3px;
        background: #fff;
        color: #222;
        font:
          400 16px/1.5 Arial,
          sans-serif;
      }
      [data-rwas-better-auth-account].seller-security
        .security-card
        .seller-field
        small {
        color: #625d54;
        font-weight: 400;
        font-size: 13px;
      }
      [data-rwas-better-auth-account].seller-security .security-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 4px;
      }
      [data-rwas-better-auth-account].seller-security
        form.security-card
        > .security-actions {
        margin-top: auto;
        padding-top: 4px;
      }
      [data-rwas-better-auth-account].seller-security button.security-button {
        align-self: flex-start;
        min-height: 44px;
        max-width: 100%;
        margin: 0;
        padding: 10px 16px;
        border: 1px solid #8e877b;
        border-radius: 3px;
        background: #fff;
        color: #25251f;
        font:
          600 14px/1.5 Arial,
          sans-serif;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      [data-rwas-better-auth-account].seller-security button.security-primary {
        background: #222;
        border-color: #222;
        color: #fff;
      }
      [data-rwas-better-auth-account].seller-security button.security-danger {
        color: #8d2920;
        border-color: #b57b73;
      }
      [data-rwas-better-auth-account].seller-security
        button.security-button:hover:not(:disabled) {
        background: #f0ece4;
      }
      [data-rwas-better-auth-account].seller-security
        button.security-primary:hover:not(:disabled) {
        background: #3b3933;
      }
      [data-rwas-better-auth-account].seller-security .security-feedback {
        padding: 12px 16px;
        margin: 0 0 20px;
        border: 1px solid #c5d5bf;
        background: #f4f8f1;
        overflow-wrap: anywhere;
      }
      [data-rwas-better-auth-account].seller-security
        .security-feedback[role='alert'] {
        border-color: #d8b8b0;
        background: #fff5f2;
        color: #8d2920;
      }
      [data-rwas-better-auth-account].seller-security .security-card-heading {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 8px 16px;
        margin-bottom: 8px;
      }
      [data-rwas-better-auth-account].seller-security .security-badge {
        padding: 4px 10px;
        border: 1px solid #c9c2b4;
        border-radius: 3px;
        color: #514a3b;
        background: #f7f4ef;
        font:
          600 12px/1.5 Arial,
          sans-serif;
      }
      [data-rwas-better-auth-account].seller-security .security-badge-enabled {
        color: #31512a;
        background: #f1f6ed;
        border-color: #b7c7ac;
      }
      [data-rwas-better-auth-account].seller-security .security-session-list {
        list-style: none;
        padding: 0;
        margin: 0 0 20px;
      }
      [data-rwas-better-auth-account].seller-security .security-session {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 0;
        border-top: 1px solid #e3ded5;
        min-width: 0;
      }
      [data-rwas-better-auth-account].seller-security .security-session strong {
        display: block;
        margin-bottom: 4px;
        font-weight: 600;
      }
      [data-rwas-better-auth-account].seller-security .security-session dl {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 24px;
        margin: 0;
        font-size: 13px;
        color: #625d54;
      }
      [data-rwas-better-auth-account].seller-security .security-session dl div {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      [data-rwas-better-auth-account].seller-security .security-session dt,
      [data-rwas-better-auth-account].seller-security .security-session dd {
        margin: 0;
      }
      [data-rwas-better-auth-account].seller-security .security-recovery {
        margin-top: 20px;
        padding: 18px;
        border: 1px solid #d9c88f;
        background: #fbf8ee;
      }
      [data-rwas-better-auth-account].seller-security .security-recovery ul {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        padding: 0;
        list-style: none;
        overflow-wrap: anywhere;
      }
      [data-rwas-better-auth-account].seller-security details {
        margin: 16px 0;
      }
      [data-rwas-better-auth-account].seller-security summary {
        cursor: pointer;
      }
      [data-rwas-better-auth-account].seller-security .security-reauth {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
        padding: 18px;
        margin-bottom: 24px;
        border: 1px solid #d9c88f;
        background: #fbf8ee;
      }
      [data-rwas-better-auth-account].seller-security .security-reauth p {
        max-width: 60ch;
        margin: 4px 0 0;
        color: #625d54;
      }
      @media (max-width: 1000px) {
        [data-rwas-better-auth-account].seller-security .security-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @media (max-width: 520px) {
        [data-rwas-better-auth-account].seller-security .security-header,
        [data-rwas-better-auth-account].seller-security .security-session {
          flex-direction: column;
          align-items: stretch;
        }
        [data-rwas-better-auth-account].seller-security .security-header h3 {
          font-size: 22px;
        }
        [data-rwas-better-auth-account].seller-security .security-card {
          padding: 16px;
        }
        [data-rwas-better-auth-account].seller-security .security-grid {
          gap: 16px;
        }
        [data-rwas-better-auth-account].seller-security
          .security-actions
          > button {
          width: 100%;
        }
      }
    `}</style>
  );
}
