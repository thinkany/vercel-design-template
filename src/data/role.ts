// ©2026 thinkany llc. All rights reserved.
function getCookie(name: string): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(name + "="))
      ?.split("=")[1] ?? ""
  );
}

export type Role = "admin" | "client" | "unknown";

// In local dev there is no middleware, so default to admin.
export function getRole(): Role {
  const r = getCookie("ta-role");
  if (r === "admin") return "admin";
  if (r === "client") return "client";
  // No cookie → assume local dev session → full access
  return "admin";
}
