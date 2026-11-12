/** Plain-language explanations for payment failure codes (sample set for the prototype). */
export const FAILURE_CODES: Record<string, { plain: string; action: string }> = {
  '51': {
    plain: "The customer's bank declined it (not enough funds).",
    action: 'Ask the customer to pay another way. Nothing is wrong with your terminal.',
  },
  '05': {
    plain: "The customer's bank declined it.",
    action: 'Ask the customer to try another card or method, or to contact their bank.',
  },
  '91': {
    plain: "The bank's system was briefly unavailable.",
    action: 'Try again in a minute. If it keeps happening, contact NETS support.',
  },
  TO: {
    plain: 'The payment timed out before the customer confirmed.',
    action: 'Ask the customer to scan or tap again.',
  },
  CX: {
    plain: 'The customer cancelled the payment.',
    action: 'No action needed unless the customer still wants to pay.',
  },
}

export function explainFailure(code: string | null | undefined) {
  return (code && FAILURE_CODES[code]) || {
    plain: 'The payment did not go through.',
    action: 'Ask the customer to try again or pay another way.',
  }
}
