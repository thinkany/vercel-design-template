// ©2026 thinkany llc. All rights reserved.
// Dev stand-in for the forms endpoint. Astro dev serves static pages only; the
// published site's /api/forms is a Vercel function (api/forms.js). Here a POST to
// it answers { ok: true, preview: true } so the Site tab shows the form's success
// state with its "nothing was sent" note, and nothing is delivered.
export default function formsDev() {
  return {
    name: "ta-forms-dev",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const url = (req.url || "").split("?")[0];
          if (url !== "/api/forms" || req.method !== "POST") return next();
          let body = "";
          req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
          req.on("end", () => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, preview: true }));
          });
        });
      },
    },
  };
}
