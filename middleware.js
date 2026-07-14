export const config = {
  matcher: ['/((?!_vercel).*)'],
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

// Brand shown on the preview gate. Set CLIENT_NAME / PROJECT_TITLE in Vercel's
// Environment Variables. These are edge-runtime vars — SEPARATE from the app's
// build-time VITE_* in .env, which the middleware cannot read.
const CLIENT_NAME = escapeHtml(process.env.CLIENT_NAME || 'Preview')
const PROJECT_TITLE = escapeHtml(process.env.PROJECT_TITLE || 'A Design System')
//const COMPANY_NAME = escapeHtml(process.env.COMPANY_NAME || '')

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${CLIENT_NAME} : ${PROJECT_TITLE}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+CiAgPHN0eWxlPgogICAgLnJpbmcgeyBmaWxsOiBub25lOyBzdHJva2U6ICMwMDA7IHN0cm9rZS13aWR0aDogMS41IH0KICAgIC5kb3QgeyBmaWxsOiAjMDAwIH0KICAgIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspIHsKICAgICAgLnJpbmcgeyBzdHJva2U6ICNmZmYgfQogICAgICAuZG90IHsgZmlsbDogI2ZmZiB9CiAgICB9CiAgPC9zdHlsZT4KICA8Y2lyY2xlIGNsYXNzPSJyaW5nIiBjeD0iMTYiIGN5PSIxNiIgcj0iMTMiIC8+CiAgPGNpcmNsZSBjbGFzcz0iZG90IiBjeD0iMTYiIGN5PSIxNiIgcj0iMi4yNSIgLz4KPC9zdmc+Cg==" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Inter:wght@300&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* Neutral admin chrome — mirrors the --admin-* tokens in src/styles/tokens.css
       (edge runtime can't read them). Black / grays / white, kept free of any
       client brand color so the gate reads as foundation, not brand. */
    body {
      background: #fafafa;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
    }

    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
      padding: 40px 24px;
    }

    .brand {
      text-align: center;
    }

    .brand-name {
      font-family: 'DM Sans', sans-serif;
      font-weight: 700;
      font-display: swap;
      font-size: clamp(32px, 6vw, 48px);
      color: #1a1a1a;
      letter-spacing: -0.01em;
      line-height: 1.05;
    }

    .brand-subtitle {
      font-family: 'Inter', sans-serif;
      font-weight: 300;
      font-style: normal;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(0,0,0,0.4);
      margin-top: 12px;
    }

    .brand-credit {
      font-family: 'Inter', sans-serif;
      font-weight: 400;
      font-size: 12px;
      letter-spacing: 0.02em;
      color: rgba(0,0,0,0.4);
      margin-top: 10px;
    }

    .gate {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      width: 100%;
      max-width: 320px;
    }

    .label {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.18em;
      color: rgba(0,0,0,0.4);
      text-transform: uppercase;
    }

    .divider {
      width: 40px;
      height: 1px;
      background: rgba(0,0,0,0.15);
    }

    .field {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pw-wrap {
      position: relative;
      width: 100%;
    }

    .pw-wrap input {
      width: 100%;
      padding: 12px 44px 12px 16px;
      border: 1px solid rgba(0,0,0,0.18);
      background: #fff;
      border-radius: 3px;
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      color: #1a1a1a;
      outline: none;
      transition: border-color 0.15s;
      -webkit-appearance: none;
      box-sizing: border-box;
    }

    .pw-wrap input:focus {
      border-color: #1a1a1a;
    }

    .pw-wrap input::placeholder {
      color: rgba(0,0,0,0.3);
    }

    .pw-wrap input.error {
      border-color: #b3261e;
    }

    .toggle-vis {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      color: rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .toggle-vis:hover {
      color: rgba(0,0,0,0.65);
    }

    .error-msg {
      font-size: 12px;
      color: #b3261e;
      display: none;
      text-align: left;
      letter-spacing: 0.02em;
    }

    .error-msg.visible {
      display: block;
    }

    button[type="submit"] {
      width: 100%;
      padding: 12px 16px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 3px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s;
    }

    button[type="submit"]:hover {
      background: #000000;
    }

    .footer-note {
      font-size: 11px;
      color: rgba(0,0,0,0.3);
      letter-spacing: 0.06em;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="brand-name">${CLIENT_NAME}</div>
      ${PROJECT_TITLE ? `<div class="brand-subtitle">${PROJECT_TITLE}</div>` : ''}
    </div>

    <div class="gate">
      <div class="label">Preview Access</div>
      <div class="divider"></div>

      <form class="field" id="form" onsubmit="attempt(event)">
        <div class="pw-wrap">
          <input type="password" id="pw" placeholder="Enter password" autocomplete="current-password" autofocus />
          <button type="button" class="toggle-vis" id="toggle" onclick="toggleVis()" aria-label="Show password">
            <svg id="icon-eye" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <svg id="icon-eye-off" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:none">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>
        <div class="error-msg" id="err">Incorrect password — please check and try again.</div>
        <button type="submit">Enter</button>
      </form>
    </div>

    <p class="footer-note">Design preview environment &mdash; not meant for distribution</p>
  </div>

  <script>
    // Show error if a previous attempt failed (cookie set but still on login page)
    window.addEventListener('DOMContentLoaded', function () {
      var cookies = document.cookie.split(';').reduce(function(acc, c) {
        var parts = c.trim().split('=');
        acc[parts[0]] = decodeURIComponent(parts.slice(1).join('='));
        return acc;
      }, {});
      if (cookies['ta-auth']) {
        // Bad password was attempted — clear it and show error
        document.cookie = 'ta-auth=; path=/; max-age=0';
        document.cookie = 'ta-role=; path=/; max-age=0';
        document.getElementById('err').classList.add('visible');
        document.getElementById('pw').classList.add('error');
      }
    });

    function attempt(e) {
      e.preventDefault();
      var raw = document.getElementById('pw').value;
      var pw = raw.trim(); // strip accidental whitespace from pasting
      var err = document.getElementById('err');
      var input = document.getElementById('pw');
      if (!pw) return;
      err.classList.remove('visible');
      input.classList.remove('error');
      document.cookie = 'ta-auth=' + encodeURIComponent(pw) + '; path=/; SameSite=Strict; max-age=86400';
      window.location.reload();
    }

    function toggleVis() {
      var input = document.getElementById('pw');
      var eyeOn = document.getElementById('icon-eye');
      var eyeOff = document.getElementById('icon-eye-off');
      var toggle = document.getElementById('toggle');
      if (input.type === 'password') {
        input.type = 'text';
        eyeOn.style.display = 'none';
        eyeOff.style.display = 'block';
        toggle.setAttribute('aria-label', 'Hide password');
      } else {
        input.type = 'password';
        eyeOn.style.display = 'block';
        eyeOff.style.display = 'none';
        toggle.setAttribute('aria-label', 'Show password');
      }
    }
  </script>
</body>
</html>`

function parseCookies(header) {
  return Object.fromEntries(
    (header || '').split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), decodeURIComponent(v.join('='))]
    })
  )
}

export default function middleware(req) {
  const cookies = parseCookies(req.headers.get('cookie'))
  const auth = cookies['ta-auth']

  // Fail closed: require a non-empty cookie AND a configured password. Without
  // the `auth &&` guards, an unset ADMIN_PASS/AUTH_PASS would make
  // `undefined === undefined` true and grant access with no cookie at all.
  let role = null
  if (auth && auth === process.env.ADMIN_PASS) role = 'admin'
  else if (auth && auth === process.env.AUTH_PASS) role = 'client'

  if (!role) {
    return new Response(LOGIN_PAGE, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // If role cookie is already correct, pass through
  if (cookies['ta-role'] === role) return

  // Otherwise set the role cookie via redirect (one-time, transparent to user)
  return new Response(null, {
    status: 302,
    headers: {
      'Location': req.url,
      'Set-Cookie': `ta-role=${role}; path=/; SameSite=Strict; max-age=86400`,
    },
  })
}
