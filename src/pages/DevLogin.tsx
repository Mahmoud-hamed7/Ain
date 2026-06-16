/**
 * DevLogin — Development-only JWT injection page.
 * Accessible at /dev-login. Only renders in development mode.
 *
 * Usage: paste a JWT token → click "Login with Token" → redirected to
 * the appropriate dashboard based on the token's role claim.
 *
 * NEVER import or reference this from production code paths.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Terminal, LogIn, Eye, EyeOff, AlertTriangle } from 'lucide-react';

function decodeJWT(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function getRole(payload: Record<string, any>): string {
  return (
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    payload.role ??
    'Citizen'
  );
}

function getRoleRoute(role: string): string {
  if (['Admin', 'SuperAdmin'].includes(role)) return '/admin/dashboard';
  if (role === 'Authority') return '/authority/dashboard';
  return '/citizen/feed';
}

export default function DevLogin() {
  const [token,   setToken]   = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [error,   setError]   = useState('');
  const [payload, setPayload] = useState<Record<string, any> | null>(null);

  const { login } = useAuthStore();
  const navigate  = useNavigate();

  const decode = (t: string) => {
    const decoded = decodeJWT(t.trim());
    setPayload(decoded);
    if (!decoded) setError('Invalid JWT format — cannot decode payload.');
    else setError('');
    return decoded;
  };

  const handleTokenChange = (v: string) => {
    setToken(v);
    if (v.trim()) decode(v);
    else { setPayload(null); setError(''); }
  };

  const handleLogin = () => {
    const t = token.trim();
    if (!t) { setError('Please paste a JWT token.'); return; }
    const decoded = decode(t);
    if (!decoded) return;

    const exp = decoded.exp;
    if (exp && Date.now() / 1000 > exp) {
      setError(`⚠️ Token expired at ${new Date(exp * 1000).toLocaleString()}. It may still work if the server accepts it.`);
    }

    login(t);
    const role  = getRole(decoded);
    const route = getRoleRoute(role);
    navigate(route, { replace: true });
  };

  const QUICK_TOKEN = "eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjUyMjk4MzMzLTFiMDUtNDA3Ny04NGFlLTc0MWUzZGM2YzNhOCIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2dpdmVubmFtZSI6ImFiZHUxMTkiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9lbWFpbGFkZHJlc3MiOiJhYmR1MTk3MzIwMDQyMkBnbWFpbC5jb20iLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBdXRob3JpdHkiLCJhdXRob3JpdHlJZCI6IjliYWE2YzlhLTk4NGUtNDNhZi1iN2Y4LTA2NzczYmQ2MjE1MCIsImF1dGhvcml0eU5hbWUiOiLYp9mE2LTYsdi32KkgLyBQb2xpY2UiLCJleHAiOjE3ODE0NDg1NzgsImlzcyI6Imh0dHBzOi8vbG9jYWxob3N0OjcxNTUiLCJhdWQiOiJNeVNlY3VyZWRBcGlVc2VycyJ9.qAkyqd8Xtloh02ZQb4RzPk5q69XWzzUqrpOg6ImOhZg";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Dev Token Login</h1>
            <p className="text-xs text-amber-400/80">Development only — bypasses normal auth flow</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-6 space-y-5">
          {/* Quick-fill button */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-300">JWT Token</label>
            <button
              onClick={() => handleTokenChange(QUICK_TOKEN)}
              className="text-xs text-amber-400 hover:text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-lg transition-colors"
            >
              ⚡ Use Authority Token
            </button>
          </div>

          <div className="relative">
            <textarea
              value={showRaw ? token : token ? '•'.repeat(Math.min(token.length, 80)) + '…' : ''}
              onChange={(e) => handleTokenChange(e.target.value)}
              onFocus={() => setShowRaw(true)}
              onBlur={() => setShowRaw(false)}
              placeholder="Paste JWT token here…"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-gray-600 outline-none focus:border-amber-500/50 resize-none transition-colors"
            />
            <button
              onClick={() => setShowRaw((s) => !s)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white"
            >
              {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Decoded preview */}
          {payload && !error && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Token Preview</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Role',        getRole(payload)],
                  ['Display Name', payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ?? payload.name ?? '—'],
                  ['Email',       payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? payload.email ?? '—'],
                  ['Authority ID', payload.authorityId ?? '—'],
                  ['Expires',     payload.exp ? new Date(payload.exp * 1000).toLocaleString() : '—'],
                  ['Dashboard',   getRoleRoute(getRole(payload))],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-white font-semibold truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={!token.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            Login with Token → {payload ? getRoleRoute(getRole(payload)) : 'Dashboard'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-700 mt-4">
          This page only exists in development mode and is not accessible in production builds.
        </p>
      </div>
    </div>
  );
}
