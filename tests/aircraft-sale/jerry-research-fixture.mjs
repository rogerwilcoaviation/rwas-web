export const advisoryResearch = {
  status: 'completed',
  recommendation: 'needs_attention',
  completedAt: Date.now(),
  summary: 'Synthetic advisory report. Administrator approval is required.',
  findings: ['The aircraft model differs from the registry response.'],
  evidence: {
    email: {
      status: 'collected',
      summary:
        'Mail service is advertised; mailbox identity is not established.',
      domain: 'example.test',
    },
    business: {
      status: 'unavailable',
      summary: 'Business website could not be collected.',
    },
    faa: {
      status: 'needs_attention',
      summary: 'Compare the aircraft identifiers before deciding.',
      matches: { model: 'different' },
      aircraft: {
        model: 'Synthetic Registry Model',
        registrationStatus: 'Valid',
      },
      sources: [
        'https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=123AB',
      ],
    },
  },
};
