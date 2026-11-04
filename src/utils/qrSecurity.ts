import { QRPayload, SecurityAssessment, SecurityIndicator } from '@/types/stage2';

const SUSPICIOUS_TLDS = ['xyz', 'top', 'click', 'link', 'tk', 'ml', 'ga', 'cf', 'gq', 'buzz', 'work', 'date', 'stream', 'download', 'rest', 'fit', 'sbs', 'cyou', 'cam', 'live', 'monster', 'rip', 'wang', 'bid'];
const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 'shorte.st', 'soo.gd', 'tiny.cc', 'surl.li', 'v.gd'];
const SUSPICIOUS_KEYWORDS = ['free', 'win', 'winner', 'prize', 'gift', 'offer', 'limited', 'urgent', 'verify', 'otp', 'pin', 'kyc', 'blocked', 'suspend', 'reward', 'cashback', 'lucky', 'claim', 'lottery', 'sweepstake', 'contest', 'expired', 'update', 'confirm', 'secure', 'login', 'account', 'password', 'reset', 'unlock', 'reactivate'];

const KNOWN_SAFE_DOMAINS = [
  'upi://', 'payto.do', 'razorpay.com', 'paytm.com', 'phonepe.com', 'gpay.com',
  'bharatpe.in', 'bharatpe.com', 'nipostal.gov.in', 'irctc.co.in',
  'hdfcbank.com', 'sbicard.com', 'icicibank.com', 'axisbank.com',
  'sbi.co.in', 'kotak.com', 'yesbank.in', 'idbibank.co.in',
  'pnb.co.in', 'canarabank.com', 'unionbankofindia.co.in',
  'rbi.org.in', 'onlinesbi.com', 'billdesk.com', 'paisabazaar.com',
  'gmail.com', 'google.com', 'youtube.com', 'facebook.com',
  'amazon.in', 'flipkart.com',
];

const KNOWN_BRANDS: Record<string, string[]> = {
  'hdfc': ['hdfcbank.com', 'hdfc.com'],
  'sbi': ['sbi.co.in', 'onlinesbi.com', 'sbicard.com'],
  'icici': ['icicibank.com', 'icici.com'],
  'axis': ['axisbank.com', 'axis.com'],
  'kotak': ['kotak.com', 'kotakbank.com'],
  'paytm': ['paytm.com', 'paytm.in'],
  'phonepe': ['phonepe.com', 'phonepe.in'],
  'gpay': ['gpay.com', 'pay.google.com'],
  'amazon': ['amazon.in', 'amazon.com'],
  'flipkart': ['flipkart.com'],
  'google': ['google.com', 'gmail.com'],
  'whatsapp': ['whatsapp.com'],
  'irctc': ['irctc.co.in'],
  'rupay': ['rupay.com'],
  'visa': ['visa.com'],
  'mastercard': ['mastercard.com'],
  'ybl': ['ybl.com'],
  'okaxis': [],
  'okhdfcbank': [],
  'oksbi': [],
  'okicici': [],
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function isSimilarDomain(hostname: string, brandDomain: string): boolean {
  const h = hostname.replace(/^www\./, '');
  const b = brandDomain.replace(/^www\./, '');
  if (h === b) return false;
  if (h.endsWith('.' + b)) return false;
  const distance = levenshtein(h.split('.')[0], b.split('.')[0]);
  if (distance === 0 && h !== b) return true;
  return distance > 0 && distance <= 2 && h.length >= 4;
}

function getDomainParts(hostname: string): { sld: string; tld: string; full: string } {
  const parts = hostname.split('.');
  if (parts.length < 2) return { sld: hostname, tld: '', full: hostname };
  const tld = parts.slice(-2).join('.');
  const sld = parts[parts.length - 2];
  return { sld, tld: parts[parts.length - 1], full: tld };
}

export function parseUPIPayload(raw: string): QRPayload {
  const trimmed = raw.trim();

  if (trimmed.toLowerCase().startsWith('upi://')) {
    const params = parseUPIParams(trimmed);
    return {
      rawPayload: trimmed,
      type: 'upi',
      payeeName: params['pn'] ?? null,
      upiId: params['pa'] ?? extractUPIId(trimmed),
      amount: params['am'] ?? null,
      note: params['tn'] ?? null,
      url: null,
    };
  }

  try {
    new URL(trimmed);
    return {
      rawPayload: trimmed,
      type: 'url',
      payeeName: null,
      upiId: null,
      amount: null,
      note: null,
      url: trimmed,
    };
  } catch {
    return {
      rawPayload: trimmed,
      type: 'unknown',
      payeeName: null,
      upiId: null,
      amount: null,
      note: null,
      url: null,
    };
  }
}

function parseUPIParams(upiUri: string): Record<string, string> {
  const params: Record<string, string> = {};
  const qIndex = upiUri.indexOf('?');
  if (qIndex === -1) return params;
  const queryStr = upiUri.slice(qIndex + 1);
  for (const pair of queryStr.split('&')) {
    const [key, ...valParts] = pair.split('=');
    if (key) params[key] = decodeURIComponent(valParts.join('='));
  }
  return params;
}

function extractUPIId(upiUri: string): string | null {
  const withoutPrefix = upiUri.replace(/^upi:\/\//i, '');
  const atIndex = withoutPrefix.indexOf('@');
  if (atIndex === -1) return null;
  const before = withoutPrefix.slice(0, atIndex);
  const afterPart = withoutPrefix.slice(atIndex).split(/[?&]/)[0];
  return before + afterPart;
}

function detectBrandImpersonation(hostname: string): { brand: string; legitimateDomain: string } | null {
  const lowerHost = hostname.toLowerCase();
  for (const [brand, domains] of Object.entries(KNOWN_BRANDS)) {
    if (domains.length === 0) continue;
    const isLegit = domains.some((d) => lowerHost === d || lowerHost.endsWith('.' + d));
    if (isLegit) return null;
    if (lowerHost.includes(brand) && !isLegit) {
      for (const legitDomain of domains) {
        if (isSimilarDomain(lowerHost, legitDomain) || lowerHost.includes(brand + '.')) {
          return { brand, legitimateDomain: legitDomain };
        }
      }
    }
    for (const legitDomain of domains) {
      if (isSimilarDomain(lowerHost, legitDomain)) {
        return { brand, legitimateDomain: legitDomain };
      }
    }
  }
  return null;
}

function detectMisspelledDomain(hostname: string): { typoDomain: string; intendedDomain: string } | null {
  const lowerHost = hostname.replace(/^www\./, '').toLowerCase();
  for (const safeDomain of KNOWN_SAFE_DOMAINS) {
    if (safeDomain.includes('://') || safeDomain.includes('/')) continue;
    const safeParts = safeDomain.split('.');
    if (safeParts.length < 2) continue;
    const safeSLD = safeParts[safeParts.length - 2];
    const hostParts = lowerHost.split('.');
    if (hostParts.length < 2) continue;
    const hostSLD = hostParts[hostParts.length - 2];
    if (hostSLD === safeSLD) continue;
    const distance = levenshtein(hostSLD, safeSLD);
    if (distance > 0 && distance <= 2 && safeSLD.length >= 4) {
      const safeFull = safeParts.slice(-2).join('.');
      if (lowerHost !== safeFull && !lowerHost.endsWith('.' + safeFull)) {
        return { typoDomain: hostSLD, intendedDomain: safeFull };
      }
    }
  }
  return null;
}

export function assessSecurity(payload: QRPayload): SecurityAssessment {
  const indicators: SecurityIndicator[] = [];
  let score = 0;
  const maxScore = 100;

  if (payload.type === 'upi') {
    if (!payload.upiId || !payload.upiId.includes('@')) {
      indicators.push({ label: 'Malformed UPI ID', severity: 'high', weight: 35, detail: 'The UPI ID is missing or does not contain a valid VPA handle (e.g., name@bank). This may indicate a tampered or fake QR code.' });
      score += 35;
    }

    if (payload.upiId) {
      const vpaDomain = payload.upiId.split('@')[1]?.toLowerCase() ?? '';
      const tld = vpaDomain.split('.').pop() ?? '';

      if (SUSPICIOUS_TLDS.includes(tld)) {
        indicators.push({ label: 'Suspicious VPA domain TLD', severity: 'high', weight: 30, detail: `The VPA handle "@${vpaDomain}" ends in ".${tld}", a TLD frequently abused for phishing and scam payment setups.` });
        score += 30;
      }

      const brandHit = detectBrandImpersonation(vpaDomain);
      if (brandHit) {
        indicators.push({ label: `Brand impersonation: ${brandHit.brand}`, severity: 'critical', weight: 40, detail: `The VPA domain "${vpaDomain}" impersonates "${brandHit.brand}". The legitimate domain is "${brandHit.legitimateDomain}". Scammers use look-alike handles to trick victims into sending money to the wrong account.` });
        score += 40;
      }

      if (payload.upiId.length < 5) {
        indicators.push({ label: 'Unusually short UPI ID', severity: 'medium', weight: 15, detail: 'Very short UPI IDs may indicate auto-generated disposable accounts used in scam QR codes.' });
        score += 15;
      }

      const randomLooking = /^[a-z0-9]{1,4}@[a-z0-9]{2,5}\./i.test(payload.upiId);
      if (randomLooking) {
        indicators.push({ label: 'Random-looking VPA', severity: 'medium', weight: 20, detail: 'The VPA appears to be a short auto-generated handle on a non-standard domain, common in scam QR codes.' });
        score += 20;
      }
    }

    if (payload.amount) {
      const amt = parseFloat(payload.amount);
      if (!isNaN(amt) && amt > 100000) {
        indicators.push({ label: 'High payment amount', severity: 'medium', weight: 15, detail: `The amount Rs.${amt.toLocaleString('en-IN')} is unusually high for a QR-initiated payment. Verify the recipient carefully before proceeding.` });
        score += 15;
      }
    }

    if (payload.note) {
      const noteLower = payload.note.toLowerCase();
      const matchedKw: string[] = [];
      for (const kw of SUSPICIOUS_KEYWORDS) {
        if (noteLower.includes(kw)) matchedKw.push(kw);
      }
      if (matchedKw.length > 0) {
        const sev = matchedKw.length >= 3 ? 'high' : 'medium';
        const w = matchedKw.length >= 3 ? 25 : 15;
        indicators.push({ label: 'Suspicious note keywords', severity: sev, weight: w, detail: `The payment note contains suspicious keyword(s): ${matchedKw.join(', ')}. Scammers use urgency words to pressure victims into paying.` });
        score += w;
      }
    }

    if (!payload.payeeName) {
      indicators.push({ label: 'Missing payee name', severity: 'low', weight: 5, detail: 'The payee name is not specified. Legitimate merchants usually include their name in UPI QR codes.' });
      score += 5;
    }

    if (payload.payeeName) {
      const pName = payload.payeeName.toLowerCase();
      for (const [brand, domains] of Object.entries(KNOWN_BRANDS)) {
        if (domains.length === 0) continue;
        if (pName.includes(brand)) {
          const vpaDomain = payload.upiId?.split('@')[1]?.toLowerCase() ?? '';
          const isLegitVPA = domains.some((d) => vpaDomain === d || vpaDomain.endsWith('.' + d));
          if (!isLegitVPA && vpaDomain) {
            indicators.push({ label: `Payee name mimics "${brand}" but VPA is unknown`, severity: 'high', weight: 35, detail: `The payee name says "${payload.payeeName}" (resembling "${brand}") but the VPA domain "${vpaDomain}" is not an official ${brand} domain. This is a common impersonation pattern in payment scams.` });
            score += 35;
            break;
          }
        }
      }
    }
  } else if (payload.type === 'url') {
    try {
      const url = new URL(payload.url!);
      const protocol = url.protocol;
      const hostname = url.hostname.toLowerCase();
      const { sld, tld } = getDomainParts(hostname);

      if (protocol !== 'https:' && protocol !== 'http:') {
        indicators.push({ label: 'Unexpected URL scheme', severity: 'high', weight: 35, detail: `The URL uses the "${protocol}" scheme instead of http or https. This is unusual and potentially unsafe.` });
        score += 35;
      }

      if (protocol === 'http:') {
        indicators.push({ label: 'Insecure HTTP connection', severity: 'medium', weight: 15, detail: 'This URL uses HTTP instead of HTTPS. Financial data entered on this page would not be encrypted and could be intercepted.' });
        score += 15;
      }

      const isKnownSafe = KNOWN_SAFE_DOMAINS.some((d) => {
        if (d.includes('://')) return false;
        return hostname === d || hostname.endsWith('.' + d);
      });

      if (isKnownSafe && indicators.length === 0) {
        indicators.push({ label: 'Known legitimate domain', severity: 'low', weight: 0, detail: `"${hostname}" is recognized as a legitimate domain for a known payment provider, bank, or service.` });
      }

      if (SUSPICIOUS_TLDS.includes(tld)) {
        indicators.push({ label: 'Suspicious domain TLD', severity: 'high', weight: 30, detail: `The domain ".${tld}" is frequently used in phishing campaigns and scam websites. Legitimate banks and payment services rarely use these TLDs.` });
        score += 30;
      }

      if (hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
        indicators.push({ label: 'Raw IP address as hostname', severity: 'high', weight: 30, detail: 'The URL points to a raw IP address instead of a domain name. Legitimate banking and payment services always use domain names. This is a strong phishing indicator.' });
        score += 30;
      }

      const impersonation = detectBrandImpersonation(hostname);
      if (impersonation) {
        indicators.push({ label: `Brand impersonation: ${impersonation.brand}`, severity: 'critical', weight: 45, detail: `The domain "${hostname}" appears to impersonate "${impersonation.brand}". The legitimate domain is "${impersonation.legitimateDomain}". Phishing sites use misspelled or look-alike domains to steal credentials and payment information.` });
        score += 45;
      }

      const typo = detectMisspelledDomain(hostname);
      if (typo && !impersonation) {
        indicators.push({ label: 'Misspelled domain', severity: 'critical', weight: 40, detail: `The domain "${typo.typoDomain}" is a misspelling of the legitimate domain "${typo.intendedDomain}". This is a classic typosquatting technique used to trick users into entering sensitive information on a fake site.` });
        score += 40;
      }

      if (URL_SHORTENERS.some((s) => hostname === s || hostname.endsWith('.' + s))) {
        indicators.push({ label: 'URL shortener detected', severity: 'high', weight: 25, detail: `This URL uses the shortener "${hostname}", which hides the actual destination. Scammers use shortened links to conceal phishing URLs. Do not click unless you trust the source and can verify the destination.` });
        score += 25;
      }

      if (hostname.split('.').length > 4) {
        indicators.push({ label: 'Excessive subdomain levels', severity: 'medium', weight: 20, detail: `The domain has ${hostname.split('.').length - 1} subdomain levels. Phishing sites use deep subdomain nesting to mimic legitimate domains (e.g., "hdfc.secure.login.example.com").` });
        score += 20;
      }

      if (hostname.includes('-') && sld.includes('-')) {
        const hyphenParts = sld.split('-');
        if (hyphenParts.length >= 2) {
          const combined = hyphenParts.join('');
          for (const [brand, domains] of Object.entries(KNOWN_BRANDS)) {
            if (domains.length === 0) continue;
            if (combined.includes(brand) && !hostname.includes(domains[0])) {
              indicators.push({ label: `Hyphenated brand name: ${brand}`, severity: 'critical', weight: 42, detail: `The domain "${sld}" uses hyphens to embed the brand name "${brand}" within a different domain. This is a common impersonation tactic (e.g., "hdfc-bank-secure.com" is not "hdfcbank.com").` });
              score += 42;
              break;
            }
          }
        }
      }

      const fullLower = hostname + url.pathname + url.search;
      const matchedKw: string[] = [];
      for (const kw of SUSPICIOUS_KEYWORDS) {
        if (fullLower.includes(kw)) matchedKw.push(kw);
      }
      if (matchedKw.length > 0) {
        const sev = matchedKw.length >= 3 ? 'high' : 'medium';
        const w = matchedKw.length >= 3 ? 25 : 15;
        indicators.push({ label: 'Suspicious keywords in URL', severity: sev, weight: w, detail: `The URL contains suspicious keyword(s): ${matchedKw.join(', ')}. Phishing URLs frequently use urgency or reward words to manipulate users.` });
        score += w;
      }

      if (url.username || url.password) {
        indicators.push({ label: 'Embedded credentials in URL', severity: 'high', weight: 35, detail: 'The URL includes embedded username/password credentials. This is a well-known phishing technique to disguise the true destination.' });
        score += 35;
      }

      if (url.searchParams.has('redirect') || url.searchParams.has('url') || url.searchParams.has('next') || url.searchParams.has('target') || url.searchParams.has('goto')) {
        const redirectVal = url.searchParams.get('redirect') || url.searchParams.get('url') || url.searchParams.get('next') || url.searchParams.get('target') || url.searchParams.get('goto');
        if (redirectVal && (redirectVal.startsWith('http') || redirectVal.startsWith('//'))) {
          indicators.push({ label: 'Open redirect parameter', severity: 'high', weight: 30, detail: `The URL contains a redirect parameter pointing to "${redirectVal}". This can be used to send you to a phishing site after you land on a legitimate-looking page.` });
          score += 30;
        }
      }

      if (url.pathname.toLowerCase().includes('login') || url.pathname.toLowerCase().includes('signin') || url.pathname.toLowerCase().includes('account') || url.pathname.toLowerCase().includes('verify')) {
        if (!isKnownSafe) {
          indicators.push({ label: 'Login/verify page on unknown domain', severity: 'high', weight: 25, detail: `The URL path "${url.pathname}" suggests a login or verification page on a domain that is not a recognized bank or service. This is a common phishing pattern — fake login pages steal credentials.` });
          score += 25;
        }
      }

      if (url.port && !['80', '443', ''].includes(url.port)) {
        indicators.push({ label: 'Non-standard port', severity: 'low', weight: 8, detail: `The URL uses port ${url.port} instead of the standard 80 or 443. Legitimate websites rarely use non-standard ports.` });
        score += 8;
      }

      if (url.search.length > 200) {
        indicators.push({ label: 'Excessively long query string', severity: 'low', weight: 8, detail: 'The URL has an unusually long query string, which can be used to hide tracking or phishing parameters.' });
        score += 8;
      }

      if (protocol === 'https:' && isKnownSafe && indicators.filter((i) => i.weight > 0).length === 0) {
        score = Math.min(score, 5);
      }
    } catch {
      indicators.push({ label: 'Malformed URL', severity: 'high', weight: 35, detail: 'The URL could not be parsed. This may indicate a corrupted or deliberately malformed link.' });
      score += 35;
    }
  } else {
    indicators.push({ label: 'Unrecognized format', severity: 'medium', weight: 20, detail: 'The input does not match a known UPI URI or web URL format. The risk cannot be determined without knowing the payload type.' });
    score += 20;
  }

  score = Math.min(maxScore, Math.max(0, score));

  let riskCategory: SecurityAssessment['riskCategory'] = 'Very Low';
  if (score > 80) riskCategory = 'Critical';
  else if (score > 60) riskCategory = 'High';
  else if (score > 40) riskCategory = 'Medium';
  else if (score > 20) riskCategory = 'Low';

  const advice: string[] = [];
  if (payload.type === 'upi') {
    advice.push('Always verify the payee name and UPI ID before making any payment.');
    advice.push('Never share your UPI PIN or OTP with anyone, regardless of the request.');
    if (score > 20) advice.push('Cross-check the payee through a separate channel (call or message) before transferring money.');
    if (score > 60) advice.push('Do not proceed with this payment unless you have independently confirmed the recipient through a trusted source.');
  }
  if (payload.type === 'url') {
    advice.push('Check that the website address is spelled correctly and uses HTTPS (look for the padlock icon).');
    advice.push('Do not enter banking credentials, OTPs, or UPI PINs on pages reached from unfamiliar links.');
    if (score > 20) advice.push('Avoid clicking links from unknown SMS, email, or WhatsApp messages.');
    if (score > 60) advice.push('This link shows multiple serious risk indicators. Do not visit it. If you already did, do not enter any credentials and run a malware scan.');
  }
  if (indicators.length === 0 || score <= 20) advice.push('No significant risk indicators detected, but remain vigilant — this analysis is heuristic, not a guarantee of safety.');
  if (score > 40) advice.push('This assessment shows multiple risk indicators. Exercise extreme caution and verify independently before taking any action.');

  const disclaimer = 'This assessment uses heuristic rule-based analysis of the provided input only. It checks for domain impersonation, phishing patterns, suspicious TLDs, URL shorteners, misspelled domains, and other structural indicators. It is NOT connected to live threat-intelligence databases and cannot confirm whether a URL is actively malicious. A low risk score does not guarantee safety. Always use your own judgment and verify independently.';

  return { payload, riskScore: score, riskCategory, indicators, advice, disclaimer, analysisType: 'heuristic' };
}
