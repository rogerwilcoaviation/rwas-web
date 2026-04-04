'use client';

import { useState } from 'react';

export default function LoanCalc() {
  const [amount, setAmount] = useState(15000);
  const [rate, setRate] = useState(7.5);
  const [years, setYears] = useState(5);

  const monthlyRate = rate / 100 / 12;
  const numPayments = years * 12;
  const monthly = monthlyRate > 0
    ? (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : amount / numPayments;
  const totalCost = monthly * numPayments;
  const totalInterest = totalCost - amount;

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>

      {/* Inputs */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontFamily: 'Arial, sans-serif', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px', color: '#555' }}>
          Loan Amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={{ width: '100%', border: '1px solid #1a1a1a', padding: '5px 7px', fontFamily: 'Georgia, serif', fontSize: '13px', background: '#fff' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'Arial, sans-serif', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px', color: '#555' }}>
            Interest Rate (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            style={{ width: '100%', border: '1px solid #1a1a1a', padding: '5px 7px', fontFamily: 'Georgia, serif', fontSize: '13px', background: '#fff' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: 'Arial, sans-serif', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px', color: '#555' }}>
            Term (Years)
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[3, 5, 7, 10].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  border: '1px solid #1a1a1a',
                  background: years === y ? '#1a1a1a' : '#fff',
                  color: years === y ? '#f7f4ef' : '#1a1a1a',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {y} Yr
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ border: '2px solid #1a1a1a', background: '#f7f4ef' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ padding: '8px', textAlign: 'center' as const, borderRight: '1px solid #1a1a1a' }}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#555', marginBottom: '2px' }}>Monthly Payment</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a0a0a' }}>{fmt(monthly)}</div>
          </div>
          <div style={{ padding: '8px', textAlign: 'center' as const, borderRight: '1px solid #1a1a1a' }}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#555', marginBottom: '2px' }}>Total Interest</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a0a0a' }}>{fmt(totalInterest)}</div>
          </div>
          <div style={{ padding: '8px', textAlign: 'center' as const }}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#555', marginBottom: '2px' }}>Total Cost</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a0a0a' }}>{fmt(totalCost)}</div>
          </div>
        </div>
        <div style={{ padding: '6px 8px', fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'italic' as const, color: '#666', textAlign: 'center' as const }}>
          Estimate only &mdash; contact RWAS for actual financing terms and rates
        </div>
      </div>
    </div>
  );
}
