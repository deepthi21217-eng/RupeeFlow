import { useState } from 'react';
import { SecurityAssessment } from '@/types/stage2';
import { parseUPIPayload, assessSecurity } from '@/utils/qrSecurity';
import PageHeader from '@/components/PageHeader';
import {
  ShieldCheck, Link as LinkIcon, ScanLine, AlertTriangle, CheckCircle2,
  Info, XCircle, Upload, FileImage, ShieldAlert, ShieldX, ExternalLink, Globe,
} from 'lucide-react';

const RISK_TIERS = {
  'Very Low': { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2, barColor: 'bg-green-500', label: 'Very Low Risk' },
  'Low': { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: ShieldCheck, barColor: 'bg-blue-500', label: 'Low Risk' },
  'Medium': { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle, barColor: 'bg-amber-500', label: 'Medium Risk' },
  'High': { color: 'text-orange-600 bg-orange-50 border-orange-200', icon: ShieldAlert, barColor: 'bg-orange-500', label: 'High Risk' },
  'Critical': { color: 'text-red-600 bg-red-50 border-red-200', icon: ShieldX, barColor: 'bg-red-600', label: 'Critical Risk' },
} as const;

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50 border-red-200', icon: ShieldX, iconColor: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  high: { bg: 'bg-orange-50 border-orange-200', icon: XCircle, iconColor: 'text-orange-500', badge: 'bg-orange-100 text-orange-700' },
  medium: { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },
  low: { bg: 'bg-slate-50 border-slate-200', icon: Info, iconColor: 'text-slate-400', badge: 'bg-slate-100 text-slate-500' },
} as const;

export default function SecurityPage() {
  const [input, setInput] = useState('');
  const [assessment, setAssessment] = useState<SecurityAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrFileName, setQrFileName] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    if (!input.trim()) {
      setError('Please paste a URL or UPI URI to analyze.');
      setAssessment(null);
      return;
    }
    const payload = parseUPIPayload(input.trim());
    setAssessment(assessSecurity(payload));
  }

  function handleQRUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setQrFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const img = new Image();
        img.onload = async () => {
          try {
            const jsQR = (await import('jsqr')).default;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { setError('Could not process image.'); return; }
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              setInput(code.data);
              const payload = parseUPIPayload(code.data);
              setAssessment(assessSecurity(payload));
            } else {
              setError('No QR code was found in the uploaded image. Make sure the image contains a valid QR code.');
              setAssessment(null);
            }
          } catch {
            setError('QR decoding library is not available. Please paste the UPI URI or URL manually instead.');
            setAssessment(null);
          }
        };
        img.onerror = () => { setError('Could not load the image file.'); };
        img.src = ev.target?.result as string;
      } catch {
        setError('Failed to process the QR image.');
      }
    };
    reader.readAsDataURL(file);
  }

  const tier = assessment ? RISK_TIERS[assessment.riskCategory] : null;
  const RiskIcon = tier?.icon ?? ShieldCheck;

  return (
    <div>
      <PageHeader title="Security Analysis" subtitle="Advanced QR code and URL risk assessment with evidence-based scoring" icon={<ShieldCheck className="w-5 h-5" />} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Input Panel */}
        <div className="rf-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Paste URL or UPI URI</h3>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., upi://pay?pa=merchant@paytm&pn=Store&am=500&tn=Payment"
            rows={4}
            className="rf-input font-mono text-xs resize-none"
          />
          <button onClick={handleAnalyze} className="rf-btn-primary w-full justify-center">
            <ShieldCheck className="w-4 h-4" /> Analyze
          </button>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ScanLine className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">Upload QR Image</h3>
            </div>
            <label className="rf-btn-secondary cursor-pointer w-full justify-center">
              <Upload className="w-4 h-4" /> Choose QR Image
              <input type="file" accept="image/*" className="hidden" onChange={handleQRUpload} />
            </label>
            {qrFileName && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><FileImage className="w-3.5 h-3.5" /> {qrFileName}</p>}
          </div>
        </div>

        {/* Result Panel */}
        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Assessment Result</h3>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3 mb-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {!assessment && !error && (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Paste a URL or UPI URI, or upload a QR image to see the security assessment.</p>
            </div>
          )}

          {assessment && tier && (
            <div className="space-y-4">
              {/* Risk Score */}
              <div className={`rounded-lg border p-4 ${tier.color}`}>
                <div className="flex items-center gap-3 mb-3">
                  <RiskIcon className="w-7 h-7" />
                  <div>
                    <p className="text-2xl font-bold">{assessment.riskScore}/100</p>
                    <p className="text-sm font-medium">{tier.label}</p>
                  </div>
                </div>
                {/* Score Bar */}
                <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full ${tier.barColor} rounded-full transition-all duration-500`} style={{ width: `${assessment.riskScore}%` }} />
                </div>
                <div className="flex justify-between text-[10px] mt-1 opacity-70">
                  <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
                </div>
              </div>

              {/* Risk Scale Legend */}
              <div className="flex gap-1 text-[9px]">
                {(['Very Low', 'Low', 'Medium', 'High', 'Critical'] as const).map((cat) => (
                  <div key={cat} className={`flex-1 text-center py-1 rounded ${RISK_TIERS[cat].color} ${assessment.riskCategory === cat ? 'ring-2 ring-offset-1 font-bold' : 'opacity-50'}`}>
                    {cat}
                  </div>
                ))}
              </div>

              {/* Extracted Payload */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Extracted Details</p>
                <div className="space-y-1 text-sm">
                  <PayloadRow label="Type" value={assessment.payload.type.toUpperCase()} />
                  {assessment.payload.payeeName && <PayloadRow label="Payee Name" value={assessment.payload.payeeName} />}
                  {assessment.payload.upiId && <PayloadRow label="UPI ID" value={assessment.payload.upiId} />}
                  {assessment.payload.amount && <PayloadRow label="Amount" value={`Rs.${assessment.payload.amount}`} />}
                  {assessment.payload.note && <PayloadRow label="Note" value={assessment.payload.note} />}
                  {assessment.payload.url && <PayloadRow label="URL" value={assessment.payload.url} />}
                </div>
              </div>

              {/* Domain Info for URLs */}
              {assessment.payload.url && (
                <div className="bg-blue-50/50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> Domain & URL Information
                  </p>
                  {(() => {
                    try {
                      const u = new URL(assessment.payload.url);
                      return (
                        <div className="space-y-1 text-sm">
                          <PayloadRow label="Domain" value={u.hostname} />
                          <PayloadRow label="Protocol" value={u.protocol.replace(':', '')} />
                          {u.pathname && u.pathname !== '/' && <PayloadRow label="Path" value={u.pathname} />}
                          {u.search && <PayloadRow label="Query Params" value={u.search.length > 80 ? u.search.slice(0, 80) + '...' : u.search} />}
                        </div>
                      );
                    } catch {
                      return <p className="text-xs text-slate-400">Could not parse domain information.</p>;
                    }
                  })()}
                </div>
              )}

              {/* Indicators */}
              {assessment.indicators.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Detected Indicators ({assessment.indicators.length})
                  </p>
                  <div className="space-y-2">
                    {assessment.indicators.map((ind, i) => {
                      const style = SEVERITY_STYLES[ind.severity] ?? SEVERITY_STYLES.low;
                      const Icon = style.icon;
                      return (
                        <div key={i} className={`rounded-lg p-3 text-sm border ${style.bg}`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <Icon className={`w-4 h-4 ${style.iconColor}`} />
                            <span className="font-medium text-slate-700">{ind.label}</span>
                            <span className={`rf-badge ml-auto text-[10px] capitalize ${style.badge}`}>{ind.severity}</span>
                          </div>
                          <p className="text-xs text-slate-500 ml-6">{ind.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommended Action */}
              {(() => {
                const score = assessment.riskScore;
                let action = 'No specific action required. Continue with normal caution.';
                let actionStyle = 'bg-green-50 border-green-200 text-green-700';
                let ActionIcon = CheckCircle2;
                if (score > 80) {
                  action = 'Do not proceed. This link or QR code shows critical risk indicators consistent with phishing or fraud. Do not visit the URL, do not make any payment, and report it if possible.';
                  actionStyle = 'bg-red-50 border-red-200 text-red-700';
                  ActionIcon = ShieldX;
                } else if (score > 60) {
                  action = 'Stop and verify independently. This item shows high-risk indicators. Do not enter credentials or make payments. Contact the institution directly through their official website or phone number.';
                  actionStyle = 'bg-orange-50 border-orange-200 text-orange-700';
                  ActionIcon = ShieldAlert;
                } else if (score > 40) {
                  action = 'Exercise caution. This item shows medium-risk indicators. Verify the source through a separate channel before proceeding. Do not enter sensitive information.';
                  actionStyle = 'bg-amber-50 border-amber-200 text-amber-700';
                  ActionIcon = AlertTriangle;
                } else if (score > 20) {
                  action = 'Stay alert. Some low-level risk indicators were detected. Double-check the destination before entering any information.';
                  actionStyle = 'bg-blue-50 border-blue-200 text-blue-700';
                  ActionIcon = Info;
                }
                return (
                  <div className={`rounded-lg border p-3 ${actionStyle}`}>
                    <div className="flex items-start gap-2">
                      <ActionIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1">Recommended Safety Action</p>
                        <p className="text-sm">{action}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Advice */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Safety Tips</p>
                <ul className="space-y-1.5">
                  {assessment.advice.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="bg-slate-100 rounded-lg p-3">
                <p className="text-xs text-slate-500 italic">{assessment.disclaimer}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="rf-card p-4 bg-blue-50/40 border-blue-100">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">About this tool</p>
            <p className="text-xs">
              This tool performs heuristic analysis on URLs and UPI payment URIs extracted from QR codes. It detects
              brand impersonation, misspelled domains, suspicious TLDs, URL shorteners, phishing keywords, embedded
              credentials, open redirects, and other structural risk indicators. Each indicator contributes an
              evidence-based weight to the final risk score. The analysis is heuristic — it does not connect to
              live threat-intelligence databases and cannot confirm a URL is actively malicious. A low score does
              not guarantee safety. This tool never initiates payments, requests UPI PINs or OTPs, or opens suspicious URLs.
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
              <ExternalLink className="w-3.5 h-3.5" />
              Risk classification: 0-20% Very Low · 21-40% Low · 41-60% Medium · 61-80% High · 81-100% Critical
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayloadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-slate-700 text-xs font-medium break-all max-w-[200px]">{value}</span>
    </div>
  );
}
